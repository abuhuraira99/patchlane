import type { Finding, Framework, Severity } from './types';
import { AREA_LABEL, FRAMEWORK_LABEL, SEVERITY_ORDER } from './types';
import { fixFor } from './fixes';
import { ACTION_REF, REPO_URL, SITE_URL } from './meta';
import type { FullReport } from './report';

const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

// ---------- helpers ----------

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Best-effort line number of a finding inside the spec text (1 when it cannot be placed). */
export function locateInSpec(specText: string | undefined, where: string): number {
  if (!specText) return 1;
  const lines = specText.split(/\r?\n/);
  const find = (re: RegExp, from = 0) => { for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i; return -1; };
  const op = where.match(/^(GET|PUT|POST|DELETE|PATCH|HEAD|OPTIONS|TRACE) (\S+)/);
  if (op) {
    const p = find(new RegExp(`^\\s*["']?${esc(op[2])}["']?\\s*:`));
    if (p >= 0) {
      const m = find(new RegExp(`^\\s*["']?${op[1].toLowerCase()}["']?\\s*:`), p + 1);
      return (m >= 0 ? m : p) + 1;
    }
  }
  const server = where.match(/^server (\S+)/);
  if (server) { const i = find(new RegExp(esc(server[1]))); if (i >= 0) return i + 1; }
  const scheme = where.match(/^scheme (\S+)/);
  if (scheme) {
    const s = find(/securitySchemes|securityDefinitions/);
    const i = find(new RegExp(`^\\s*["']?${esc(scheme[1])}["']?\\s*:`), Math.max(s, 0));
    if (i >= 0) return i + 1;
  }
  const dotted = where.match(/^(info|components)\.(\w+)/);
  if (dotted) {
    // look for the key inside its own block only; a key that is missing (info.description absent) points at the block
    const block = find(new RegExp(`^\\s*["']?${dotted[1]}["']?\\s*:`));
    if (block >= 0) {
      const indent = (lines[block].match(/^\s*/)?.[0].length ?? 0);
      for (let i = block + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.trim() && (l.match(/^\s*/)?.[0].length ?? 0) <= indent && !/^\s*[}\]]/.test(l)) break;
        if (new RegExp(`^\\s*["']?${dotted[2]}["']?\\s*:`).test(l)) return i + 1;
      }
      return block + 1;
    }
  }
  return 1;
}

// ---------- JSON ----------

export function toJson(report: FullReport): string {
  const { api, ...rest } = report;
  return JSON.stringify({ ...rest, api: api ? { title: api.title, version: api.version, openapi: api.openapi, operations: api.operations.length, servers: api.servers } : null }, null, 2);
}

// ---------- Markdown ----------

