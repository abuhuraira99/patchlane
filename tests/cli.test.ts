import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { ENGINE_VERSION } from '../src/engine/report';
import { locateInSpec } from '../src/engine/exports';
import {
  CLEAN_SPEC, INVOICES_NEXT, INVOICES_PREVIOUS, JWT_UNSIGNED, ORDERS_SPEC, RESPONSE_REFLECTED_CORS, TOOLS_MCP,
} from '../src/engine/fixtures';
import { ROOT } from './helpers';

let dir = '';
let cli = '';

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'patchlane-cli-'));
  cli = join(dir, 'patchlane.mjs');
  await build({
    entryPoints: [join(ROOT, 'cli', 'patchlane.ts')],
    outfile: cli,
    platform: 'node',
    format: 'esm',
    bundle: true,
    target: 'node18',
    logLevel: 'silent',
  });
  const files: Record<string, string> = {
    'orders.yaml': ORDERS_SPEC,
    'clean.yaml': CLEAN_SPEC,
    'invoices-next.yaml': INVOICES_NEXT,
    'invoices-previous.yaml': INVOICES_PREVIOUS,
    'no-paths.yaml': 'openapi: 3.0.3\ninfo: { title: Broken fixture, version: 1.0.0 }\n',
    'not-yaml.yaml': 'openapi: 3.0.3\npaths: [unclosed\n',
    'response.txt': RESPONSE_REFLECTED_CORS,
    'tools.json': TOOLS_MCP,
    'token.jwt': JWT_UNSIGNED,
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text, 'utf8');
}, 60_000);

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Run the bundled CLI in the temp dir, with no CI variables leaking in from the outer environment. */
function run(args: string[], opts: { env?: Record<string, string>; input?: string } = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', ...opts.env };
  if (!opts.env?.GITHUB_ACTIONS) delete env.GITHUB_ACTIONS;
  if (!opts.env?.GITHUB_STEP_SUMMARY) delete env.GITHUB_STEP_SUMMARY;
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: dir, env, encoding: 'utf8', input: opts.input ?? '', timeout: 30_000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('patchlane CLI', () => {
  it('prints the version', () => {
    const r = run(['--version']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(ENGINE_VERSION);
    expect(run(['-v']).stdout.trim()).toBe(ENGINE_VERSION);
  });

  it('prints help with --help and with no arguments', () => {
    for (const args of [['--help'], ['-h'], []]) {
      const r = run(args);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('Usage');
      expect(r.stdout).toContain('patchlane check [spec] [options]');
      expect(r.stdout).toContain('--fail-on <level>');
    }
  });

  it('exits 1 on a high or critical finding with the default --fail-on high', () => {
    const r = run(['check', 'orders.yaml']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('Patchlane · Orders API 1.4.0');
    expect(r.stdout).toMatch(/Grade F \(\d+\/100\)/);
    expect(r.stdout).toContain('CRITICAL');
    expect(r.stderr).toContain('Failing: at least one finding is high or worse.');
  });

  it('exits 0 when the worst finding is below the threshold, and 1 when the threshold is lowered', () => {
    expect(run(['check', 'clean.yaml']).status).toBe(0);
    expect(run(['check', 'clean.yaml', '--fail-on', 'medium']).status).toBe(1);
    expect(run(['check', 'clean.yaml', '--fail-on=low']).status).toBe(1);
  });

  it('exits 0 with --fail-on none', () => {
    const r = run(['check', 'orders.yaml', '--fail-on', 'none']);
    expect(r.status).toBe(0);
    expect(r.stderr).not.toContain('Failing');
  });

  it('exits 2 for a missing file, a spec that does not parse, and bad options', () => {
    const missing = run(['check', 'missing.yaml']);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain('Spec not found: missing.yaml');
    const noPaths = run(['check', 'no-paths.yaml']);
    expect(noPaths.status).toBe(2);
    expect(noPaths.stderr).toContain('The spec has no "paths".');
    const notYaml = run(['check', 'not-yaml.yaml', '--fail-on', 'none']);
    expect(notYaml.status).toBe(2);
    expect(notYaml.stderr).toContain('The YAML does not parse');
    expect(run(['check', 'orders.yaml', '--fail-on', 'severe']).status).toBe(2);
    expect(run(['check', 'orders.yaml', '--framework', 'rails']).status).toBe(2);
    expect(run(['check', 'orders.yaml', '--sarif']).stderr).toContain('--sarif needs a value.');
    expect(run(['scan', 'orders.yaml']).stderr).toContain('unknown command "scan"');
    expect(run(['check']).stderr).toContain('nothing to check');
  });

  it('writes SARIF, Markdown, JSON and Gherkin files', () => {
    const r = run(['check', 'orders.yaml', '--fail-on', 'none', '--sarif', 'out.sarif', '--report', 'out.md', '--json', 'out.json', '--gherkin', 'out.feature', '--framework', 'express']);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('wrote SARIF to out.sarif');
    const sarif = JSON.parse(readFileSync(join(dir, 'out.sarif'), 'utf8'));
    expect(sarif.version).toBe('2.1.0');
    const results = sarif.runs[0].results as { ruleId: string; locations: { physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number } } }[] }[];
    expect(results.length).toBeGreaterThan(10);
    expect(results.every((x) => x.locations[0].physicalLocation.artifactLocation.uri === 'orders.yaml')).toBe(true);
    const md = readFileSync(join(dir, 'out.md'), 'utf8');
    expect(md).toContain('# Patchlane report: Orders API 1.4.0');
    expect(md).toContain('```javascript');
    const json = JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8'));
    expect(json.api.title).toBe('Orders API');
    expect(json.findings.length).toBe(results.length);
    const feature = readFileSync(join(dir, 'out.feature'), 'utf8');
    expect(feature).toContain('Feature:');
    expect(feature).toContain('Scenario:');
  });

  it('prints a workflow that parses as YAML', () => {
    const r = run(['workflow', '--spec', 'api/orders.yaml', '--fail-on', 'critical', '--compare-base']);
    expect(r.status).toBe(0);
    const wf = yaml.load(r.stdout) as { permissions: Record<string, string>; jobs: { patchlane: { steps: { uses?: string; with?: Record<string, unknown> }[] } } };
    expect(wf.permissions['security-events']).toBe('write');
    expect(wf.jobs.patchlane.steps.some((s) => s.uses?.startsWith('github/codeql-action/upload-sarif'))).toBe(true);
    expect(r.stdout).toContain('fail-on: critical');
    expect(r.stdout).toContain('previous: previous-spec.yaml');
    expect(run(['workflow', '--fail-on', 'none']).status).toBe(2); // a workflow needs a real level
  });

  it('prints annotations and a job summary under GitHub Actions', () => {
    const summary = join(dir, 'summary.md');
    writeFileSync(summary, '');
    const r = run(['check', 'orders.yaml', '--fail-on', 'none'], { env: { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary } });
    expect(r.status).toBe(0);
    const annotations = r.stdout.split('\n').filter((l) => l.startsWith('::'));
    expect(annotations.some((l) => l.startsWith('::error file=orders.yaml,line='))).toBe(true);
    expect(annotations.some((l) => l.startsWith('::warning '))).toBe(true);
    expect(annotations.some((l) => l.startsWith('::notice '))).toBe(true);
    expect(annotations.every((l) => /^::(error|warning|notice) (file=[^,]+,line=\d+,)?title=[^:]+::/.test(l))).toBe(true);
    expect(annotations.some((l) => l.includes('DOC-NO-OWNER'))).toBe(false); // info findings are not annotated
    const api1 = annotations.find((l) => l.includes('title=API1-OWNERSHIP') && l.includes('::GET /v1/orders/{orderId}. '));
    expect(api1).toContain(`line=${locateInSpec(ORDERS_SPEC, 'GET /v1/orders/{orderId}')},`);
    expect(readFileSync(summary, 'utf8')).toContain('# Patchlane report: Orders API 1.4.0');
    // and none of it outside Actions
    expect(run(['check', 'orders.yaml', '--fail-on', 'none']).stdout).not.toMatch(/^::/m);
  });

  it('skips a missing --previous file and exits on the findings alone', () => {
    const cleanRun = run(['check', 'clean.yaml', '--previous', 'no-such-file.yaml']);
    expect(cleanRun.stderr).toContain('no previous spec at no-such-file.yaml; skipping the release check');
    expect(cleanRun.status).toBe(0);
    expect(cleanRun.stdout).not.toContain('Release ');
    expect(run(['check', 'orders.yaml', '--previous', 'no-such-file.yaml']).status).toBe(1);
  });

  it('runs the release check with --previous', () => {
    const r = run(['check', 'invoices-next.yaml', '--previous', 'invoices-previous.yaml']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('Release 3.2.0 → 3.2.0: needs a major bump (version number disagrees)');
    expect(r.stdout).toContain('An operation lost its authentication');
  });

  it('checks a response, a token and tools without a spec', () => {
    const r = run(['check', '--response', 'response.txt', '--origin', 'https://unknown-site.example', '--authenticated', '--jwt', 'token.jwt', '--tools', 'tools.json', '--fail-on', 'none']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('checked: response, token, tools');
    expect(r.stdout).toContain('CORS echoes back an origin it should not trust');
    expect(r.stdout).toContain('The token is not signed');
    expect(r.stdout).toContain('The definition contains invisible characters');
    expect(run(['check', '--jwt', JWT_UNSIGNED]).status).toBe(1); // a token given inline, not as a file
    expect(run(['check', '--tools', 'missing.json']).status).toBe(2);
  });

  it('reads the spec from stdin', () => {
    const r = run(['check', '-', '--fail-on', 'none', '--quiet'], { input: ORDERS_SPEC });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toMatch(/^Grade F \(\d+\/100\) · \d+ findings: /);
  });

  it('builds a bundle that exists', () => {
    expect(existsSync(cli)).toBe(true);
  });
});
