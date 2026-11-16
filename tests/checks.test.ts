import { describe, expect, it } from 'vitest';
import { checkApi, docsScore } from '../src/engine/api-checks';
import { checkResponse, parseResponse } from '../src/engine/server-checks';
import { checkJwt, decodeJwt } from '../src/engine/jwt';
import { diffApis } from '../src/engine/diff';
import { SAFEGUARDS, checkAiSurface, checkSafeguards, checkTools, findHiddenChars, revealHidden } from '../src/engine/agent';
import { parseApi, parseTools } from '../src/engine/parse';
import { analyze } from '../src/engine/report';
import {
  ASSISTANT_SPEC, CLEAN_SPEC, FIXTURE_NOW, INVOICES_NEXT, INVOICES_PREVIOUS, JWT_GOOD, JWT_LONG_LIVED_EXPIRED, JWT_UNSIGNED,
  ORDERS_SPEC, PAYMENTS_SPEC, RESPONSE_CLEAN, RESPONSE_NULL_ORIGIN_HTML, RESPONSE_PUBLIC_401, RESPONSE_REFLECTED_CORS,
  RESPONSE_STACK_TRACE, RESPONSE_WEAK_CSP_HTML, RESPONSE_WILDCARD_CREDENTIALS, STATUS_BOARD_SPEC, TEST_ORIGIN, TOOLS_CLEAN,
  TOOLS_MCP, TOOLS_OPENAI, b64url, makeJwt, ZERO_WIDTH_SPACE,
} from '../src/engine/fixtures';
import type { Finding } from '../src/engine/types';
import { one, only } from './helpers';

const NOW_S = Math.floor(FIXTURE_NOW.getTime() / 1000);
const apiFindings = (text: string) => checkApi(parseApi(text));
const rules = (list: Finding[]) => new Set(list.map((f) => f.rule));

/** A one-operation OpenAPI 3.0 document. */
function spec(path: string, method: string, operation: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Fixture', version: '1.0.0', description: 'A test fixture.', contact: { name: 'Tests' } },
    servers: [{ url: 'https://api.fixture.example' }],
    security: [{ bearerAuth: [] }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: { [path]: { [method]: { summary: 'Fixture operation', responses: { '200': { description: 'ok' }, '400': { description: 'bad' }, '429': { description: 'slow down' } }, ...operation } } },
    ...extra,
  });
}
const jsonBody = (properties: Record<string, unknown>, more: Record<string, unknown> = {}) =>
  ({ content: { 'application/json': { schema: { type: 'object', properties, ...more } } } });

// ---------- OpenAPI checks ----------

describe('checkApi on the Orders API', () => {
  const findings = apiFindings(ORDERS_SPEC);

  it('API1: the caller picks the object on GET /v1/orders/{orderId}', () => {
    const f = one(findings, 'API1-OWNERSHIP', 'GET /v1/orders/{orderId}');
    expect(f).toMatchObject({ severity: 'high', evidence: 'orderId', area: 'api' }); // a numeric id is easy to guess
    expect(f.detail).toMatch(/neighbouring ids/);
    expect(f.refs[0].standard).toMatch(/^API1:2023/);
    expect(one(findings, 'API1-OWNERSHIP', 'GET /v2/orders/{orderId}').severity).toBe('medium'); // a string id on a signed-in read
  });

  it('API1 and API2: a public write is critical', () => {
    expect(one(findings, 'API1-OWNERSHIP', 'DELETE /v1/carts/{cartId}').severity).toBe('critical');
    const pub = one(findings, 'API2-PUBLIC-OP', 'DELETE /v1/carts/{cartId}');
    expect(pub).toMatchObject({ severity: 'critical', title: 'A write operation needs no authentication' });
    expect(one(findings, 'API2-PUBLIC-OP', 'GET /v1/catalog').severity).toBe('medium');
  });

  it('API1: an object id in a write body counts', () => {
    expect(one(findings, 'API1-OWNERSHIP', 'POST /v1/refunds')).toMatchObject({ severity: 'high', evidence: 'orderId' });
  });

  it('API2: sign-in is exempt from the public check but needs a documented rate limit', () => {
    expect(only(findings, 'API2-PUBLIC-OP', 'POST /v1/auth/login')).toEqual([]);
    expect(one(findings, 'API2-LOGIN-RATE', 'POST /v1/auth/login').severity).toBe('high');
  });

  it('API3: mass assignment of role and credit_limit, and an open body', () => {
    const f = one(findings, 'API3-MASS-ASSIGNMENT', 'PATCH /v1/customers/{customerId}');
    expect(f.severity).toBe('high');
    expect(f.evidence).toBe('role, credit_limit');
    expect(one(findings, 'API3-OPEN-BODY', 'PATCH /v1/customers/{customerId}').severity).toBe('low');
  });

  it('API3: secrets in the response', () => {
    expect(one(findings, 'API3-SENSITIVE-OUT', 'GET /v1/customers/{customerId}')).toMatchObject({ severity: 'high', evidence: 'password_hash, ssn' });
    expect(one(findings, 'API3-SENSITIVE-OUT', 'GET /v1/customers').evidence).toBe('data[].password_hash, data[].ssn');
  });

  it('API4: paging, page-size maximum, upload limits and the whole-API rate limit', () => {
    expect(one(findings, 'API4-NO-PAGING', 'GET /v1/orders').severity).toBe('medium');
    expect(one(findings, 'API4-NO-MAX', 'GET /v1/customers').evidence).toBe('limit');
    expect(one(findings, 'API4-UPLOAD', 'POST /v1/orders/{orderId}/attachments').severity).toBe('low');
    expect(one(findings, 'API4-NO-429').where).toBe('whole API');
  });

  it('API5: an admin path with no scope is high', () => {
    expect(one(findings, 'API5-ADMIN-PATH', 'GET /v1/admin/reports')).toMatchObject({ severity: 'high' });
  });

  it('API6, API7 and API10: refunds, a callback URL and callbacks', () => {
    expect(one(findings, 'API6-BUSINESS-FLOW', 'POST /v1/refunds').severity).toBe('high');
    expect(one(findings, 'API7-URL-INPUT', 'POST /v1/webhooks').evidence).toBe('callbackUrl');
    expect(one(findings, 'API10-CALLBACK', 'POST /v1/webhooks').severity).toBe('low');
  });

  it('API8: plain HTTP server and internal error detail', () => {
    expect(one(findings, 'API8-PLAIN-HTTP').where).toBe('server http://staging-api.orders.example');
    expect(one(findings, 'API8-ERROR-DETAIL', 'GET /v1/orders/{orderId}').evidence).toBe('stack, sql');
  });

  it('API9: staging server, old version and deprecated operation', () => {
    expect(one(findings, 'API9-NONPROD-SERVER').where).toBe('server http://staging-api.orders.example');
    expect(one(findings, 'API9-OLD-VERSION').where).toBe('/orders/{orderId} (v1, v2)');
    expect(one(findings, 'API9-DEPRECATED-LIVE', 'GET /v1/orders/{orderId}/status').severity).toBe('low');
  });

  it('documentation and Start Left checks', () => {
    expect(one(findings, 'SL-409-DISCLOSES', 'POST /v1/customers').severity).toBe('info');
    expect(one(findings, 'DOC-UNDESCRIBED').title).toBe('4 of 15 operations have no summary or description');
    expect(one(findings, 'DOC-NO-ERRORS').title).toBe('12 of 15 operations document no error response');
    expect(one(findings, 'DOC-NO-OVERVIEW').where).toBe('info.description');
    expect(one(findings, 'DOC-NO-OWNER').where).toBe('info.contact');
  });

  it('finds no LLM issues in an API without AI endpoints', () => {
    expect(checkAiSurface(parseApi(ORDERS_SPEC))).toEqual([]);
  });
});