export function toMarkdown(report: FullReport, framework?: Framework): string {
  const L: string[] = [];
  const title = report.api ? `${report.api.title}${report.api.version ? ' ' + report.api.version : ''}` : 'API check-up';
  L.push(`# Patchlane report: ${title}`, '');
  L.push(`Generated ${report.generatedAt.slice(0, 16).replace('T', ' ')} UTC by Patchlane ${report.engineVersion}. Checked: ${report.inputs.join(', ') || 'nothing'}.`, '');
  L.push(`**Grade ${report.grade.letter}** (${report.grade.score}/100) · ${report.findings.length} finding${report.findings.length === 1 ? '' : 's'}`, '');
  L.push('| Severity | Count |', '|---|---|');
  for (const s of SEVERITY_ORDER) L.push(`| ${SEV_LABEL[s]} | ${report.bySeverity[s]} |`);
  L.push('');
  if (report.docsScore) {
    L.push(`## Documentation score: ${report.docsScore.score}/100`, '');
    for (const p of report.docsScore.parts) L.push(`- ${p.label}: ${p.value}%`);
    L.push('');
  }
  if (report.release) {
    const r = report.release;
    L.push('## Release check', '');
    L.push(`Version ${r.declared.from} → ${r.declared.to}. The changes need a **${r.requiredBump}** bump; ${r.bumpOk ? 'the version number agrees.' : 'the version number does not.'}`, '');
    if (r.added.length) L.push(`- Added: ${r.added.join(', ')}`);
    if (r.removed.length) L.push(`- Removed: ${r.removed.join(', ')}`);
    for (const c of r.changed) L.push(`- Changed: ${c}`);
    L.push('');
  }
  for (const sev of SEVERITY_ORDER) {
    const list = report.findings.filter((f) => f.severity === sev);
    if (!list.length) continue;
    L.push(`## ${SEV_LABEL[sev]} (${list.length})`, '');
    for (const f of list) {
      L.push(`### ${f.title}`, '');
      L.push(`\`${f.rule}\` · ${AREA_LABEL[f.area]} · **${f.where}**`, '');
      if (f.evidence) L.push(`> ${f.evidence}`, '');
      L.push(f.detail, '', `**Fix.** ${f.fix}`, '');
      const refs = f.refs.map((r) => r.standard).filter(Boolean);
      if (refs.length) L.push(`<sub>${refs.join(' | ')}</sub>`, '');
      if (framework) {
        const fx = fixFor(f.rule, framework);
        if (fx) L.push(`<details><summary>Fix pattern in ${FRAMEWORK_LABEL[framework]} (adapt the names to ${f.where})</summary>`, '', '```' + fx.language, fx.code.trim(), '```', fx.note ? `\n${fx.note}\n` : '', '</details>', '');
      }
    }
  }
  L.push('---', '');
  L.push('A spec, a response or a token shows what an API declares, not everything it does. Treat each finding as something to confirm on the running service, and re-run Patchlane in CI so fixed problems stay fixed.', '');
  L.push(`Made with [Patchlane](${SITE_URL}) · [source](${REPO_URL})`);
  return L.join('\n');
}

// ---------- SARIF 2.1.0 ----------

const SARIF_LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = { critical: 'error', high: 'error', medium: 'warning', low: 'note', info: 'note' };
const SECURITY_SEVERITY: Record<Severity, string> = { critical: '9.5', high: '8.0', medium: '5.5', low: '3.0', info: '1.0' };

export interface SarifOptions {
  /** path of each input as the repository sees it */
  files?: Partial<Record<'spec' | 'response' | 'token' | 'tools' | 'safeguards', string>>;
  specText?: string;
}

function fileFor(f: Finding, files: SarifOptions['files'] = {}): string {
  if (f.area === 'server') return files.response ?? 'response.txt';
  if (f.area === 'token') return files.token ?? 'token.jwt';
  if (f.area === 'agent' && f.where.startsWith('tool')) return files.tools ?? 'tools.json';
  if (f.area === 'agent' && f.where === 'agent safeguards') return files.safeguards ?? 'agent-safeguards';
  return files.spec ?? 'openapi.yaml';
}

