import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { analyze, type FullReport } from '../src/engine/report';
import { gherkinScenario, locateInSpec, toGherkin, toJson, toMarkdown, toSarif, toWorkflow } from '../src/engine/exports';
import { ACTION_REF } from '../src/engine/meta';
import { SEVERITY_ORDER, severityRank, type Severity } from '../src/engine/types';
import {
  CLEAN_SPEC, FIXTURE_NOW, JWT_UNSIGNED, NAMED_FIXTURES, ORDERS_SPEC, PAYMENTS_SPEC, RESPONSE_REFLECTED_CORS, TEST_ORIGIN, TOOLS_MCP, clean,
} from '../src/engine/fixtures';

const everything = (now = FIXTURE_NOW) => analyze({
  spec: ORDERS_SPEC,
  response: RESPONSE_REFLECTED_CORS,
  responseOptions: { testOrigin: TEST_ORIGIN, authenticated: true },
  jwt: JWT_UNSIGNED,
  tools: TOOLS_MCP,
  safeguards: {},
  now,
});

interface SarifLog {
  $schema: string;
  version: string;
  runs: {
    tool: { driver: { name: string; version: string; rules: { id: string; name: string; helpUri: string; shortDescription: { text: string }; defaultConfiguration: { level: string }; properties: { tags: string[]; 'security-severity': string } }[] } };
    results: { ruleId: string; ruleIndex: number; level: string; message: { text: string }; locations: { physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number } } }[]; partialFingerprints: Record<string, string>; properties: { severity: Severity } }[];
    invocations: { executionSuccessful: boolean }[];
  }[];
}

const LEVEL: Record<Severity, string> = { critical: 'error', high: 'error', medium: 'warning', low: 'note', info: 'note' };

/** 1-based line of `method:` under the path key, found by exact line text. */
function lineOf(text: string, pathLine: string, methodLine: string): number {
  const lines = text.split('\n');
  const p = lines.indexOf(pathLine);
  expect(p, `no line "${pathLine}"`).toBeGreaterThanOrEqual(0);
  const m = lines.indexOf(methodLine, p + 1);
  expect(m, `no line "${methodLine}" after ${p + 1}`).toBeGreaterThan(p);
  return m + 1;
}