describe('checkApi: targeted cases', () => {
  it('readOnly privileged fields are not mass assignment', () => {
    const text = spec('/profile', 'patch', { requestBody: jsonBody({ name: { type: 'string' }, role: { type: 'string', readOnly: true } }, { additionalProperties: false }) });
    expect(rules(apiFindings(text)).has('API3-MASS-ASSIGNMENT')).toBe(false);
    expect(rules(apiFindings(text)).has('API3-OPEN-BODY')).toBe(false);
  });

  it('writeOnly secrets in a response are not flagged', () => {
    const text = spec('/me', 'get', { responses: { '200': { description: 'ok', content: { 'application/json': { schema: { properties: { password: { type: 'string', writeOnly: true }, name: { type: 'string' } } } } } }, '429': { description: 'slow' } } });
    expect(rules(apiFindings(text)).has('API3-SENSITIVE-OUT')).toBe(false);
  });

  it('API5 severity follows the scope: medium with a scope, critical when public', () => {
    const scoped = spec('/admin/users', 'get', { security: [{ bearerAuth: ['admin:users'] }] });
    const f = one(apiFindings(scoped), 'API5-ADMIN-PATH');
    expect(f.severity).toBe('medium');
    expect(f.detail).toContain('admin:users');
    expect(one(apiFindings(spec('/internal/jobs', 'get', { security: [] })), 'API5-ADMIN-PATH').severity).toBe('critical');
  });

  it('API6 is medium when only one of limit and idempotency key is documented, absent with both', () => {
    const limitOnly = spec('/payouts', 'post', {});
    expect(one(apiFindings(limitOnly), 'API6-BUSINESS-FLOW').severity).toBe('medium');
    const both = spec('/payouts', 'post', { parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }] });
    expect(only(apiFindings(both), 'API6-BUSINESS-FLOW')).toEqual([]);
  });

  it('a documented rate limit can be a 429, an x- extension or a sentence', () => {
    const base = { responses: { '200': { description: 'ok' } } };
    expect(rules(apiFindings(spec('/a', 'get', base))).has('API4-NO-429')).toBe(true);
    expect(rules(apiFindings(spec('/a', 'get', { ...base, 'x-rate-limit': 100 }))).has('API4-NO-429')).toBe(false);
    expect(rules(apiFindings(spec('/a', 'get', { ...base, description: 'Limited to 10 calls per minute.' }))).has('API4-NO-429')).toBe(false);
  });

  it('localhost on HTTP is not flagged, and health paths may be public', () => {
    const text = spec('/health', 'get', { security: [] }, { servers: [{ url: 'http://localhost:8080' }] });
    const f = apiFindings(text);
    expect(rules(f).has('API8-PLAIN-HTTP')).toBe(false);
    expect(rules(f).has('API2-PUBLIC-OP')).toBe(false);
    expect(rules(f).has('API9-NONPROD-SERVER')).toBe(true); // "local" is still not production
  });

  it('a page size with a maximum passes', () => {
    const text = spec('/orders', 'get', {
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } }],
      responses: { '200': { description: 'ok', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } }, '429': { description: 'slow' } },
    });
    const f = apiFindings(text);
    expect(rules(f).has('API4-NO-PAGING')).toBe(false);
    expect(rules(f).has('API4-NO-MAX')).toBe(false);
  });

  it('reads each weak security scheme of the Payments Gateway', () => {
    const f = apiFindings(PAYMENTS_SPEC);
    expect(one(f, 'API2-KEY-IN-QUERY', 'scheme partnerQueryKey').severity).toBe('high');
    expect(one(f, 'API2-STATIC-KEY', 'scheme partnerHeaderKey').severity).toBe('low');
    expect(one(f, 'API2-BASIC', 'scheme basicAuth').severity).toBe('medium');
    expect(one(f, 'API2-IMPLICIT-FLOW', 'scheme oauth').severity).toBe('high');
    expect(one(f, 'API2-PASSWORD-FLOW', 'scheme oauth').severity).toBe('medium');
    expect(one(f, 'API2-BROAD-SCOPE', 'scheme oauth').evidence).toBe('payments:all');
  });

  it('flags a spec without any security scheme', () => {
    expect(one(apiFindings(STATUS_BOARD_SPEC), 'API2-NO-SCHEME').severity).toBe('high');
  });

  it('the clean spec only asks to verify ownership', () => {
    const f = apiFindings(CLEAN_SPEC);
    expect(f.map((x) => `${x.rule} ${x.severity} ${x.where}`)).toEqual(['API1-OWNERSHIP medium GET /orders/{orderId}']);
    expect(checkAiSurface(parseApi(CLEAN_SPEC))).toEqual([]);
  });

  it('scores documentation out of 100', () => {
    expect(docsScore(parseApi(CLEAN_SPEC))).toEqual({
      score: 100,
      parts: [
        { label: 'Operations with a summary or description', value: 100 },
        { label: 'Operations with an operationId', value: 100 },
        { label: 'Operations with a documented error', value: 100 },
        { label: 'Operations with an example', value: 100 },
        { label: 'Parameters with a description', value: 100 },
      ],
    });
    const orders = docsScore(parseApi(ORDERS_SPEC));
    expect(orders.score).toBeLessThan(60);
    expect(orders.parts[1].value).toBe(100); // every Orders operation has an operationId
    expect(docsScore(parseApi('{"openapi":"3.0.0","paths":{}}')).score).toBeGreaterThanOrEqual(0);
  });
});