export function toSarif(report: FullReport, opts: SarifOptions = {}): string {
  const ruleIds = [...new Set(report.findings.map((f) => f.rule))];
  const rules = ruleIds.map((id) => {
    const f = report.findings.find((x) => x.rule === id)!;
    const worst = SEVERITY_ORDER.find((s) => report.findings.some((x) => x.rule === id && x.severity === s))!;
    const standards = f.refs.map((r) => r.standard).filter(Boolean) as string[];
    return {
      id,
      name: id.toLowerCase().replace(/(^|-)([a-z0-9])/g, (_m, _d, c: string) => c.toUpperCase()),
      shortDescription: { text: f.title },
      fullDescription: { text: f.detail },
      help: { text: `${f.fix}${standards.length ? `\n\n${standards.join('; ')}` : ''}`, markdown: `**Fix.** ${f.fix}${standards.length ? `\n\n${standards.map((s) => `- ${s}`).join('\n')}` : ''}` },
      helpUri: `${SITE_URL}/rules/#${id}`,
      defaultConfiguration: { level: SARIF_LEVEL[worst] },
      properties: { tags: ['security', AREA_LABEL[f.area].toLowerCase(), ...standards.map((s) => s.split(' ')[0])], 'security-severity': SECURITY_SEVERITY[worst], precision: 'medium' },
    };
  });
  const results = report.findings.map((f) => {
    const uri = fileFor(f, opts.files);
    const line = uri === (opts.files?.spec ?? 'openapi.yaml') ? locateInSpec(opts.specText, f.where) : 1;
    return {
      ruleId: f.rule,
      ruleIndex: ruleIds.indexOf(f.rule),
      level: SARIF_LEVEL[f.severity],
      message: { text: `${f.title} (${f.where}). ${f.detail}${f.evidence ? ` Evidence: ${f.evidence}` : ''}` },
      locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: line } } }],
      partialFingerprints: { 'patchlane/v1': fnv1a(`${f.rule}|${f.where}|${f.evidence ?? ''}`) },
      properties: { severity: f.severity, where: f.where },
    };
  });
  return JSON.stringify({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'Patchlane', version: report.engineVersion, semanticVersion: report.engineVersion, informationUri: SITE_URL, rules } },
      results,
      invocations: [{ executionSuccessful: report.errors.length === 0, endTimeUtc: report.generatedAt }],
    }],
  }, null, 2);
}

// ---------- Gherkin security specs ----------

/**
 * Acceptance tests that prove each control is in place, written Given-When-Then (the BDD method
 * from "Start Left: API SecDevOps"). They describe expected refusals; wire the steps to your own
 * test client.
 */
