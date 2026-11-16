// Patchlane CLI: the same engine as the web app, for terminals and CI.
// Usage: patchlane check openapi.yaml --fail-on high --sarif patchlane.sarif
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import {
  analyze, failsGate, toGherkin, toJson, toMarkdown, toSarif, toWorkflow, locateInSpec,
  ENGINE_VERSION, SEVERITY_ORDER, FRAMEWORK_LABEL, AREA_LABEL,
  type Framework, type Severity, type FullReport,
} from '../src/engine/index';

const HELP = `Patchlane ${ENGINE_VERSION}: a security check-up for APIs and the AI agents that call them.

Usage
  patchlane check [spec] [options]     Check a spec and any other inputs given
  patchlane workflow [options]         Print a GitHub Actions workflow
  patchlane --version | --help

Inputs (any combination; spec may be "-" for stdin)
  --previous <file>        Previous release of the spec: adds the release check
  --response <file>        Raw HTTP response (curl -i output): headers, CORS, cookies
  --origin <origin>        The Origin the response was requested with, to test CORS
  --authenticated          The response belongs to a signed-in request
  --jwt <token|file>       A JSON Web Token to review (decoded locally, never sent)
  --tools <file>           MCP tools/list result, or an OpenAI / Anthropic tools array

Outputs
  --fail-on <level>        Exit 1 on a finding at this level or worse:
                           critical | high | medium | low | info | none (default: high)
  --sarif <file>           SARIF 2.1.0 for GitHub code scanning
  --report <file>          Markdown report
  --json <file>            JSON report
  --gherkin <file>         Given-When-Then security specs
  --framework <name>       Add fix code to the report: ${Object.keys(FRAMEWORK_LABEL).join(' | ')}
  --quiet                  Print only the summary line

Workflow options
  --spec <path>            Spec path in the repository (default: openapi.yaml)
  --compare-base           Also compare against the pull request's base branch
`;

type Args = { _: string[]; flags: Record<string, string | boolean> };

function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      if (v !== undefined) out.flags[k] = v;
      else if (['authenticated', 'quiet', 'help', 'version', 'compare-base'].includes(k)) out.flags[k] = true;
      else { const next = argv[i + 1]; if (next === undefined || next.startsWith('--')) fail(`--${k} needs a value.`); out.flags[k] = next; i++; }
    } else if (a === '-h') out.flags.help = true;
    else if (a === '-v') out.flags.version = true;
    else out._.push(a);
  }
  return out;
}

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColour ? `\x1b[${code}m${s}\x1b[0m` : s);
const SEV_COLOUR: Record<Severity, string> = { critical: '1;31', high: '31', medium: '33', low: '36', info: '2' };

function fail(msg: string): never {
  process.stderr.write(`patchlane: ${msg}\n`);
  process.exit(2);
}

function read(path: string, what: string): string {
  if (path === '-') return readFileSync(0, 'utf8');
  if (!existsSync(path)) fail(`${what} not found: ${path}`);
  return readFileSync(path, 'utf8');
}

function write(path: string, text: string, what: string) {
  writeFileSync(path, text, 'utf8');
  process.stderr.write(c('2', `  wrote ${what} to ${path}\n`));
}