describe('toSarif', () => {
  const report = everything();
  const files = { spec: 'api/orders.yaml', response: 'checks/response.txt' };
  const log = JSON.parse(toSarif(report, { files, specText: ORDERS_SPEC })) as SarifLog;
  const run = log.runs[0];

  it('is SARIF 2.1.0 with a schema', () => {
    expect(log.version).toBe('2.1.0');
    expect(log.$schema).toMatch(/^https:\/\/.+sarif-2\.1\.0.*\.json$/);
    expect(log.runs).toHaveLength(1);
    expect(run.tool.driver.name).toBe('Patchlane');
    expect(run.results).toHaveLength(report.findings.length);
    expect(run.invocations[0].executionSuccessful).toBe(true);
  });

  it('lists each rule once and points every result at its rule', () => {
    const ids = run.tool.driver.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(report.findings.map((f) => f.rule)));
    for (const r of run.results) {
      expect(Number.isInteger(r.ruleIndex)).toBe(true);
      expect(run.tool.driver.rules[r.ruleIndex].id).toBe(r.ruleId);
    }
  });

  it('uses only error, warning and note, mapped from severity', () => {
    for (const r of run.results) {
      expect(['error', 'warning', 'note']).toContain(r.level);
      expect(r.level).toBe(LEVEL[r.properties.severity]);
    }
  });

  it('gives every rule a security-severity string and the level of its worst finding', () => {
    for (const rule of run.tool.driver.rules) {
      expect(typeof rule.properties['security-severity']).toBe('string');
      expect(Number(rule.properties['security-severity'])).toBeGreaterThan(0);
      expect(Number(rule.properties['security-severity'])).toBeLessThanOrEqual(10);
      expect(rule.properties.tags).toContain('security');
      expect(rule.helpUri).toContain(`#${rule.id}`);
      expect(rule.shortDescription.text.length).toBeGreaterThan(0);
      const worst = report.findings.filter((f) => f.rule === rule.id).map((f) => f.severity).sort((a, b) => severityRank(a) - severityRank(b))[0];
      expect(rule.defaultConfiguration.level).toBe(LEVEL[worst]);
    }
    const critical = run.tool.driver.rules.find((r) => r.id === 'JWT-NO-SIGNATURE')!;
    const low = run.tool.driver.rules.find((r) => r.id === 'JWT-NO-ISS')!;
    expect(Number(critical.properties['security-severity'])).toBeGreaterThan(Number(low.properties['security-severity']));
  });

  it('places each finding in the right file, with spec lines located', () => {
    const uriOf = (rule: string) => run.results.find((r) => r.ruleId === rule)!.locations[0].physicalLocation.artifactLocation.uri;
    expect(uriOf('API1-OWNERSHIP')).toBe('api/orders.yaml');
    expect(uriOf('CORS-REFLECTED')).toBe('checks/response.txt');
    expect(uriOf('JWT-NO-SIGNATURE')).toBe('token.jwt');
    expect(uriOf('TOOL-HIDDEN-CHARS')).toBe('tools.json');
    expect(uriOf('TOOL-LOOKALIKE')).toBe('tools.json');
    expect(uriOf('AGENT-APPROVAL')).toBe('agent-safeguards');
    for (const r of run.results) {
      const line = r.locations[0].physicalLocation.region.startLine;
      expect(Number.isInteger(line) && line >= 1).toBe(true);
    }
    const api1 = run.results.find((r) => r.ruleId === 'API1-OWNERSHIP' && r.message.text.includes('(GET /v1/orders/{orderId})'))!;
    expect(api1.locations[0].physicalLocation.region.startLine).toBe(lineOf(ORDERS_SPEC, '  /v1/orders/{orderId}:', '    get:'));
  });

  it('keeps partialFingerprints stable across runs', () => {
    const fingerprints = (r: FullReport) => (JSON.parse(toSarif(r)) as SarifLog).runs[0].results.map((x) => x.partialFingerprints['patchlane/v1']);
    const a = fingerprints(everything(new Date('2026-01-01T00:00:00Z')));
    const b = fingerprints(everything(new Date('2026-01-02T00:00:00Z')));
    expect(a).toEqual(b);
    for (const fp of a) expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(new Set(a).size).toBe(a.length);
  });

  it('marks the run unsuccessful when an input failed', () => {
    const bad = analyze({ spec: CLEAN_SPEC, jwt: 'not-a-token', now: FIXTURE_NOW });
    expect((JSON.parse(toSarif(bad)) as SarifLog).runs[0].invocations[0].executionSuccessful).toBe(false);
  });

  it('is valid for an empty report', () => {
    const empty = JSON.parse(toSarif(analyze({}))) as SarifLog;
    expect(empty.runs[0].results).toEqual([]);
    expect(empty.runs[0].tool.driver.rules).toEqual([]);
  });
});

describe('locateInSpec', () => {
  it('finds an operation in YAML', () => {
    expect(locateInSpec(ORDERS_SPEC, 'GET /v1/orders/{orderId}')).toBe(lineOf(ORDERS_SPEC, '  /v1/orders/{orderId}:', '    get:'));
    expect(locateInSpec(ORDERS_SPEC, 'PATCH /v1/customers/{customerId}')).toBe(lineOf(ORDERS_SPEC, '  /v1/customers/{customerId}:', '    patch:'));
    expect(locateInSpec(ORDERS_SPEC, 'POST /v1/customers')).toBe(lineOf(ORDERS_SPEC, '  /v1/customers:', '    post:'));
    expect(locateInSpec(ORDERS_SPEC, 'GET /v1/orders')).toBe(lineOf(ORDERS_SPEC, '  /v1/orders:', '    get:'));
  });

  it('finds an operation in JSON', () => {
    const json = JSON.stringify(yaml.load(ORDERS_SPEC), null, 2);
    expect(locateInSpec(json, 'GET /v1/orders/{orderId}')).toBe(lineOf(json, '    "/v1/orders/{orderId}": {', '      "get": {'));
    expect(locateInSpec(json, 'DELETE /v1/carts/{cartId}')).toBe(lineOf(json, '    "/v1/carts/{cartId}": {', '      "delete": {'));
    expect(locateInSpec(PAYMENTS_SPEC, 'GET /balances')).toBe(lineOf(PAYMENTS_SPEC, '    "/balances": {', '      "get": {'));
  });

  it('finds servers and security schemes', () => {
    const lines = ORDERS_SPEC.split('\n');
    expect(lines[locateInSpec(ORDERS_SPEC, 'server http://staging-api.orders.example') - 1]).toBe('  - url: http://staging-api.orders.example');
    const p = PAYMENTS_SPEC.split('\n');
    expect(p[locateInSpec(PAYMENTS_SPEC, 'scheme partnerQueryKey') - 1].trim()).toBe('"partnerQueryKey": {');
    expect(p[locateInSpec(PAYMENTS_SPEC, 'scheme oauth') - 1].trim()).toBe('"oauth": {');
  });

  it('returns 1 when it cannot place the finding', () => {
    expect(locateInSpec(undefined, 'GET /v1/orders')).toBe(1);
    expect(locateInSpec(ORDERS_SPEC, 'GET /nowhere')).toBe(1);
    expect(locateInSpec(ORDERS_SPEC, 'whole API')).toBe(1);
  });
});

