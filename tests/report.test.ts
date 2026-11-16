import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, analyze, countBySeverity, failsGate, gradeFindings, sortFindings, type AnalyzeInput, type FullReport } from '../src/engine/report';
import { SEVERITY_ORDER, severityRank, type Finding, type Severity } from '../src/engine/types';
import {
  ASSISTANT_SPEC, CLEAN_SPEC, FIXTURE_NOW, INVOICES_NEXT, INVOICES_PREVIOUS, JWT_GOOD, NAMED_FIXTURES, ORDERS_SPEC,
  RESPONSE_REFLECTED_CORS, TOOLS_MCP, WAREHOUSE_SWAGGER, b64url, clean, stackTrace, weakCspHtml,
} from '../src/engine/fixtures';
import { prng } from './helpers';

const REPORTS = Object.entries(NAMED_FIXTURES).map(([name, input]) => [name, analyze(input)] as const);
const ALL_FINDINGS = REPORTS.flatMap(([, r]) => r.findings);

const letterFor = (score: number) => (score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F');

function finding(rule: string, severity: Severity, where = 'GET /x'): Finding {
  return { rule, severity, where, area: 'api', title: rule, detail: '', fix: '', refs: [] };
}

describe('grade', () => {
  it('gives the clean fixture an A with no critical or high finding', () => {
    const r = analyze(clean);
    expect(r.grade.letter).toBe('A');
    expect(r.grade.score).toBeGreaterThanOrEqual(90);
    expect(r.bySeverity.critical + r.bySeverity.high).toBe(0);
  });

  it('is 100 and A with no findings', () => {
    expect(gradeFindings([])).toEqual({ letter: 'A', score: 100 });
    expect(analyze({}).grade).toEqual({ letter: 'A', score: 100 });
  });

  it('caps the score at 59 when any finding is critical', () => {
    expect(gradeFindings([finding('X-ONE', 'critical')])).toEqual({ letter: 'D', score: 59 });
    for (const [name, r] of REPORTS) {
      if (r.bySeverity.critical) expect(r.grade.score, name).toBeLessThanOrEqual(59);
    }
    // many info findings never cost anything, one critical always does
    expect(gradeFindings(Array.from({ length: 50 }, (_, i) => finding(`X-${i}`, 'info'))).score).toBe(100);
  });

  it('keeps the letter consistent with the score', () => {
    for (const [name, r] of REPORTS) expect(r.grade.letter, name).toBe(letterFor(r.grade.score));
  });

  it('counts repeats of one rule less each time', () => {
    const one = gradeFindings([finding('X-A', 'high')]).score;
    const sameRule = gradeFindings([finding('X-A', 'high', 'a'), finding('X-A', 'high', 'b')]).score;
    const twoRules = gradeFindings([finding('X-A', 'high', 'a'), finding('X-B', 'high', 'b')]).score;
    expect(one).toBe(89); // one high finding costs about ten points
    expect(sameRule).toBeLessThan(one);
    expect(sameRule).toBeGreaterThan(twoRules);
  });

  it('never rises when findings are added', () => {
    const rand = prng(7);
    for (let round = 0; round < 200; round++) {
      const pool = [...ALL_FINDINGS].sort(() => rand() - 0.5);
      const subset = pool.filter(() => rand() < 0.3);
      const superset = subset.concat(pool.filter((f) => !subset.includes(f) && rand() < 0.3));
      expect(gradeFindings(superset).score).toBeLessThanOrEqual(gradeFindings(subset).score);
    }
    // one at a time, in a random order
    const order = [...ALL_FINDINGS].sort(() => rand() - 0.5);
    let last = 100;
    for (let i = 1; i <= order.length; i++) {
      const s = gradeFindings(order.slice(0, i)).score;
      expect(s).toBeLessThanOrEqual(last);
      last = s;
    }
  });

  it('does not depend on the order of the findings', () => {
    const rand = prng(11);
    for (const [, r] of REPORTS) {
      const shuffled = [...r.findings].sort(() => rand() - 0.5);
      expect(gradeFindings(shuffled)).toEqual(r.grade);
    }
  });
});

describe('failsGate', () => {
  const infoOnly = analyze({ response: 'HTTP/1.1 200 OK\nStrict-Transport-Security: max-age=31536000\nX-Content-Type-Options: nosniff' });
  const cases: [string, FullReport, Severity | null][] = [
    ['critical (Orders API)', analyze(NAMED_FIXTURES.ordersApi), 'critical'],
    ['high (stack trace)', analyze(stackTrace), 'high'],
    ['medium (clean)', analyze(clean), 'medium'],
    ['low (weak CSP)', analyze(weakCspHtml), 'low'],
    ['info only', infoOnly, 'info'],
    ['nothing', analyze({}), null],
  ];

  it.each(cases)('fails at or below the worst severity: %s', (_label, report, worst) => {
    expect(report.worst).toBe(worst);
    for (const level of SEVERITY_ORDER) {
      const expected = worst !== null && severityRank(worst) <= severityRank(level);
      expect(failsGate(report, level), `fail-on ${level}`).toBe(expected);
    }
    expect(failsGate(report, 'none')).toBe(false);
  });
});

describe('report shape', () => {
  it.each(REPORTS)('%s: findings sorted by severity, then rule, then place', (_name, r) => {
    for (let i = 1; i < r.findings.length; i++) {
      const a = r.findings[i - 1]; const b = r.findings[i];
      const bySev = severityRank(a.severity) - severityRank(b.severity);
      expect(bySev).toBeLessThanOrEqual(0);
      if (bySev === 0) {
        expect(a.rule.localeCompare(b.rule)).toBeLessThanOrEqual(0);
        if (a.rule === b.rule) expect(a.where.localeCompare(b.where)).toBeLessThanOrEqual(0);
      }
    }
    expect(sortFindings([...r.findings].reverse())).toEqual(r.findings);
  });

  it.each(REPORTS)('%s: counts, worst and metadata agree with the findings', (_name, r) => {
    expect(r.bySeverity).toEqual(countBySeverity(r.findings));
    expect(Object.values(r.bySeverity).reduce((a, b) => a + b, 0)).toBe(r.findings.length);
    expect(r.worst).toBe(r.findings[0]?.severity ?? null);
    expect(r.generatedAt).toBe(FIXTURE_NOW.toISOString());
    expect(r.engineVersion).toBe(ENGINE_VERSION);
    expect(r.docsScore === null).toBe(r.api === null);
    for (const f of r.findings) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.fix.length).toBeGreaterThan(0);
      expect(f.where.length).toBeGreaterThan(0);
      expect(Array.isArray(f.refs)).toBe(true);
    }
  });

  it('lists the inputs that were checked', () => {
    expect(analyze(clean).inputs).toEqual(['spec', 'response', 'token', 'tools', 'safeguards']);
    expect(analyze(NAMED_FIXTURES.invoicesRelease).inputs).toEqual(['spec', 'release']);
    expect(analyze(clean).toolCount).toBe(2);
    expect(analyze(clean).jwt?.header.alg).toBe('RS256');
  });

  it('does not change its input', () => {
    const input: AnalyzeInput = { spec: ORDERS_SPEC, previousSpec: ORDERS_SPEC, response: RESPONSE_REFLECTED_CORS, jwt: JWT_GOOD, tools: TOOLS_MCP, safeguards: { approval: true }, now: FIXTURE_NOW };
    const copy = { ...input, safeguards: { ...input.safeguards } };
    analyze(input);
    expect(input).toEqual(copy);
  });

  it('is deterministic for a fixed clock', () => {
    expect(analyze(NAMED_FIXTURES.ordersApi)).toEqual(analyze(NAMED_FIXTURES.ordersApi));
  });
});

