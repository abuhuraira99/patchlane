import type { ApiModel, Finding, OperationModel, SchemaField } from './types';
import { API_TOP10, COURSE } from './refs';

// Static checks on an OpenAPI model. A spec cannot prove a server is safe; each finding says
// what the spec shows and what to verify on the running API.

const OBJECT_ID = /(^id$|_id$|Id$|^uuid$|Uuid$|^(account|user|customer|order|invoice|card|loan|ticket|document|file|payment|refund|transaction|member|patient|org|tenant|project)(Number|No|Ref)?$)/i;
const SENSITIVE_OUT = /^(password|passwd|pass_?hash|password_?hash|hash|salt|secret|client_?secret|api_?key|apikey|access_?token|refresh_?token|token|otp|mfa_?secret|totp_?secret|pin|cvv|cvc|card_?number|pan|ssn|social_?security(_?number)?|tax_?id|national_?id|private_?key|security_?answer)$/i;
const PRIVILEGED_IN = /^(role|roles|is_?admin|admin|is_?staff|permissions?|scopes?|group|groups|privilege|access_?level|is_?verified|verified|email_?verified|kyc_?status|balance|credit|credit_?limit|price|amount_?paid|discount|status|approved|owner|owner_?id|user_?id|account_?id|tenant_?id|org_?id|plan|tier|is_?premium|limit|daily_?limit)$/i;
const URL_FIELD = /^(url|uri|link|href|callback(_?url)?|webhook(_?url)?|redirect(_?url|_?uri)?|return_?url|next|target|endpoint|image_?url|avatar_?url|feed(_?url)?|source(_?url)?|dest(ination)?(_?url)?|proxy|host)$/i;
const BUSINESS_FLOW = /(refund|payout|transfer|withdraw|payment|pay|checkout|purchase|order|redeem|coupon|voucher|gift|reward|points|vote|signup|sign-up|register|invite|reset|otp|verify|booking|reserve|ticket|bid|loan|credit|limit)/i;
const ADMIN_PATH = /\/(admin|internal|manage|management|staff|ops|backoffice|debug|actuator|system|root|superuser)(\/|$)/i;
const LOGIN_PATH = /(login|signin|sign-in|token|oauth|auth\/|session|password|otp|mfa|2fa)/i;
const PAGING = /^(limit|page_?size|per_?page|size|count|max|max_?results|top|first|take)$/i;
const ERROR_LEAK = /^(stack|stack_?trace|trace|traceback|exception|debug|sql|query|internal_?message|file|line)$/i;
const NON_PROD_HOST = /(dev|staging|stage|test|qa|uat|sandbox|preprod|pre-prod|internal|local)/i;

function isWrite(op: OperationModel): boolean {
  return op.method === 'post' || op.method === 'put' || op.method === 'patch' || op.method === 'delete';
}

function isPublic(op: OperationModel): boolean {
  // explicit [] or [{}] means public; null means nothing declared at all
  if (op.security === null) return true;
  return op.security.length === 0 || op.security.some((req) => Object.keys(req).length === 0);
}

function scopesOf(op: OperationModel): string[] {
  if (!op.security) return [];
  return [...new Set(op.security.flatMap((req) => Object.values(req).flat()))];
}

function documentsLimit(op: OperationModel): boolean {
  const ext = Object.keys(op.extensions).some((k) => /rate|throttl|limit|quota/.test(k));
  const text = `${op.summary ?? ''} ${op.description ?? ''}`;
  return op.responseCodes.includes('429') || ext || /rate.?limit|throttl|per (minute|hour|day)|quota/i.test(text);
}

function hasIdempotencyKey(op: OperationModel): boolean {
  return op.params.some((p) => p.in === 'header' && /idempotency|request-id|x-request-id/i.test(p.name));
}

function f(partial: Omit<Finding, 'refs'> & { refs?: Finding['refs'] }): Finding {
  return { refs: [], ...partial };
}

function fieldList(fields: SchemaField[], max = 4): string {
  const names = [...new Set(fields.map((x) => x.path))];
  return names.slice(0, max).join(', ') + (names.length > max ? ` and ${names.length - max} more` : '');
}