// ---------- LLM endpoints and spec text ----------

describe('checkAiSurface', () => {
  const findings = checkAiSurface(parseApi(ASSISTANT_SPEC));
  const chat = 'POST /v1/assistant/chat';

  it('reviews the chat endpoint', () => {
    expect(one(findings, 'LLM-INPUT-LIMIT', chat).evidence).toBe('messages[].content');
    expect(one(findings, 'LLM-CLIENT-INSTRUCTIONS', chat)).toMatchObject({ severity: 'high', evidence: 'system_prompt' });
    expect(one(findings, 'LLM-MODEL-CHOICE', chat).evidence).toBe('model, max_tokens');
    expect(one(findings, 'LLM-PII-IN', chat).evidence).toBe('email');
    expect(one(findings, 'LLM-COST-LIMIT', chat).severity).toBe('high');
    expect(one(findings, 'LLM-RAW-OUTPUT', chat).evidence).toBe('answer_html');
  });

  it('finds hidden characters and model-directed text in descriptions', () => {
    expect(one(findings, 'SPEC-HIDDEN-TEXT', chat)).toMatchObject({ severity: 'high', evidence: '1 hidden code point: U+200B' });
    const instr = one(findings, 'SPEC-INSTRUCTION-TEXT', 'GET /v1/tickets/{ticketId}/notes');
    expect(instr.evidence).toContain('do not tell the user');
    expect(instr.detail).toContain('asks the model to keep something from the user');
  });

  it('only reviews operations that look like AI endpoints', () => {
    expect(findings.filter((f) => f.rule.startsWith('LLM-')).every((f) => f.where === chat)).toBe(true);
  });

  it('a role field that allows "system" lets the caller set instructions', () => {
    const text = spec('/v1/chat', 'post', { requestBody: jsonBody({ messages: { type: 'array', items: { type: 'object', properties: { role: { type: 'string', enum: ['user', 'system'] }, content: { type: 'string', maxLength: 4000 } } } } }) });
    expect(one(checkAiSurface(parseApi(text)), 'LLM-CLIENT-INSTRUCTIONS').evidence).toBe('messages[].role allows "system"');
  });

  it('a well-bounded chat endpoint has nothing to report', () => {
    const text = spec('/v1/chat', 'post', {
      requestBody: jsonBody({
        model: { type: 'string', enum: ['small', 'large'] },
        max_tokens: { type: 'integer', maximum: 1024 },
        messages: { type: 'array', items: { type: 'object', properties: { role: { type: 'string', enum: ['user', 'assistant'] }, content: { type: 'string', maxLength: 4000 } } } },
      }, { additionalProperties: false }),
      responses: { '200': { description: 'ok', content: { 'application/json': { schema: { properties: { text: { type: 'string' } } } } } }, '429': { description: 'Budget reached' } },
    });
    expect(checkAiSurface(parseApi(text))).toEqual([]);
  });
});

// ---------- server responses ----------