function scenario(f: Finding): string[] | null {
  const op = f.where.match(/^(GET|PUT|POST|DELETE|PATCH|HEAD|OPTIONS|TRACE) (\S+)/);
  const call = op ? `${op[1]} ${op[2]}` : f.where;
  const id = (f.evidence ?? 'id').split(',')[0].trim();
  switch (f.rule) {
    case 'API1-OWNERSHIP': return [
      `Scenario: A user cannot reach another user's object through ${call}`,
      `  Given user "alice" owns a record with ${id} "A-1"`,
      `  And user "bob" is signed in`,
      `  When bob sends ${call} with ${id} "A-1"`,
      `  Then the response status is 404`,
      `  And the response contains none of alice's data`,
    ];
    case 'API2-PUBLIC-OP': case 'REL-AUTH-REMOVED': case 'REL-NEW-PUBLIC': return [
      `Scenario: ${call} refuses a request without a token`,
      `  Given no Authorization header is sent`,
      `  When the client sends ${call}`,
      `  Then the response status is 401`,
    ];
    case 'API3-SENSITIVE-OUT': case 'REL-NEW-SENSITIVE': return [
      `Scenario: ${call} never returns secret fields`,
      `  Given user "alice" is signed in`,
      `  When alice sends ${call}`,
      `  Then the response body has no field named ${(f.evidence ?? '').split(/,| and /).map((s) => `"${s.trim()}"`).filter((s) => s !== '""').slice(0, 3).join(', ') || 'from the sensitive list'}`,
    ];
    case 'API3-MASS-ASSIGNMENT': return [
      `Scenario: ${call} ignores fields the user may not set`,
      `  Given user "bob" is signed in with role "member"`,
      `  When bob sends ${call} with ${(f.evidence ?? 'role').split(',')[0].trim()} set to a privileged value`,
      `  Then the stored record keeps its original ${(f.evidence ?? 'role').split(',')[0].trim()}`,
    ];
    case 'API4-NO-PAGING': case 'API4-NO-MAX': return [
      `Scenario: ${call} caps the page size`,
      `  Given user "alice" is signed in`,
      `  When alice sends ${call} with limit 100000`,
      `  Then the response holds at most 100 items or the status is 400`,
    ];
    case 'API2-LOGIN-RATE': return [
      `Scenario: ${call} slows down repeated failures`,
      `  Given an account "alice@example.test"`,
      `  When 20 wrong passwords are sent to ${call} within one minute`,
      `  Then later attempts get status 429 with a Retry-After header`,
    ];
    case 'API5-ADMIN-PATH': return [
      `Scenario: An ordinary user cannot call ${call}`,
      `  Given user "bob" is signed in without the admin role`,
      `  When bob sends ${call}`,
      `  Then the response status is 403 or 404`,
    ];
    case 'API6-BUSINESS-FLOW': return [
      `Scenario: Repeating ${call} does not repeat the action`,
      `  Given user "alice" is signed in`,
      `  When alice sends ${call} twice with the same Idempotency-Key`,
      `  Then the action happens once and both responses match`,
    ];
    case 'API7-URL-INPUT': case 'TOOL-URL-PARAM': return [
      `Scenario: ${call} refuses internal addresses`,
      `  Given user "alice" is signed in`,
      `  When alice sends ${call} with a URL on 127.0.0.1 or 169.254.169.254`,
      `  Then the response status is 400 and the server made no request`,
    ];
    case 'API8-ERROR-DETAIL': case 'ERR-STACK': return [
      `Scenario: Errors from ${call} reveal no internals`,
      `  Given a request that makes the server fail`,
      `  When the client sends it`,
      `  Then the body holds an error code and a correlation id`,
      `  And the body contains no stack trace, SQL or file path`,
    ];
    case 'CORS-REFLECTED': case 'CORS-WILDCARD-CREDS': case 'CORS-NULL': case 'CORS-WILDCARD': return [
      `Scenario: The API trusts only its own origins`,
      `  When a request arrives with Origin "https://unknown.example"`,
      `  Then Access-Control-Allow-Origin is absent`,
      `  And Access-Control-Allow-Credentials is absent`,
    ];
    case 'COOKIE-FLAGS': return [
      `Scenario: Session cookies carry their flags`,
      `  When a user signs in`,
      `  Then every Set-Cookie for the session has Secure, HttpOnly and SameSite`,
    ];
    case 'JWT-NO-SIGNATURE': return [
      `Scenario: The API refuses unsigned tokens`,
      `  Given a token with alg "none" and valid-looking claims`,
      `  When it is sent as a Bearer token`,
      `  Then the response status is 401`,
    ];
    case 'JWT-NO-EXP': case 'JWT-EXPIRED': return [
      `Scenario: The API refuses expired tokens`,
      `  Given a correctly signed token whose exp is in the past`,
      `  When it is sent as a Bearer token`,
      `  Then the response status is 401`,
    ];
    case 'JWT-NO-AUD': return [
      `Scenario: The API refuses tokens issued for another API`,
      `  Given a correctly signed token with aud "another-api"`,
      `  When it is sent as a Bearer token`,
      `  Then the response status is 401`,
    ];
    case 'TOOL-NEEDS-APPROVAL': case 'AGENT-APPROVAL': return [
      `Scenario: ${f.where.replace(/^tool /, 'Tool ')} waits for the user to confirm`,
      `  Given the agent calls ${f.where.replace(/^tool /, '')} for user "alice"`,
      `  When no confirmation from alice has been received`,
      `  Then the action is stored as pending and nothing changes`,
    ];
    case 'TOOL-ID-PARAM': return [
      `Scenario: ${f.where.split(' · ')[0].replace(/^tool /, 'Tool ')} acts only for the signed-in user`,
      `  Given the agent runs for user "bob"`,
      `  When it calls the tool with ${(f.evidence ?? 'user_id')} set to alice's id`,
      `  Then the tool returns no data of alice's`,
    ];
    case 'LLM-COST-LIMIT': return [
      `Scenario: ${call} enforces a per-user budget`,
      `  Given user "alice" has used her daily budget`,
      `  When alice sends ${call}`,
      `  Then the response status is 429`,
    ];
    case 'LLM-INPUT-LIMIT': return [
      `Scenario: ${call} refuses oversized prompts`,
      `  When the client sends ${call} with a 100,000 character prompt`,
      `  Then the response status is 413 or 422 and the model is not called`,
    ];
    case 'LLM-CLIENT-INSTRUCTIONS': return [
      `Scenario: ${call} keeps its instructions on the server`,
      `  When the client sends ${call} with a system message`,
      `  Then the system message is rejected or ignored`,
    ];
    default: return null;
  }
}