/** GitHub workflow commands: a message escapes %, CR and LF; a property value also escapes : and ,. */
function ghData(s: string) {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
function ghEscape(s: string) {
  return ghData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

function printReport(r: FullReport, quiet: boolean) {
  const counts = SEVERITY_ORDER.filter((s) => r.bySeverity[s]).map((s) => c(SEV_COLOUR[s], `${r.bySeverity[s]} ${s}`)).join(', ');
  const title = r.api ? `${r.api.title} ${r.api.version}`.trim() : 'API check-up';
  if (!quiet) {
    process.stdout.write(`\n${c('1', `Patchlane · ${title}`)}  ${c('2', `checked: ${r.inputs.join(', ') || 'nothing'}`)}\n\n`);
    let area = '';
    for (const f of [...r.findings].sort((a, b) => a.area.localeCompare(b.area) || SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))) {
      if (f.area !== area) { area = f.area; process.stdout.write(c('1', `  ${AREA_LABEL[f.area]}\n`)); }
      process.stdout.write(`    ${c(SEV_COLOUR[f.severity], f.severity.toUpperCase().padEnd(8))} ${f.title}\n`);
      process.stdout.write(`             ${c('2', f.where)}${f.evidence ? c('2', `  · ${f.evidence.slice(0, 80)}`) : ''}\n`);
      process.stdout.write(`             ${c('32', 'fix')} ${f.fix}\n`);
    }
    if (r.docsScore) process.stdout.write(`\n  Documentation score ${r.docsScore.score}/100\n`);
    if (r.release) process.stdout.write(`  Release ${r.release.declared.from} → ${r.release.declared.to}: needs a ${r.release.requiredBump} bump${r.release.bumpOk ? '' : c('33', ' (version number disagrees)')}\n`);
  }
  for (const e of r.errors) process.stderr.write(c('31', `  ${e.input}: ${e.message}\n`));
  process.stdout.write(`\n  Grade ${c('1', r.grade.letter)} (${r.grade.score}/100) · ${r.findings.length} finding${r.findings.length === 1 ? '' : 's'}${counts ? ': ' + counts : ''}\n\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (args.flags.version) { process.stdout.write(ENGINE_VERSION + '\n'); return; }
  if (args.flags.help || !cmd) { process.stdout.write(HELP); return; }

  if (cmd === 'workflow') {
    const failOn = String(args.flags['fail-on'] ?? 'high') as Severity;
    if (!SEVERITY_ORDER.includes(failOn)) fail(`--fail-on must be one of ${SEVERITY_ORDER.join(', ')}.`);
    process.stdout.write(toWorkflow({ spec: String(args.flags.spec ?? 'openapi.yaml'), failOn, compareBase: !!args.flags['compare-base'] }));
    return;
  }
  if (cmd !== 'check') fail(`unknown command "${cmd}". Run patchlane --help.`);

  const specPath = args._[1];
  const f = args.flags;
  const failOn = String(f['fail-on'] ?? 'high') as Severity | 'none';
  if (failOn !== 'none' && !SEVERITY_ORDER.includes(failOn)) fail(`--fail-on must be one of ${SEVERITY_ORDER.join(', ')}, none.`);
  const framework = f.framework ? String(f.framework) as Framework : undefined;
  if (framework && !(framework in FRAMEWORK_LABEL)) fail(`--framework must be one of ${Object.keys(FRAMEWORK_LABEL).join(', ')}.`);

  const spec = specPath ? read(specPath, 'Spec') : undefined;
  let previousSpec: string | undefined;
  if (typeof f.previous === 'string' && f.previous) {
    if (existsSync(f.previous) && readFileSync(f.previous, 'utf8').trim()) previousSpec = readFileSync(f.previous, 'utf8');
    else process.stderr.write(c('2', `  no previous spec at ${f.previous}; skipping the release check\n`));
  }
  const jwtArg = typeof f.jwt === 'string' ? f.jwt : undefined;
  const jwt = jwtArg ? (existsSync(jwtArg) ? readFileSync(jwtArg, 'utf8') : jwtArg) : undefined;
  const response = typeof f.response === 'string' ? read(f.response, 'Response file') : undefined;
  const tools = typeof f.tools === 'string' ? read(f.tools, 'Tools file') : undefined;
  if (!spec && !response && !jwt && !tools) fail('nothing to check. Give a spec, or --response, --jwt or --tools.');

  const report = analyze({
    spec, previousSpec, response, jwt, tools,
    responseOptions: { testOrigin: typeof f.origin === 'string' ? f.origin : undefined, authenticated: !!f.authenticated },
  });

  printReport(report, !!f.quiet);

  const files = { spec: specPath && specPath !== '-' ? specPath.replace(/\\/g, '/') : undefined, response: typeof f.response === 'string' ? f.response : undefined, token: jwtArg && existsSync(jwtArg) ? jwtArg : undefined, tools: typeof f.tools === 'string' ? f.tools : undefined };
  if (typeof f.sarif === 'string') write(f.sarif, toSarif(report, { files, specText: spec }), 'SARIF');
  if (typeof f.report === 'string') write(f.report, toMarkdown(report, framework), 'report');
  if (typeof f.json === 'string') write(f.json, toJson(report), 'JSON');
  if (typeof f.gherkin === 'string') write(f.gherkin, toGherkin(report), 'security specs');

  // GitHub Actions: inline annotations and a job summary
  if (process.env.GITHUB_ACTIONS === 'true') {
    for (const x of report.findings) {
      if (x.severity === 'info') continue;
      const level = x.severity === 'critical' || x.severity === 'high' ? 'error' : x.severity === 'medium' ? 'warning' : 'notice';
      const file = x.area === 'server' ? files.response : x.area === 'token' ? files.token : x.area === 'agent' && x.where.startsWith('tool') ? files.tools : files.spec;
      const loc = file ? `file=${ghEscape(file)},line=${file === files.spec ? locateInSpec(spec, x.where) : 1},` : '';
      process.stdout.write(`::${level} ${loc}title=${ghEscape(`${x.rule}: ${x.title}`)}::${ghData(`${x.where}. ${x.fix}`)}\n`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, toMarkdown(report, framework) + '\n');
  }

  if (report.errors.some((e) => e.input === 'spec')) process.exit(2);
  if (failsGate(report, failOn)) {
    process.stderr.write(c('31', `  Failing: at least one finding is ${failOn} or worse.\n`));
    process.exit(1);
  }
}

main();