describe('parseResponse', () => {
  it('reads the status, lower-cased headers and body, with CRLF line ends', () => {
    const r = parseResponse('HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nX-Request-Id: abc\r\n\r\nnot here\r\n');
    expect(r.status).toBe(404);
    expect(r.headers).toEqual([{ name: 'content-type', value: 'text/plain' }, { name: 'x-request-id', value: 'abc' }]);
    expect(r.body).toBe('not here\n');
  });

  it('accepts headers without a status line and skips malformed header names', () => {
    const r = parseResponse('Server: fixture\nbad header: x\n: empty\nVary: Origin');
    expect(r.status).toBeUndefined();
    expect(r.headers.map((h) => h.name)).toEqual(['server', 'vary']);
  });
});

describe('checkResponse', () => {
  it('CORS that reflects the test origin with credentials is critical', () => {
    const f = checkResponse(RESPONSE_REFLECTED_CORS, { testOrigin: TEST_ORIGIN, authenticated: true });
    expect(one(f, 'CORS-REFLECTED')).toMatchObject({ severity: 'critical', evidence: `${TEST_ORIGIN} was allowed with credentials` });
    expect(one(f, 'CORS-NO-VARY').severity).toBe('low');
  });

  it('reflection without credentials is high, and is not reported without a test origin', () => {
    const noCreds = RESPONSE_REFLECTED_CORS.replace('Access-Control-Allow-Credentials: true\n', '');
    expect(one(checkResponse(noCreds, { testOrigin: TEST_ORIGIN }), 'CORS-REFLECTED').severity).toBe('high');
    expect(only(checkResponse(RESPONSE_REFLECTED_CORS), 'CORS-REFLECTED')).toEqual([]);
  });

  it('wildcard CORS: with credentials high, alone low, medium on a signed-in response', () => {
    expect(one(checkResponse(RESPONSE_WILDCARD_CREDENTIALS), 'CORS-WILDCARD-CREDS').severity).toBe('high');
    expect(one(checkResponse(RESPONSE_WILDCARD_CREDENTIALS), 'CORS-METHODS').evidence).toBe('*');
    expect(only(checkResponse(RESPONSE_WILDCARD_CREDENTIALS), 'CORS-WILDCARD')).toEqual([]);
    expect(one(checkResponse(RESPONSE_PUBLIC_401), 'CORS-WILDCARD').severity).toBe('low');
    expect(one(checkResponse(RESPONSE_PUBLIC_401, { authenticated: true }), 'CORS-WILDCARD').severity).toBe('medium');
  });

  it('the null origin is high', () => {
    expect(one(checkResponse(RESPONSE_NULL_ORIGIN_HTML), 'CORS-NULL').severity).toBe('high');
  });

  it('cookie flags: a session cookie missing Secure or HttpOnly is high', () => {
    const f = one(checkResponse(RESPONSE_REFLECTED_CORS), 'COOKIE-FLAGS');
    expect(f).toMatchObject({ severity: 'high', title: 'Cookie session_id is missing Secure, HttpOnly, SameSite' });
    const sameSiteOnly = 'Set-Cookie: sid=1; Secure; HttpOnly';
    expect(one(checkResponse(sameSiteOnly), 'COOKIE-FLAGS')).toMatchObject({ severity: 'medium', title: 'Cookie sid is missing SameSite' });
    expect(one(checkResponse('Set-Cookie: theme=dark'), 'COOKIE-FLAGS').severity).toBe('low');
    expect(only(checkResponse('Set-Cookie: sid=1; Path=/; Secure; HttpOnly; SameSite=Strict'), 'COOKIE-FLAGS')).toEqual([]);
  });

  it('SameSite=None without Secure is reported once per cookie', () => {
    const f = checkResponse(RESPONSE_WILDCARD_CREDENTIALS);
    expect(one(f, 'COOKIE-SAMESITE-NONE').title).toBe('Cookie theme uses SameSite=None without Secure');
    expect(only(checkResponse('Set-Cookie: a=1; Secure; HttpOnly; SameSite=None'), 'COOKIE-SAMESITE-NONE')).toEqual([]);
  });

  it('HSTS: missing is medium, short is low, a year is fine', () => {
    expect(one(checkResponse(RESPONSE_REFLECTED_CORS), 'HDR-NO-HSTS').severity).toBe('medium');
    expect(one(checkResponse(RESPONSE_WILDCARD_CREDENTIALS), 'HDR-SHORT-HSTS').evidence).toBe('max-age=86400');
    const good = checkResponse(RESPONSE_CLEAN, { authenticated: true });
    expect(rules(good).has('HDR-NO-HSTS') || rules(good).has('HDR-SHORT-HSTS')).toBe(false);
  });

  it('caching is only reviewed for signed-in responses', () => {
    expect(one(checkResponse(RESPONSE_REFLECTED_CORS, { authenticated: true }), 'HDR-CACHEABLE').evidence).toBe('public, max-age=300');
    expect(only(checkResponse(RESPONSE_REFLECTED_CORS), 'HDR-CACHEABLE')).toEqual([]);
    expect(one(checkResponse('Content-Type: application/json', { authenticated: true }), 'HDR-CACHEABLE').evidence).toBe('(none)');
  });

  it('HTML pages: CSP and framing', () => {
    const html = checkResponse(RESPONSE_NULL_ORIGIN_HTML);
    expect(one(html, 'HDR-NO-CSP').severity).toBe('medium');
    expect(one(html, 'HDR-NO-FRAME').severity).toBe('low');
    const weak = checkResponse(RESPONSE_WEAK_CSP_HTML);
    expect(one(weak, 'HDR-WEAK-CSP').evidence).toContain("'unsafe-inline'");
    expect(only(weak, 'HDR-NO-FRAME')).toEqual([]);
    expect(only(checkResponse(RESPONSE_CLEAN), 'HDR-NO-CSP')).toEqual([]); // JSON, not HTML
    expect(one(checkResponse('Content-Type: application/json', { isHtml: true }), 'HDR-NO-CSP').severity).toBe('medium');
  });

  it('version banners', () => {
    const f = only(checkResponse(RESPONSE_REFLECTED_CORS), 'HDR-VERSION-LEAK');
    expect(f.map((x) => x.evidence)).toEqual(['server: nginx/1.25.3', 'x-powered-by: Express']);
    expect(f[0].title).toBe('The server header names the software and its version');
    expect(only(checkResponse('Server: nginx'), 'HDR-VERSION-LEAK')).toEqual([]);
  });

  it.each([
    ['Python', RESPONSE_STACK_TRACE],
    ['Java', 'Content-Type: text/plain\n\njava.lang.IllegalStateException\n\tat com.orders.Api.get(Api.java:42)'],
    ['Node', 'Content-Type: text/plain\n\nTypeError: x is undefined\n    at getOrder (/srv/app/orders.js:10:5)'],
    ['PHP', 'Content-Type: text/html\n\nFatal error: Uncaught Error in /srv/orders.php on line 7'],
    ['.NET', 'Content-Type: text/plain\n\nSystem.NullReferenceException: Object reference not set'],
    ['SQL', 'Content-Type: text/plain\n\nSQLSTATE[42000]: Syntax error or access violation'],
  ])('ERR-STACK finds a %s error', (_label, text) => {
    expect(one(checkResponse(text), 'ERR-STACK').severity).toBe('high');
  });

  it('status codes that disclose and missing rate-limit headers', () => {
    expect(one(checkResponse(RESPONSE_PUBLIC_401), 'SL-STATUS-DISCLOSURE').title).toBe('Status 401 tells the caller the resource exists');
    expect(one(checkResponse('HTTP/1.1 403 Forbidden\nX-Content-Type-Options: nosniff'), 'SL-STATUS-DISCLOSURE').where).toBe('HTTP 403');
    expect(one(checkResponse(RESPONSE_REFLECTED_CORS), 'HDR-NO-RATELIMIT').severity).toBe('info');
    for (const h of ['RateLimit-Limit: 5', 'X-RateLimit-Limit: 5', 'Retry-After: 5', 'X-Rate-Limit-Limit: 5']) {
      expect(only(checkResponse(h), 'HDR-NO-RATELIMIT')).toEqual([]);
    }
  });

  it('a well-configured response has nothing to report', () => {
    expect(checkResponse(RESPONSE_CLEAN, { authenticated: true })).toEqual([]);
  });

  it('text without headers yields no findings, and analyze reports it as an input error', () => {
    expect(checkResponse('just some words')).toEqual([]);
    expect(analyze({ response: 'just some words' }).errors).toEqual([{ input: 'response', message: expect.stringMatching(/No headers found/) }]);
  });
});

