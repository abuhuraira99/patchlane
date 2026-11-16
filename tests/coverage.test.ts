import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine/report';
import { SAFEGUARDS } from '../src/engine/agent';
import { ALL_FIXTURES, NAMED_FIXTURES } from '../src/engine/fixtures';
import { SAFEGUARD_RULES, engineRuleIds } from './helpers';

const RULE_IDS = engineRuleIds();
const REPORTS = Object.entries(NAMED_FIXTURES).map(([name, input]) => ({ name, report: analyze(input) }));

describe('rule coverage of the fixtures', () => {
  it('finds the engine rule list in the source', () => {
    expect(RULE_IDS.length).toBeGreaterThanOrEqual(95);
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
    for (const id of RULE_IDS) expect(id).toMatch(/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/);
  });

  it('lists the same safeguard rules the engine builds', () => {
    expect(SAFEGUARDS.map((s) => `AGENT-${s.id.toUpperCase()}`).sort()).toEqual([...SAFEGUARD_RULES].sort());
  });

  it('exports every named fixture in ALL_FIXTURES', () => {
    expect(ALL_FIXTURES).toHaveLength(Object.keys(NAMED_FIXTURES).length);
  });

  it.each(RULE_IDS)('%s is produced by at least one fixture', (id) => {
    const producers = REPORTS.filter(({ report }) => report.findings.some((f) => f.rule === id)).map(({ name }) => name);
    expect(producers, `no fixture produces ${id}`).not.toHaveLength(0);
  });

  it('no fixture produces a rule id outside the engine list', () => {
    const known = new Set(RULE_IDS);
    const unknown = REPORTS.flatMap(({ name, report }) => report.findings.filter((f) => !known.has(f.rule)).map((f) => `${name}: ${f.rule}`));
    expect(unknown).toEqual([]);
  });

  it.each(REPORTS.map(({ name, report }) => [name, report] as const))('%s parses without input errors', (_name, report) => {
    expect(report.errors).toEqual([]);
    expect(report.inputs.length).toBeGreaterThan(0);
  });
});