/** The Given-When-Then scenario that proves one finding is fixed, or null when none applies. */
export function gherkinScenario(f: Finding): string | null {
  const s = scenario(f);
  return s ? s.join(String.fromCharCode(10)) : null;
}

export function toGherkin(report: FullReport): string {
  const title = report.api?.title ?? 'the API';
  const L: string[] = [
    `# Generated by Patchlane ${report.engineVersion} on ${report.generatedAt.slice(0, 10)}.`,
    '# Each scenario proves one control. Wire the steps to your test client (Cucumber, Behave, SpecFlow, Karate).',
    '',
  ];
  const byArea = new Map<string, string[][]>();
  const seen = new Set<string>();
  for (const f of report.findings) {
    const s = scenario(f);
    if (!s || seen.has(s[0])) continue;
    seen.add(s[0]);
    const k = AREA_LABEL[f.area];
    if (!byArea.has(k)) byArea.set(k, []);
    byArea.get(k)!.push([`  # ${f.rule} · ${f.severity}`, ...s.map((x) => '  ' + x)]);
  }
  // one Feature per file (Cucumber, Behave and SpecFlow accept only one), one Rule per area (Gherkin 6+)
  L.push('@security', `Feature: Security controls of ${title}`, '');
  if (!byArea.size) return L.concat(['  # No findings that map to a scenario.']).join('\n') + '\n';
  for (const [area, scenarios] of byArea) {
    L.push(`  @${area.toLowerCase().replace(/[^a-z]+/g, '-')}`, `  Rule: ${area}`, '');
    for (const s of scenarios) L.push(...s.map((x) => '  ' + x), '');
  }
  return L.join('\n');
}

// ---------- GitHub Actions ----------

export interface WorkflowOptions {
  spec?: string;
  failOn?: Severity;
  compareBase?: boolean;
}

export function toWorkflow(opts: WorkflowOptions = {}): string {
  const spec = opts.spec || 'openapi.yaml';
  const failOn = opts.failOn || 'high';
  const lines = [
    'name: API security check',
    '',
    'on:',
    '  pull_request:',
    `    paths: ['${spec}']`,
    '  push:',
    '    branches: [main]',
    '',
    'permissions:',
    '  contents: read',
    '  security-events: write',
    '',
    'jobs:',
    '  patchlane:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
  ];
  if (opts.compareBase) {
    lines.push(
      '        with:',
      '          fetch-depth: 0',
      '      - name: Get the spec from the base branch',
      "        if: github.event_name == 'pull_request'",
      `        run: git show "origin/\${{ github.base_ref }}:${spec}" > previous-spec.yaml || true`,
    );
  }
  lines.push(
    '      - name: Check the API with Patchlane',
    `        uses: ${ACTION_REF}`,
    '        with:',
    `          spec: ${spec}`,
    ...(opts.compareBase ? ['          previous: previous-spec.yaml'] : []),
    `          fail-on: ${failOn}`,
    '          sarif: patchlane.sarif',
    '          report: patchlane-report.md',
    '      - name: Send findings to code scanning',
    '        if: always()',
    '        uses: github/codeql-action/upload-sarif@v3',
    '        with:',
    '          sarif_file: patchlane.sarif',
    '          category: patchlane',
  );
  return lines.join('\n') + '\n';
}