export function checkApi(api: ApiModel): Finding[] {
  const out: Finding[] = [];
  const ops = api.operations;

  // ---- servers and transport (API8, API9) ----
  for (const s of api.servers) {
    if (/^http:\/\//i.test(s) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(s)) {
      out.push(f({
        rule: 'API8-PLAIN-HTTP', area: 'api', severity: 'high', title: 'A server is listed on plain HTTP', where: `server ${s}`,
        detail: 'Tokens and response data cross the network unencrypted, so anyone on the path can read or change them.',
        fix: 'Serve only over HTTPS, redirect HTTP and send Strict-Transport-Security.',
        refs: [{ standard: API_TOP10.API8, course: COURSE.servers }],
      }));
    }
    if (NON_PROD_HOST.test(s.replace(/^https?:\/\//, '').split('/')[0])) {
      out.push(f({
        rule: 'API9-NONPROD-SERVER', area: 'inventory', severity: 'medium', title: 'A non-production server is in the public spec', where: `server ${s}`,
        detail: 'Staging and test hosts are often weaker than production and are easy to find once they appear in documentation.',
        fix: 'Publish production servers only, and keep staging behind the same authentication and gateway rules as production.',
        refs: [{ standard: API_TOP10.API9, course: COURSE.owasp }],
      }));
    }
  }

  // ---- security schemes (API2) ----
  if (!api.schemes.length) {
    out.push(f({
      rule: 'API2-NO-SCHEME', area: 'auth', severity: 'high', title: 'The spec defines no authentication scheme', where: 'components.securitySchemes',
      detail: 'Without a declared scheme, every operation reads as public and nobody can check which endpoints need a token.',
      fix: 'Declare the scheme (OAuth 2.0, OpenID Connect or bearer tokens) and apply it globally, opening only the endpoints meant to be public.',
      refs: [{ standard: API_TOP10.API2, course: COURSE.auth }],
    }));
  }
  for (const s of api.schemes) {
    if (s.type === 'apiKey' && s.in === 'query') {
      out.push(f({
        rule: 'API2-KEY-IN-QUERY', area: 'auth', severity: 'high', title: 'An API key travels in the query string', where: `scheme ${s.name}`,
        detail: 'Query strings end up in server logs, proxy logs, browser history and Referer headers, so the key leaks.',
        fix: 'Send the key in a header, or move to short-lived OAuth 2.0 access tokens.',
        refs: [{ standard: API_TOP10.API2, course: COURSE.auth }],
      }));
    }
    if (s.type === 'http' && s.scheme === 'basic') {
      out.push(f({
        rule: 'API2-BASIC', area: 'auth', severity: 'medium', title: 'HTTP Basic authentication sends the password on every call', where: `scheme ${s.name}`,
        detail: 'The same long-lived secret crosses the wire on every request and cannot be scoped or expired.',
        fix: 'Exchange the password once for a short-lived, scoped access token.',
        refs: [{ standard: API_TOP10.API2, course: COURSE.auth }],
      }));
    }
    if (s.type === 'apiKey' && s.in !== 'query') {
      out.push(f({
        rule: 'API2-STATIC-KEY', area: 'auth', severity: 'low', title: 'A static API key identifies the caller', where: `scheme ${s.name}`,
        detail: 'API keys are shared, copied and rarely rotated; they say which app is calling, not which user.',
        fix: 'Use per-user OAuth 2.0 tokens for user data, keep keys for app identification, and rotate them on a schedule.',
        refs: [{ standard: API_TOP10.API2, course: COURSE.startLeft }],
      }));
    }
    for (const [flow, def] of Object.entries(s.flows ?? {})) {
      if (flow === 'implicit') {
        out.push(f({
          rule: 'API2-IMPLICIT-FLOW', area: 'auth', severity: 'high', title: 'The OAuth implicit flow is allowed', where: `scheme ${s.name}`,
          detail: 'The implicit flow returns the access token in the URL fragment, where browser history and scripts can read it. OAuth 2.0 security guidance has deprecated it.',
          fix: 'Use the authorization code flow with PKCE.',
          refs: [{ standard: API_TOP10.API2, course: COURSE.auth }],
        }));
      }
      if (flow === 'password') {
        out.push(f({
          rule: 'API2-PASSWORD-FLOW', area: 'auth', severity: 'medium', title: 'The OAuth password grant is allowed', where: `scheme ${s.name}`,
          detail: 'The client handles the user\'s password directly, which defeats the point of delegated authorization.',
          fix: 'Use the authorization code flow with PKCE for users and client credentials for services.',
          refs: [{ standard: API_TOP10.API2, course: COURSE.auth }],
        }));
      }
      const scopes = Object.keys(def?.scopes ?? {});
      const broad = scopes.filter((sc) => /(^|[:._-])(\*|all|admin|full|root|write:\*|.*:all)$/i.test(sc) || sc === '*');
      if (broad.length) {
        out.push(f({
          rule: 'API2-BROAD-SCOPE', area: 'auth', severity: 'medium', title: 'A scope grants everything at once', where: `scheme ${s.name}`, evidence: broad.join(', '),
          detail: 'A token with an all-powerful scope turns any single leak into full access, and an agent holding it can do anything the API allows.',
          fix: 'Split scopes by resource and action (accounts:read, refunds:write) and give each client only what it needs.',
          refs: [{ standard: API_TOP10.API5, course: COURSE.auth }],
        }));
      }
    }
  }

  // ---- per operation ----
  const versions = new Map<string, Set<string>>();
  let undocumented = 0;
  let noErrors = 0;

  for (const op of ops) {
    const where = op.key;
    const pub = isPublic(op);
    const write = isWrite(op);
    const pathIds = op.params.filter((p) => p.in === 'path' && OBJECT_ID.test(p.name));
    const queryIds = op.params.filter((p) => p.in === 'query' && OBJECT_ID.test(p.name));
    const bodyIds = op.requestFields.filter((x) => !x.path.includes('.') && OBJECT_ID.test(x.name));
    const login = LOGIN_PATH.test(op.path);

    const vm = op.path.match(/\/v(\d+)(?=\/|$)/i);
    if (vm) {
      const rest = op.path.replace(/\/v\d+(?=\/|$)/i, '');
      if (!versions.has(rest)) versions.set(rest, new Set());
      versions.get(rest)!.add(vm[1]);
    }

    // API2: no auth
    if (pub && !login && !/health|status|ping|version|docs|openapi|\.well-known/i.test(op.path)) {
      out.push(f({
        rule: 'API2-PUBLIC-OP', area: 'auth', severity: write ? 'critical' : pathIds.length ? 'high' : 'medium',
        title: write ? 'A write operation needs no authentication' : 'An operation needs no authentication', where,
        detail: write
          ? 'Anyone on the internet can call this and change data. No security requirement applies to it.'
          : 'No security requirement applies, so anyone can call it. Confirm it is meant to be public.',
        fix: 'Apply the API\'s security scheme to this operation, or document why it is public.',
        refs: [{ standard: API_TOP10.API2, course: COURSE.owasp }],
      }));
    }

    // API1: object ids
    const ids = [...pathIds, ...queryIds];
    if (ids.length || (write && bodyIds.length)) {
      const names = [...ids.map((p) => p.name), ...bodyIds.map((b) => b.name)];
      const numeric = ids.some((p) => p.type === 'integer' || p.format === 'int64' || p.format === 'int32');
      out.push(f({
        rule: 'API1-OWNERSHIP', area: 'api',
        severity: pub ? 'critical' : write ? 'high' : numeric ? 'high' : 'medium',
        title: 'The caller picks which object to act on', where, evidence: [...new Set(names)].join(', '),
        detail: `The request names the object by ${[...new Set(names)].join(', ')}. Unless the server checks that this object belongs to the signed-in user, any user (or an agent acting for one) can read or change someone else's.${numeric ? ' The id is a number, so neighbouring ids are easy to guess.' : ''}`,
        fix: 'Check ownership on the server for every request, using the identity in the token, never an id the client sends. Return 404 for objects the caller does not own.',
        refs: [{ standard: API_TOP10.API1, course: COURSE.owasp }, { course: COURSE.startLeft }],
      }));
    }

    // API3: sensitive fields out, privileged fields in
    const leaks = op.responseFields.filter((x) => SENSITIVE_OUT.test(x.name) && !x.writeOnly);
    if (leaks.length) {
      out.push(f({
        rule: 'API3-SENSITIVE-OUT', area: 'api', severity: 'high', title: 'The response carries secrets or regulated data', where, evidence: fieldList(leaks),
        detail: `The response schema includes ${fieldList(leaks)}. Clients and agents receive more than they show, and an agent may repeat it in an answer.`,
        fix: 'Remove these fields from the response model, or mark them writeOnly. Return only the fields the client displays.',
        refs: [{ standard: API_TOP10.API3, course: COURSE.owasp }, { course: COURSE.startLeft }],
      }));
    }
    if (write && op.method !== 'delete') {
      const priv = op.requestFields.filter((x) => PRIVILEGED_IN.test(x.name) && !x.readOnly);
      if (priv.length) {
        out.push(f({
          rule: 'API3-MASS-ASSIGNMENT', area: 'api', severity: 'high', title: 'The request accepts fields a user should not set', where, evidence: fieldList(priv),
          detail: `Callers may send ${fieldList(priv)}. If the server binds the body straight onto its model, a user can raise their own role, limit or balance.`,
          fix: 'Accept an explicit allow-list of fields per operation; mark server-owned fields readOnly and ignore them on input.',
          refs: [{ standard: API_TOP10.API3, course: COURSE.pentest }],
        }));
      }
      if (op.requestAdditionalProps === true && op.requestFields.length) {
        out.push(f({
          rule: 'API3-OPEN-BODY', area: 'api', severity: 'low', title: 'The request body accepts unknown properties', where,
          detail: 'additionalProperties is not false, so extra fields pass schema validation and reach the server.',
          fix: 'Set additionalProperties: false on request bodies and validate against the schema at the gateway.',
          refs: [{ standard: API_TOP10.API3, course: COURSE.pentest }],
        }));
      }
    }

    // API4: paging and size limits
    if (op.method === 'get' && op.responseIsArray) {
      const paging = op.params.filter((p) => p.in === 'query' && PAGING.test(p.name));
      if (!paging.length) {
        out.push(f({
          rule: 'API4-NO-PAGING', area: 'api', severity: 'medium', title: 'A list endpoint has no page size parameter', where,
          detail: 'Without paging, one call can ask for every record, which is slow for the server and a fast way to copy data out.',
          fix: 'Add a limit parameter with a documented maximum and paginate by cursor.',
          refs: [{ standard: API_TOP10.API4, course: COURSE.owasp }],
        }));
      } else if (paging.every((p) => p.maximum === undefined)) {
        out.push(f({
          rule: 'API4-NO-MAX', area: 'api', severity: 'medium', title: 'The page size has no maximum', where, evidence: paging.map((p) => p.name).join(', '),
          detail: 'Callers choose the page size freely, so limit=1000000 returns everything at once.',
          fix: 'Declare a maximum on the parameter and enforce it on the server.',
          refs: [{ standard: API_TOP10.API4, course: COURSE.owasp }],
        }));
      }
    }
    if (op.requestHasBinary) {
      out.push(f({
        rule: 'API4-UPLOAD', area: 'api', severity: 'low', title: 'An upload has no documented size or type limit', where,
        detail: 'File uploads without limits let one caller fill storage or send a file type the parser should never see.',
        fix: 'Document and enforce the maximum size and the accepted content types; scan uploads before processing.',
        refs: [{ standard: API_TOP10.API4, course: COURSE.llm }],
      }));
    }
    if (login && (op.method === 'post' || op.method === 'put') && !documentsLimit(op)) {
      out.push(f({
        rule: 'API2-LOGIN-RATE', area: 'auth', severity: 'high', title: 'A sign-in or token endpoint shows no rate limit', where,
        detail: 'Credential endpoints without a limit allow password spraying and brute force against one account.',
        fix: 'Limit attempts per account and per IP, return 429 with Retry-After, and document it in the spec.',
        refs: [{ standard: API_TOP10.API2, course: COURSE.pentest }],
      }));
    }

    // API5: function-level authorization
    if (ADMIN_PATH.test(op.path)) {
      const scopes = scopesOf(op);
      out.push(f({
        rule: 'API5-ADMIN-PATH', area: 'api', severity: pub ? 'critical' : scopes.length ? 'medium' : 'high',
        title: 'An administrative function is in the same API', where,
        detail: scopes.length
          ? `It requires ${scopes.join(', ')}. Verify that ordinary users can never hold that scope.`
          : 'It requires no special scope, so the only thing between a normal user and this function is the URL.',
        fix: 'Require a dedicated admin role or scope, deny by default, and test the call with an ordinary user token.',
        refs: [{ standard: API_TOP10.API5, course: COURSE.owasp }],
      }));
    }

    // API6: sensitive business flows
    const flowText = `${op.path} ${op.operationId ?? ''}`;
    if (write && BUSINESS_FLOW.test(flowText) && !login) {
      const limited = documentsLimit(op);
      const idem = hasIdempotencyKey(op);
      if (!limited || !idem) {
        out.push(f({
          rule: 'API6-BUSINESS-FLOW', area: 'api', severity: !limited && !idem ? 'high' : 'medium',
          title: 'A sensitive business flow has no documented limit', where,
          detail: `${!limited ? 'No rate or volume limit is documented. ' : ''}${!idem ? 'No idempotency key is accepted, so a retried or replayed call repeats the action. ' : ''}Flows like this are abused by repeating them, not by breaking them.`,
          fix: 'Cap the flow per user per day in code, require an Idempotency-Key header, and alert on unusual volume.',
          refs: [{ standard: API_TOP10.API6, course: COURSE.owasp }, { course: COURSE.fundamentals }],
        }));
      }
    }

    // API7: SSRF
    const urlParams = [
      ...op.params.filter((p) => URL_FIELD.test(p.name) || p.format === 'uri' || p.format === 'url'),
      ...op.requestFields.filter((x) => URL_FIELD.test(x.name) || x.format === 'uri' || x.format === 'url'),
    ];
    if (urlParams.length) {
      out.push(f({
        rule: 'API7-URL-INPUT', area: 'api', severity: 'medium', title: 'The caller supplies a URL', where, evidence: urlParams.map((p) => p.name).join(', '),
        detail: 'If the server fetches this URL, a caller can point it at internal addresses such as cloud metadata services or admin panels.',
        fix: 'Allow-list the hosts and schemes the server may fetch, block private and link-local ranges after DNS resolution, and never return the raw response.',
        refs: [{ standard: API_TOP10.API7, course: COURSE.pentest }],
      }));
    }

    // API8: error detail
    const leaky = op.errorFields.filter((x) => ERROR_LEAK.test(x.name));
    if (leaky.length) {
      out.push(f({
        rule: 'API8-ERROR-DETAIL', area: 'api', severity: 'medium', title: 'Error responses carry internal detail', where, evidence: fieldList(leaky),
        detail: 'Stack traces, SQL and file paths in errors give an attacker a map of the server.',
        fix: 'Return a stable error code and a short message; keep detail in server logs under a correlation id.',
        refs: [{ standard: API_TOP10.API8, course: COURSE.servers }],
      }));
    }

    // Start Left: status codes that disclose
    if (op.method === 'post' && op.responseCodes.includes('409')) {
      out.push(f({
        rule: 'SL-409-DISCLOSES', area: 'docs', severity: 'info', title: '409 Conflict tells a caller the record exists', where,
        detail: 'On sign-up or create, 409 confirms that an email or name is already taken, which helps enumeration.',
        fix: 'Consider 422 with a neutral message, and write the choice into your API standards.',
        refs: [{ course: COURSE.startLeft }],
      }));
    }

    // API9: deprecated
    if (op.deprecated) {
      out.push(f({
        rule: 'API9-DEPRECATED-LIVE', area: 'inventory', severity: 'low', title: 'A deprecated operation is still published', where,
        detail: 'Deprecated endpoints keep their old behaviour and often miss the fixes the new version got.',
        fix: 'Publish a removal date (Sunset header), then remove the endpoint from the gateway, not only from the docs.',
        refs: [{ standard: API_TOP10.API9, course: COURSE.startLeft }],
      }));
    }
    if (op.callbacks) {
      out.push(f({
        rule: 'API10-CALLBACK', area: 'api', severity: 'low', title: 'The API calls back to URLs it is given', where,
        detail: 'Data sent to or received from third parties is trusted less carefully than your own.',
        fix: 'Sign callbacks, validate everything that comes back, and set timeouts and size limits.',
        refs: [{ standard: API_TOP10.API10, course: COURSE.owasp }],
      }));
    }

    if (!op.summary && !op.description) undocumented++;
    if (!op.responseCodes.some((c) => /^[45]/.test(c) || c === 'default')) noErrors++;
  }

  // ---- old versions still live (API9) ----
  for (const [rest, set] of versions) {
    if (set.size > 1) {
      const sorted = [...set].sort((a, b) => Number(a) - Number(b));
      out.push(f({
        rule: 'API9-OLD-VERSION', area: 'inventory', severity: 'medium', title: 'An older API version is still reachable', where: `${rest || '/'} (v${sorted.join(', v')})`,
        detail: `Version ${sorted.slice(0, -1).map((v) => 'v' + v).join(', ')} is still published beside v${sorted[sorted.length - 1]}. A fix made in the new version does nothing while the old one answers.`,
        fix: 'Set a removal date, tell registered consumers, then return 404 for the old version at the gateway.',
        refs: [{ standard: API_TOP10.API9, course: COURSE.devsecops }],
      }));
    }
  }

  // ---- whole-API checks ----
  const ratePlanned = ops.some(documentsLimit);
  if (ops.length && !ratePlanned) {
    out.push(f({
      rule: 'API4-NO-429', area: 'api', severity: 'medium', title: 'No operation documents a rate limit', where: 'whole API',
      detail: 'No 429 response, rate-limit extension or limit note appears anywhere in the spec.',
      fix: 'Rate-limit at the gateway per token and per IP, document the limits, and return 429 with Retry-After.',
      refs: [{ standard: API_TOP10.API4, course: COURSE.servers }],
    }));
  }
  if (ops.length && undocumented / ops.length > 0.2) {
    out.push(f({
      rule: 'DOC-UNDESCRIBED', area: 'docs', severity: 'low', title: `${undocumented} of ${ops.length} operations have no summary or description`, where: 'whole API',
      detail: 'Undocumented operations are the ones nobody reviews, and an agent picks tools by these descriptions.',
      fix: 'Give every operation a one-line summary and a description of who may call it and what it changes.',
      refs: [{ course: COURSE.docs }],
    }));
  }
  if (ops.length && noErrors / ops.length > 0.3) {
    out.push(f({
      rule: 'DOC-NO-ERRORS', area: 'docs', severity: 'low', title: `${noErrors} of ${ops.length} operations document no error response`, where: 'whole API',
      detail: 'Without documented errors, clients guess, and testers cannot tell a correct refusal from a bug.',
      fix: 'Document 400, 401 or 404, 403 where used, 422 and 429 with one shared error schema.',
      refs: [{ course: COURSE.docs }],
    }));
  }
  if (!api.description) {
    out.push(f({
      rule: 'DOC-NO-OVERVIEW', area: 'docs', severity: 'info', title: 'The spec has no overview', where: 'info.description',
      detail: 'Concept documentation (what the API is for, how auth works, the main flows) is missing.',
      fix: 'Add an overview to info.description covering purpose, authentication, rate limits and versioning.',
      refs: [{ course: COURSE.docs }],
    }));
  }
  if (!api.hasContact) {
    out.push(f({
      rule: 'DOC-NO-OWNER', area: 'inventory', severity: 'info', title: 'The spec names no owner', where: 'info.contact',
      detail: 'An API with no owner in its inventory entry is the one that stays live after everyone has forgotten it.',
      fix: 'Add info.contact with the owning team.',
      refs: [{ standard: API_TOP10.API9, course: COURSE.devsecops }],
    }));
  }

  return out;
}

/** A documentation score out of 100 from five measurable parts. */
export function docsScore(api: ApiModel): { score: number; parts: { label: string; value: number }[] } {
  const ops = api.operations;
  const n = Math.max(ops.length, 1);
  const pct = (k: number) => Math.round((k / n) * 100);
  const parts = [
    { label: 'Operations with a summary or description', value: pct(ops.filter((o) => o.summary || o.description).length) },
    { label: 'Operations with an operationId', value: pct(ops.filter((o) => o.operationId).length) },
    { label: 'Operations with a documented error', value: pct(ops.filter((o) => o.responseCodes.some((c) => /^[45]/.test(c) || c === 'default')).length) },
    { label: 'Operations with an example', value: pct(ops.filter((o) => o.hasExamples).length) },
    { label: 'Parameters with a description', value: (() => {
      const ps = ops.flatMap((o) => o.params);
      return ps.length ? Math.round((ps.filter((p) => p.description).length / ps.length) * 100) : 100;
    })() },
  ];
  const score = Math.round(parts.reduce((a, p) => a + p.value, 0) / parts.length);
  return { score, parts };
}