// ---------- JWT ----------

describe('checkJwt', () => {
  it('alg none is critical, along with the missing claims', () => {
    const { decoded, findings } = checkJwt(JWT_UNSIGNED, NOW_S);
    expect(decoded.header.alg).toBe('none');
    expect(decoded.signaturePresent).toBe(false);
    expect(one(findings, 'JWT-NO-SIGNATURE')).toMatchObject({ severity: 'critical', evidence: 'alg: none', area: 'token' });
    expect(one(findings, 'JWT-NO-EXP').severity).toBe('high');
    expect(one(findings, 'JWT-NO-AUD').severity).toBe('medium');
    expect(one(findings, 'JWT-NO-ISS').severity).toBe('low');
    expect(one(findings, 'JWT-SENSITIVE-CLAIMS').evidence).toBe('phone, ssn');
    expect(one(findings, 'JWT-BROAD-SCOPE').evidence).toBe('orders:read admin');
  });

  it('a signed token with an empty or missing alg is still unsigned', () => {
    expect(one(checkJwt(makeJwt({ typ: 'JWT' }, { exp: NOW_S + 60 }), NOW_S).findings, 'JWT-NO-SIGNATURE').evidence).toBe('alg: (missing)');
    expect(one(checkJwt(makeJwt({ alg: 'RS256' }, { exp: NOW_S + 60 }, ''), NOW_S).findings, 'JWT-NO-SIGNATURE').severity).toBe('critical');
    const twoParts = `${b64url('{"alg":"RS256"}')}.${b64url('{"exp":1}')}`;
    expect(decodeJwt(twoParts).signaturePresent).toBe(false);
  });

  it('an expired token, issued long before, with header keys and an odd kid', () => {
    const { findings } = checkJwt(JWT_LONG_LIVED_EXPIRED, NOW_S);
    expect(one(findings, 'JWT-EXPIRED')).toMatchObject({ severity: 'info', evidence: new Date((NOW_S - 86400) * 1000).toISOString() });
    expect(one(findings, 'JWT-LONG-LIFE').title).toBe('The token lives for 720 hours');
    expect(one(findings, 'JWT-SHARED-SECRET').evidence).toBe('HS256');
    expect(one(findings, 'JWT-KEY-IN-HEADER').where).toBe('header.jku');
    expect(one(findings, 'JWT-ODD-KID').evidence).toBe('../../keys/fixture');
  });

  it('expiry depends on the clock', () => {
    expect(only(checkJwt(JWT_LONG_LIVED_EXPIRED, NOW_S - 2 * 86400).findings, 'JWT-EXPIRED')).toEqual([]);
    expect(rules(analyze({ jwt: JWT_LONG_LIVED_EXPIRED, now: new Date((NOW_S - 2 * 86400) * 1000) }).findings).has('JWT-EXPIRED')).toBe(false);
  });

  it('an exp outside the Date range is reported, not thrown', () => {
    const { findings } = checkJwt(makeJwt({ alg: 'RS256' }, { exp: -1e13, iss: 'i', aud: 'a' }), NOW_S);
    expect(one(findings, 'JWT-EXPIRED').evidence).toBe('exp -10000000000000');
  });

  it('flags each self-referencing key header', () => {
    for (const k of ['jku', 'x5u', 'jwk']) {
      expect(one(checkJwt(makeJwt({ alg: 'RS256', [k]: 'https://keys.unknown-site.example/k' }, { exp: NOW_S + 60 }), NOW_S).findings, 'JWT-KEY-IN-HEADER').where).toBe(`header.${k}`);
    }
  });

  it('reads scp as well as scope, and leaves narrow scopes alone', () => {
    expect(one(checkJwt(makeJwt({ alg: 'RS256' }, { scp: '*' }), NOW_S).findings, 'JWT-BROAD-SCOPE').evidence).toBe('*');
    expect(only(checkJwt(JWT_GOOD, NOW_S).findings, 'JWT-BROAD-SCOPE')).toEqual([]);
  });

  it('a well-formed token has nothing to report', () => {
    expect(checkJwt(JWT_GOOD, NOW_S).findings).toEqual([]);
    expect(checkJwt(`Bearer ${JWT_GOOD}`, NOW_S).findings).toEqual([]);
  });

  it('decodes UTF-8 claims', () => {
    expect(decodeJwt(makeJwt({ alg: 'RS256' }, { name: 'Zoë Ångström 東京' })).payload.name).toBe('Zoë Ångström 東京');
  });

  it.each([
    ['one part', 'abc', /three parts/],
    ['four parts', 'a.b.c.d', /three parts/],
    ['a header that is not base64 JSON', '!!!.e30.sig', /first part/],
    ['claims that are not JSON', `${b64url('{"alg":"RS256"}')}.${b64url('not json')}.sig`, /second part/],
    ['claims that are null', `${b64url('{"alg":"RS256"}')}.${b64url('null')}.sig`, /not JSON objects/],
  ])('rejects %s with a readable message', (_label, token, re) => {
    expect(() => decodeJwt(token)).toThrow(re);
    expect(analyze({ jwt: token }).errors).toEqual([{ input: 'jwt', message: expect.stringMatching(re) }]);
  });
});