describe('bad inputs', () => {
  it('land in errors, one per input, and never throw', () => {
    const r = analyze({ spec: 'paths: [', previousSpec: 'x', response: 'no headers here', jwt: 'not-a-token', tools: '{"tools": 5}' });
    expect(r.errors.map((e) => e.input)).toEqual(['spec', 'response', 'jwt', 'tools']);
    for (const e of r.errors) expect(e.message.length).toBeGreaterThan(5);
    expect(r.api).toBeNull();
    expect(r.inputs).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it('ignore inputs that are only whitespace', () => {
    expect(analyze({ spec: '  ', previousSpec: '\n', response: ' ', jwt: '\t', tools: '' })).toMatchObject({ errors: [], inputs: [] });
  });
});

// ---------- fuzz ----------

const VOCAB = [
  'openapi', 'swagger', 'info', 'title', 'version', 'description', 'contact', 'paths', '/a/{id}', '/v1/x', '/admin', 'get', 'post', 'patch', 'delete',
  'parameters', 'in', 'name', 'path', 'query', 'header', 'body', 'formData', 'required', 'schema', '$ref', '#/components/schemas/X', '#/', '#/paths',
  'components', 'schemas', 'X', 'securitySchemes', 'securityDefinitions', 'security', 'type', 'object', 'array', 'string', 'integer', 'items',
  'properties', 'allOf', 'oneOf', 'anyOf', 'requestBody', 'content', 'application/json', 'multipart/form-data', 'responses', '200', '404', '429',
  'default', 'servers', 'url', 'host', 'basePath', 'schemes', 'flows', 'implicit', 'scopes', 'tools', 'inputSchema', 'input_schema', 'function',
  'annotations', 'readOnlyHint', 'result', 'callbacks', 'deprecated', 'enum', 'maxLength', 'maximum', 'additionalProperties', 'readOnly',
  'writeOnly', 'format', 'binary', 'uri', 'x-rate-limit', '__proto__', 'constructor', 'prototype', 'role', 'password', 'system_prompt', 'messages',
  'alg', 'none', 'exp', 'iat', 'aud', 'kid', 'jku', 'scope', 'webhooks', '​', 'do not tell the user',
];
const SPECS = [ORDERS_SPEC, ASSISTANT_SPEC, CLEAN_SPEC, INVOICES_PREVIOUS, INVOICES_NEXT, WAREHOUSE_SWAGGER, TOOLS_MCP, RESPONSE_REFLECTED_CORS];

function generators(rand: () => number) {
  const int = (n: number) => Math.floor(rand() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)];
  const printable = (n: number) => Array.from({ length: n }, () => (rand() < 0.1 ? pick(['\n', '\t', ': ', '{', '}', '[', ']', '"', '.', '-', '#']) : String.fromCharCode(32 + int(95)))).join('');
  const bytes = (n: number) => Array.from({ length: n }, () => String.fromCharCode(int(0x10000))).join('');
  const number = () => pick(['0', '-1', '1e400', '-1e400', '1e-400', '9007199254740993', '-0', String(rand() * 1e6), '1.5']);
  function json(depth: number): string {
    const r = rand();
    if (depth > 5 || r < 0.25) return pick(['null', 'true', 'false', number(), JSON.stringify(pick(VOCAB)), JSON.stringify(printable(int(12)))]);
    if (r < 0.45) return `[${Array.from({ length: int(5) }, () => json(depth + 1)).join(',')}]`;
    return `{${Array.from({ length: int(6) }, () => `${JSON.stringify(pick(VOCAB))}:${json(depth + 1)}`).join(',')}}`;
  }
  const docLike = () => `{"openapi":"3.0.0","info":${json(3)},"paths":{"/a/{id}":{"get":${json(1)},"post":${json(1)},"parameters":${json(2)}}},"components":${json(1)},"security":${json(3)},"servers":${json(3)}}`;
  const toolsLike = () => `{"tools":[${Array.from({ length: 1 + int(4) }, () => `{"name":${JSON.stringify(pick(VOCAB))},"description":${JSON.stringify(printable(int(40)))},"inputSchema":${json(1)},"annotations":${json(3)}}`).join(',')}]}`;
  const truncated = () => { const s = pick(SPECS); return s.slice(0, int(s.length)); };
  const mutated = () => {
    const chars = [...pick(SPECS)];
    for (let k = 0; k < 1 + int(20); k++) {
      const at = int(chars.length);
      const op = int(3);
      if (op === 0) chars.splice(at, 1);
      else if (op === 1) chars.splice(at, 0, pick(['{', '}', ':', '\n', '  ', '-', '$ref', '*', '&a', '!!', '"', "'"]));
      else chars[at] = String.fromCharCode(32 + int(95));
    }
    return chars.join('');
  };
  const jwtLike = () => [b64url(json(2)), b64url(json(2)), rand() < 0.5 ? '' : printable(int(20)).replace(/\s/g, '')].slice(0, 2 + int(2)).join('.');
  const responseLike = () => {
    const names = ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Access-Control-Allow-Methods', 'Set-Cookie', 'Strict-Transport-Security', 'Content-Type', 'Content-Security-Policy', 'Server', 'Vary', 'Cache-Control', 'Retry-After'];
    const head = `HTTP/1.1 ${100 + int(500)} X`;
    const lines = Array.from({ length: int(12) }, () => `${pick(names)}: ${pick(['*', 'null', 'true', 'text/html', 'max-age=1', 'sid=1; SameSite=None', printable(int(30))])}`);
    return [head, ...lines, '', rand() < 0.5 ? printable(int(300)) : 'at a ('.repeat(int(50)) + ' at x (y.js:1:1)'].join(rand() < 0.5 ? '\n' : '\r\n');
  };
  return [
    () => printable(1 + int(400)),
    () => bytes(1 + int(400)),
    () => json(0),
    docLike,
    toolsLike,
    truncated,
    mutated,
    jwtLike,
    responseLike,
  ];
}

describe('fuzz: analyze() never throws', () => {
  it('returns a report for 300 random inputs through every input, each in under 2 s', () => {
    const rand = prng(20261116);
    const gens = generators(rand);
    const inputs = ['spec', 'previousSpec', 'response', 'jwt', 'tools', 'all'] as const;
    let slowest = 0;
    const reached: Record<string, number> = {};
    for (let i = 0; i < 300; i++) {
      const text = gens[i % gens.length]();
      for (const which of inputs) {
        const input: AnalyzeInput = which === 'all'
          ? { spec: text, previousSpec: text, response: text, jwt: text, tools: text, safeguards: {}, responseOptions: { testOrigin: '*', authenticated: true } }
          : which === 'previousSpec' ? { spec: CLEAN_SPEC, previousSpec: text } : { [which]: text, responseOptions: { testOrigin: text.slice(0, 20), authenticated: rand() < 0.5 } };
        const started = performance.now();
        let report: FullReport | undefined;
        try { report = analyze(input); } catch (e) {
          throw new Error(`analyze threw on case ${i} (${which}): ${(e as Error).message}\ninput: ${JSON.stringify(text.slice(0, 300))}`);
        }
        const took = performance.now() - started;
        slowest = Math.max(slowest, took);
        expect(took, `case ${i} (${which}) took ${Math.round(took)} ms`).toBeLessThan(2000);
        expect(Array.isArray(report.findings)).toBe(true);
        expect(['A', 'B', 'C', 'D', 'F']).toContain(report.grade.letter);
        for (const e of report.errors) {
          expect(['spec', 'previousSpec', 'response', 'jwt', 'tools']).toContain(e.input);
          expect(typeof e.message).toBe('string');
          expect(e.message.length).toBeGreaterThan(0);
        }
        // a report always serializes (no cycles, no BigInt)
        expect(() => JSON.stringify({ ...report, api: null })).not.toThrow();
        if (which !== 'all') {
          const accepted = report.errors.length === 0 ? 'ok' : 'error';
          reached[`${which}:${accepted}`] = (reached[`${which}:${accepted}`] ?? 0) + 1;
        }
      }
    }
    expect(slowest).toBeLessThan(2000);
    // the fuzz must exercise the checks, not only the parse errors
    for (const which of ['spec', 'previousSpec', 'response', 'jwt', 'tools']) {
      expect(reached[`${which}:ok`] ?? 0, `${which} never parsed`).toBeGreaterThan(5);
      expect(reached[`${which}:error`] ?? 0, `${which} never failed`).toBeGreaterThan(5);
    }
  }, 120_000);
});