describe('toMarkdown', () => {
  it('contains the grade, the counts and every finding', () => {
    const report = everything();
    const md = toMarkdown(report);
    expect(md).toMatch(/^# Patchlane report: Orders API 1\.4\.0/);
    expect(md).toContain(`**Grade ${report.grade.letter}** (${report.grade.score}/100)`);
    for (const s of SEVERITY_ORDER) if (report.bySeverity[s]) expect(md).toMatch(new RegExp(`\\| ${s[0].toUpperCase()}${s.slice(1)} \\| ${report.bySeverity[s]} \\|`));
    for (const f of report.findings) {
      expect(md).toContain(`### ${f.title}`);
      expect(md).toContain(`\`${f.rule}\``);
    }
    expect(md).toContain('## Documentation score:');
  });

  it('adds the release section', () => {
    const md = toMarkdown(analyze(NAMED_FIXTURES.invoicesRelease));
    expect(md).toContain('## Release check');
    expect(md).toContain('The changes need a **major** bump; the version number does not.');
    expect(md).toContain('- Removed: DELETE /invoices/{invoiceId}');
  });

  it('adds fix code for a framework', () => {
    const md = toMarkdown(analyze(clean), 'express');
    expect(md).toContain('<summary>Fix pattern in Express (Node.js) (adapt the names to');
    expect(md).toContain('```javascript');
    expect(toMarkdown(analyze(clean), 'spring')).toContain('```java');
  });

  it('handles an empty report', () => {
    const md = toMarkdown(analyze({}));
    expect(md).toContain('**Grade A** (100/100) · 0 findings');
    expect(md).toContain('Checked: nothing.');
  });
});

describe('toGherkin', () => {
  type Scenario = { title: string; steps: string[] };
  /** A small line parser for the subset of Gherkin the export writes. */
  function parseGherkin(text: string): { features: string[]; rules: string[]; scenarios: Scenario[] } {
    const features: string[] = [];
    const rules: string[] = [];
    const scenarios: Scenario[] = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('@')) continue;
      if (line.startsWith('Feature: ')) { features.push(line.slice(9)); continue; }
      if (line.startsWith('Rule: ')) { if (!features.length) throw new Error('Rule before Feature'); rules.push(line.slice(6)); continue; }
      if (line.startsWith('Scenario: ')) { scenarios.push({ title: line.slice(10), steps: [] }); continue; }
      const step = line.match(/^(Given|When|Then|And) \S/);
      if (!step) throw new Error(`not a Gherkin line: ${JSON.stringify(raw)}`);
      if (!scenarios.length) throw new Error(`step outside a scenario: ${raw}`);
      scenarios[scenarios.length - 1].steps.push(line);
    }
    return { features, rules, scenarios };
  }

  it('writes one Feature, a Rule per area and Given/When/Then scenarios', () => {
    const text = toGherkin(everything());
    expect(text).toContain('Feature:');
    expect(text).toContain('Scenario:');
    const { features, rules, scenarios } = parseGherkin(text);
    expect(features.length).toBe(1); // Cucumber, Behave and SpecFlow accept one Feature per file
    expect(rules.length).toBeGreaterThan(1);
    expect(new Set(rules).size).toBe(rules.length);
    expect(scenarios.length).toBeGreaterThan(5);
    for (const s of scenarios) {
      expect(s.steps[0], s.title).toMatch(/^(Given|When) /);
      expect(s.steps.some((x) => x.startsWith('When ')), s.title).toBe(true);
      expect(s.steps.some((x) => x.startsWith('Then ')), s.title).toBe(true);
    }
    expect(new Set(scenarios.map((s) => s.title)).size).toBe(scenarios.length);
    expect(scenarios.map((s) => s.title)).toContain("A user cannot reach another user's object through GET /v1/orders/{orderId}");
    expect(scenarios.map((s) => s.title)).toContain('The API refuses unsigned tokens');
  });

  it('writes a feature with no scenarios when nothing maps to one', () => {
    const text = toGherkin(analyze({ jwt: NAMED_FIXTURES.longLivedToken.jwt, now: new Date('2020-01-01T00:00:00Z') }));
    const { features, scenarios } = parseGherkin(text);
    expect(features).toEqual(['Security controls of the API']);
    expect(scenarios).toEqual([]);
    expect(text).toContain('# No findings that map to a scenario.');
  });
});