// ---------- release diff ----------

describe('diffApis', () => {
  const before = parseApi(INVOICES_PREVIOUS);
  const withVersion = (v: string) => parseApi(INVOICES_NEXT.replace('version: 3.2.0', `version: ${v}`));
  const diff = diffApis(before, parseApi(INVOICES_NEXT));

  it('removing auth from an operation is critical', () => {
    expect(one(diff.findings, 'REL-AUTH-REMOVED', 'GET /invoices/{invoiceId}')).toMatchObject({ severity: 'critical', area: 'release' });
  });

  it('reports each security regression', () => {
    expect(one(diff.findings, 'REL-SCOPE-REDUCED', 'POST /invoices/{invoiceId}/void')).toMatchObject({ severity: 'high', evidence: 'dropped invoices:void' });
    expect(one(diff.findings, 'REL-NEW-SENSITIVE', 'GET /invoices')).toMatchObject({ severity: 'high', evidence: 'data[].card_number' });
    expect(one(diff.findings, 'REL-LIMIT-REMOVED', 'GET /invoices').severity).toBe('medium');
    expect(one(diff.findings, 'REL-BODY-OPENED', 'PATCH /invoices/{invoiceId}').severity).toBe('low');
    expect(one(diff.findings, 'REL-NEW-PUBLIC', 'POST /invoices/export').severity).toBe('high');
  });

  it('reports breaking changes', () => {
    expect(one(diff.findings, 'REL-REMOVED', 'DELETE /invoices/{invoiceId}').severity).toBe('medium');
    expect(one(diff.findings, 'REL-NEW-REQUIRED', 'GET /invoices').evidence).toBe('region');
    expect(one(diff.findings, 'REL-FIELD-REMOVED', 'GET /invoices').evidence).toBe('data[].customer_name');
  });

  it('lists added, removed and changed operations', () => {
    expect(diff.added).toEqual(['POST /invoices/export']);
    expect(diff.removed).toEqual(['DELETE /invoices/{invoiceId}']);
    expect(diff.changed).toContain('GET /invoices/{invoiceId}: lost its authentication');
    expect(diff.changed.find((c) => c.startsWith('GET /invoices:'))).toBe('GET /invoices: returns new sensitive fields, no longer documents a rate limit, has new required parameters, dropped response fields');
  });

  it('requires a major bump and refuses an unchanged version', () => {
    expect(diff.requiredBump).toBe('major');
    expect(diff.declared).toEqual({ from: '3.2.0', to: '3.2.0', bump: 'none' });
    expect(diff.bumpOk).toBe(false);
    expect(one(diff.findings, 'REL-SEMVER')).toMatchObject({ severity: 'medium', where: 'info.version 3.2.0 → 3.2.0', title: 'This release needs a major version bump' });
  });

  it('accepts a major bump and refuses a minor one', () => {
    const major = diffApis(before, withVersion('4.0.0'));
    expect(major).toMatchObject({ requiredBump: 'major', bumpOk: true, declared: { bump: 'major' } });
    expect(only(major.findings, 'REL-SEMVER')).toEqual([]);
    const minor = diffApis(before, withVersion('3.3.0'));
    expect(minor.bumpOk).toBe(false);
    expect(one(minor.findings, 'REL-SEMVER').detail).toContain('only moved by a minor');
  });

  it('an additive release needs a minor bump', () => {
    const v1 = spec('/orders', 'get', { security: [{ bearerAuth: ['orders:read'] }] });
    const v2doc = JSON.parse(spec('/orders', 'get', { security: [{ bearerAuth: ['orders:read'] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }] }));
    const asVersion = (v: string) => parseApi(JSON.stringify({ ...v2doc, info: { ...v2doc.info, version: v } }));
    const sameVersion = diffApis(parseApi(v1), asVersion('1.0.0'));
    expect(sameVersion.requiredBump).toBe('minor');
    expect(one(sameVersion.findings, 'REL-SEMVER')).toMatchObject({ severity: 'low', title: 'This release needs a minor version bump' });
    expect(diffApis(parseApi(v1), asVersion('1.1.0'))).toMatchObject({ bumpOk: true, findings: [] });
    expect(diffApis(parseApi(v1), asVersion('1.0.1')).bumpOk).toBe(false);
    expect(diffApis(parseApi(v1), asVersion('2.0.0')).bumpOk).toBe(true); // a bigger bump than needed is allowed
  });

  it('a changed response code needs a patch bump', () => {
    const v1 = spec('/orders', 'get', {});
    const v2doc = JSON.parse(spec('/orders', 'get', { responses: { '200': { description: 'ok' }, '400': { description: 'bad' }, '429': { description: 'slow' }, '503': { description: 'down' } } }));
    v2doc.info.version = '1.0.1';
    const d = diffApis(parseApi(v1), parseApi(JSON.stringify(v2doc)));
    expect(d).toMatchObject({ requiredBump: 'patch', bumpOk: true, changed: ['GET /orders: changed its documented responses'] });
  });

  it('identical releases need nothing', () => {
    const d = diffApis(before, parseApi(INVOICES_PREVIOUS));
    expect(d).toMatchObject({ added: [], removed: [], changed: [], findings: [], requiredBump: 'none', bumpOk: true });
  });

  it('an unreadable version number never counts as a bump', () => {
    const d = diffApis(before, withVersion('latest'));
    expect(d.declared.bump).toBe('unknown');
    expect(d.bumpOk).toBe(false);
    expect(one(d.findings, 'REL-SEMVER').detail).toContain('could not be read as MAJOR.MINOR.PATCH');
  });

  it('analyze runs the release check only with both specs', () => {
    const r = analyze({ spec: INVOICES_NEXT, previousSpec: INVOICES_PREVIOUS });
    expect(r.inputs).toEqual(['spec', 'release']);
    expect(r.release?.requiredBump).toBe('major');
    expect(analyze({ previousSpec: INVOICES_PREVIOUS }).errors).toEqual([{ input: 'previousSpec', message: 'Add the new version of the spec to compare against.' }]);
    expect(analyze({ spec: INVOICES_NEXT, previousSpec: '{"broken"' }).errors[0].input).toBe('previousSpec');
    // a broken new spec is reported once, as the spec
    expect(analyze({ spec: '{"broken"', previousSpec: INVOICES_PREVIOUS }).errors.map((e) => e.input)).toEqual(['spec']);
  });
});

