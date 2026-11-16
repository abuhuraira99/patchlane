import type { ApiModel, Finding, Report, Severity } from './types';
import { SEVERITY_ORDER, severityRank } from './types';
import { parseApi, parseTools } from './parse';
import { checkApi, docsScore } from './api-checks';
import { checkResponse } from './server-checks';
import { checkJwt, type DecodedJwt } from './jwt';
import { diffApis, type ReleaseDiff } from './diff';
import { checkAiSurface, checkSafeguards, checkTools } from './agent';

export const ENGINE_VERSION = '1.0.0';

export interface AnalyzeInput {
  /** OpenAPI 3.x or Swagger 2.0, JSON or YAML */
  spec?: string;
  /** the previous release of the same spec, for the release check */
  previousSpec?: string;
  /** a raw HTTP response: status line, headers, blank line, body */
  response?: string;
  responseOptions?: { testOrigin?: string; authenticated?: boolean };
  jwt?: string;
  /** MCP tools/list result, or an OpenAI / Anthropic tools array */
  tools?: string;
  /** safeguard id -> in place; omit to skip the checklist */
  safeguards?: Record<string, boolean>;
  now?: Date;
}

export interface InputError {
  input: 'spec' | 'previousSpec' | 'response' | 'jwt' | 'tools';
  message: string;
}

export interface FullReport extends Report {
  release: ReleaseDiff | null;
  jwt: DecodedJwt | null;
  toolCount: number;
  errors: InputError[];
}

const WEIGHT: Record<Severity, number> = { critical: 24, high: 10, medium: 4, low: 1, info: 0 };

/**
 * 100 scaled down by a weighted count of findings. Repeats of one rule count less each time (the same gap
 * on twenty endpoints is one habit to fix, not twenty), and any critical finding caps the grade at D.
 */
export function gradeFindings(findings: Finding[]): Report['grade'] {
  const perRule = new Map<string, number>();
  let penalty = 0;
  for (const f of [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))) {
    const n = perRule.get(f.rule) ?? 0;
    perRule.set(f.rule, n + 1);
    penalty += WEIGHT[f.severity] / (1 + n * 0.75);
  }
  // an exponential curve keeps scores apart across the whole range: one high finding costs about 10 points
  let score = Math.round(100 * Math.exp(-penalty / 90));
  const hasCritical = findings.some((f) => f.severity === 'critical');
  if (hasCritical) score = Math.min(score, 59);
  const letter = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { letter, score };
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>;
  for (const f of findings) out[f.severity]++;
  return out;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.rule.localeCompare(b.rule) || a.where.localeCompare(b.where));
}

/** Run every check the inputs allow. Bad inputs are reported in `errors`, never thrown. */
export function analyze(input: AnalyzeInput): FullReport {
  const findings: Finding[] = [];
  const errors: InputError[] = [];
  const inputs: string[] = [];
  let api: ApiModel | null = null;
  let release: ReleaseDiff | null = null;
  let jwt: DecodedJwt | null = null;
  let toolCount = 0;

  if (input.spec?.trim()) {
    try {
      api = parseApi(input.spec);
      inputs.push('spec');
      findings.push(...checkApi(api), ...checkAiSurface(api));
    } catch (e) { errors.push({ input: 'spec', message: (e as Error).message }); }
  }
  if (input.previousSpec?.trim()) {
    if (!api) {
      if (input.spec?.trim()) { /* already reported */ } else errors.push({ input: 'previousSpec', message: 'Add the new version of the spec to compare against.' });
    } else {
      try {
        release = diffApis(parseApi(input.previousSpec), api);
        inputs.push('release');
        findings.push(...release.findings);
      } catch (e) { errors.push({ input: 'previousSpec', message: (e as Error).message }); }
    }
  }
  if (input.response?.trim()) {
    const res = checkResponse(input.response, input.responseOptions ?? {});
    if (!/:/.test(input.response)) errors.push({ input: 'response', message: 'No headers found. Paste the response with its headers, for example the output of curl -i.' });
    else { inputs.push('response'); findings.push(...res); }
  }
  if (input.jwt?.trim()) {
    try {
      const r = checkJwt(input.jwt, Math.floor((input.now ?? new Date()).getTime() / 1000));
      jwt = r.decoded;
      inputs.push('token');
      findings.push(...r.findings);
    } catch (e) { errors.push({ input: 'jwt', message: (e as Error).message }); }
  }
  if (input.tools?.trim()) {
    try {
      const tools = parseTools(input.tools);
      toolCount = tools.length;
      inputs.push('tools');
      findings.push(...checkTools(tools));
    } catch (e) { errors.push({ input: 'tools', message: (e as Error).message }); }
  }
  if (input.safeguards) {
    inputs.push('safeguards');
    findings.push(...checkSafeguards(input.safeguards));
  }

  const sorted = sortFindings(findings);
  const bySeverity = countBySeverity(sorted);
  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    engineVersion: ENGINE_VERSION,
    api,
    inputs,
    findings: sorted,
    docsScore: api ? docsScore(api) : null,
    grade: gradeFindings(sorted),
    bySeverity,
    worst: SEVERITY_ORDER.find((s) => bySeverity[s] > 0) ?? null,
    release,
    jwt,
    toolCount,
    errors,
  };
}

/** True when the report holds a finding at or above the threshold (the CI gate). */
export function failsGate(report: Report, failOn: Severity | 'none'): boolean {
  if (failOn === 'none') return false;
  return report.findings.some((f) => severityRank(f.severity) <= severityRank(failOn));
}