describe('gherkinScenario', () => {
  const report = everything();

  it('returns a scenario for rules with a template', () => {
    for (const rule of ['API1-OWNERSHIP', 'API2-PUBLIC-OP', 'CORS-REFLECTED', 'COOKIE-FLAGS', 'JWT-NO-SIGNATURE', 'TOOL-ID-PARAM', 'AGENT-APPROVAL']) {
      const f = report.findings.find((x) => x.rule === rule)!;
      const s = gherkinScenario(f);
      expect(s, rule).not.toBeNull();
      expect(s!).toMatch(/^Scenario: /);
      expect(s!).toMatch(/\n\s+Then /);
    }
  });

  it('returns null for rules without a template', () => {
    for (const rule of ['DOC-NO-OWNER', 'HDR-NO-HSTS', 'HDR-NO-RATELIMIT', 'JWT-NO-ISS', 'TOOL-HIDDEN-CHARS', 'AGENT-LOG']) {
      const f = report.findings.find((x) => x.rule === rule)!;
      expect(f, rule).toBeDefined();
      expect(gherkinScenario(f), rule).toBeNull();
    }
    expect(gherkinScenario({ rule: 'NOT-A-RULE', area: 'api', severity: 'low', title: 't', where: 'w', detail: '', fix: '', refs: [] })).toBeNull();
  });

  it('is either null or a well-formed scenario for every fixture finding', () => {
    for (const input of Object.values(NAMED_FIXTURES)) {
      for (const f of analyze(input).findings) {
        const s = gherkinScenario(f);
        if (s !== null) expect(s.split('\n')[0], f.rule).toMatch(/^Scenario: \S/);
      }
    }
  });
});

describe('toWorkflow', () => {
  type Step = { name?: string; uses?: string; if?: string; run?: string; with?: Record<string, unknown> };
  type Workflow = { name: string; on: { pull_request: { paths: string[] }; push: { branches: string[] } }; permissions: Record<string, string>; jobs: { patchlane: { 'runs-on': string; steps: Step[] } } };

  it('parses as YAML with security-events write and the SARIF upload', () => {
    const wf = yaml.load(toWorkflow()) as Workflow;
    expect(wf.permissions).toEqual({ contents: 'read', 'security-events': 'write' });
    expect(wf.on.pull_request.paths).toEqual(['openapi.yaml']);
    const steps = wf.jobs.patchlane.steps;
    expect(steps[0].uses).toBe('actions/checkout@v4');
    const check = steps.find((s) => s.uses === ACTION_REF)!;
    expect(check.with).toMatchObject({ spec: 'openapi.yaml', 'fail-on': 'high', sarif: 'patchlane.sarif' });
    const upload = steps.find((s) => s.uses?.startsWith('github/codeql-action/upload-sarif@'))!;
    expect(upload.if).toBe('always()');
    expect(upload.with).toMatchObject({ sarif_file: 'patchlane.sarif' });
  });

  it('uses the options', () => {
    const wf = yaml.load(toWorkflow({ spec: 'api/orders.yaml', failOn: 'critical', compareBase: true })) as Workflow;
    expect(wf.on.pull_request.paths).toEqual(['api/orders.yaml']);
    const steps = wf.jobs.patchlane.steps;
    expect(steps[0].with).toEqual({ 'fetch-depth': 0 });
    expect(steps.find((s) => s.run)?.run).toContain('api/orders.yaml');
    expect(steps.find((s) => s.uses === ACTION_REF)?.with).toMatchObject({ spec: 'api/orders.yaml', previous: 'previous-spec.yaml', 'fail-on': 'critical' });
  });
});

describe('toJson', () => {
  it('is JSON with a summarized API', () => {
    const report = analyze(NAMED_FIXTURES.ordersApi);
    const parsed = JSON.parse(toJson(report));
    expect(parsed.api).toEqual({ title: 'Orders API', version: '1.4.0', openapi: '3.0.3', operations: 15, servers: ['https://api.orders.example', 'http://staging-api.orders.example'] });
    expect(parsed.findings).toHaveLength(report.findings.length);
    expect(parsed.grade).toEqual(report.grade);
    expect(JSON.parse(toJson(analyze({}))).api).toBeNull();
  });
});