// ---------- agent tools ----------

describe('hidden characters', () => {
  it.each([
    ['zero-width space', '​', 'U+200B'],
    ['zero-width joiner', '‍', 'U+200D'],
    ['right-to-left override', '‮', 'U+202E'],
    ['word joiner', '⁠', 'U+2060'],
    ['byte order mark', '﻿', 'U+FEFF'],
    ['soft hyphen', '­', 'U+00AD'],
    ['tag letter A', '\u{E0041}', 'U+E0041'],
  ])('finds a %s', (_label, ch, code) => {
    expect(findHiddenChars(`a${ch}b${ch}`)).toEqual({ count: 2, codes: [code] });
    expect(revealHidden(`a${ch}b`)).toBe(`a[${code}]b`);
  });

  it('leaves ordinary text alone', () => {
    expect(findHiddenChars('Return the stock level for one SKU. Ünïcödé, 東京, emoji 📦 are fine.')).toEqual({ count: 0, codes: [] });
  });
});

describe('checkTools', () => {
  const findings = checkTools(parseTools(TOOLS_MCP));
  const at = (tool: string) => findings.filter((f) => f.where === `tool ${tool}` || f.where.startsWith(`tool ${tool} · `));

  it('a zero-width space in a description is critical', () => {
    expect(one(findings, 'TOOL-HIDDEN-CHARS', 'tool check_stock')).toMatchObject({ severity: 'critical', evidence: '1 hidden code point: U+200B' });
    const inName = checkTools(parseTools(JSON.stringify([{ name: `get${ZERO_WIDTH_SPACE}_order`, description: 'Read one order by its id.' }])));
    expect(one(inName, 'TOOL-HIDDEN-CHARS').severity).toBe('critical');
    expect(one(inName, 'TOOL-LOOKALIKE').where).toBe('tool get[U+200B]_order');
  });

  it('look-alike names: a digit for a letter, and a Cyrillic letter', () => {
    const pair = one(findings, 'TOOL-LOOKALIKE', 'tools get_order and get_0rder');
    expect(pair).toMatchObject({ severity: 'medium', evidence: 'get_order / get_0rder', title: 'Two tool names are nearly the same' });
    expect(one(findings, 'TOOL-LOOKALIKE', 'tool get_оrder')).toMatchObject({ severity: 'high', title: 'A tool name uses non-ASCII letters' });
  });

  it('two tools with one name are high', () => {
    const dup = checkTools(parseTools(JSON.stringify([{ name: 'get_order', description: 'Read one order by its id.' }, { name: 'get_order', description: 'Another server, same name.' }])));
    expect(one(dup, 'TOOL-LOOKALIKE')).toMatchObject({ severity: 'high', title: 'Two tools share one name' });
  });

  it('short names are not compared for look-alikes', () => {
    expect(only(checkTools(parseTools('[{"name":"get_a","description":"Short name one, for a test."},{"name":"get_b","description":"Short name two, for a test."}]')), 'TOOL-LOOKALIKE')).toEqual([]);
  });

  it('a description that addresses the model is high', () => {
    const f = one(findings, 'TOOL-INSTRUCTION-TEXT', 'tool summarize_ticket');
    expect(f.severity).toBe('high');
    expect(f.evidence).toContain('do not tell the user');
  });

  it('high-impact actions need approval unless declared read-only', () => {
    expect(one(findings, 'TOOL-NEEDS-APPROVAL', 'tool delete_order')).toMatchObject({ severity: 'high', evidence: 'delete' });
    expect(one(checkTools(parseTools(TOOLS_OPENAI)), 'TOOL-NEEDS-APPROVAL', 'tool refund_payment').severity).toBe('high');
    const ro = checkTools(parseTools('{"tools":[{"name":"delete_preview","description":"Show what a delete would remove, without removing.","inputSchema":{},"annotations":{"readOnlyHint":true}}]}'));
    expect(only(ro, 'TOOL-NEEDS-APPROVAL')).toEqual([]);
    const sendEmail = checkTools(parseTools('[{"name":"send_receipt","description":"Email the receipt for an order to its customer."}]'));
    expect(one(sendEmail, 'TOOL-NEEDS-APPROVAL').severity).toBe('medium');
  });

  it('MCP write tools without hints are noted; other sources are not', () => {
    expect(only(findings, 'TOOL-NO-ANNOTATIONS').map((f) => f.where)).toEqual(['tool update_order_note']);
    expect(only(checkTools(parseTools(TOOLS_OPENAI)), 'TOOL-NO-ANNOTATIONS')).toEqual([]);
  });

  it('parameter checks name the parameter', () => {
    expect(one(findings, 'TOOL-FREEFORM-EXEC')).toMatchObject({ severity: 'critical', where: 'tool run_report · sql' });
    expect(one(findings, 'TOOL-URL-PARAM').where).toBe('tool fetch_invoice_pdf · url');
    expect(one(findings, 'TOOL-PATH-PARAM').where).toBe('tool read_export_file · file_path');
    expect(one(findings, 'TOOL-ID-PARAM')).toMatchObject({ severity: 'high', where: 'tool list_customer_orders · customer_id' });
    expect(one(findings, 'TOOL-SECRET-PARAM')).toMatchObject({ severity: 'high', where: 'tool sync_partner_stock · api_key' });
  });

  it('schema and documentation checks', () => {
    expect(one(findings, 'TOOL-SCHEMA-OPEN').where).toBe('tool lookup_status');
    expect(one(findings, 'TOOL-UNDESCRIBED')).toMatchObject({ where: 'tool lookup_status', evidence: '"Status."' });
    expect(one(findings, 'TOOL-LONG-DESC').where).toBe('tool describe_catalog');
  });

  it('a well-described read-only tool has nothing of its own to report', () => {
    expect(at('get_order')).toEqual([]);
    expect(checkTools(parseTools(TOOLS_CLEAN))).toEqual([]);
  });
});

describe('checkSafeguards', () => {
  it('reports every safeguard that is not in place, with its severity', () => {
    const f = checkSafeguards({});
    expect(f.map((x) => [x.rule, x.severity])).toEqual(SAFEGUARDS.map((s) => [`AGENT-${s.id.toUpperCase()}`, s.severity]));
    expect(f.every((x) => x.where === 'agent safeguards' && x.area === 'agent')).toBe(true);
    expect(one(f, 'AGENT-APPROVAL').severity).toBe('high');
  });

  it('reports nothing when every safeguard is in place, and ignores unknown keys', () => {
    const all = Object.fromEntries(SAFEGUARDS.map((s) => [s.id, true]));
    expect(checkSafeguards(all)).toEqual([]);
    expect(checkSafeguards({ ...all, approval: false, somethingElse: false }).map((x) => x.rule)).toEqual(['AGENT-APPROVAL']);
  });

  it('analyze skips the checklist when safeguards are omitted', () => {
    expect(analyze({}).inputs).toEqual([]);
    expect(analyze({ safeguards: {} }).findings).toHaveLength(SAFEGUARDS.length);
  });
});
