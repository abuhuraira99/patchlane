import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXES, FIX_TITLE, fixFor, fixKeyForRule, type FixKey } from '../src/engine/fixes';
import { FRAMEWORK_LABEL, type Framework } from '../src/engine/types';
import { ENGINE_DIR, engineRuleIds } from './helpers';

const FRAMEWORKS = Object.keys(FRAMEWORK_LABEL) as Framework[];
const LANGUAGE: Record<Framework, string> = { express: 'javascript', fastapi: 'python', django: 'python', laravel: 'php', spring: 'java' };
const KEYS = Object.keys(FIXES) as FixKey[];
const RULE_IDS = engineRuleIds();

describe('fix library', () => {
  it('has 19 families for 5 frameworks', () => {
    expect(KEYS).toHaveLength(19);
    expect(FRAMEWORKS).toEqual(['express', 'fastapi', 'django', 'laravel', 'spring']);
    expect(Object.keys(FIX_TITLE).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) expect(FIX_TITLE[key].length, key).toBeGreaterThan(5);
  });

  it.each(KEYS)('%s: a snippet in the right language for every framework', (key) => {
    expect(Object.keys(FIXES[key]).sort()).toEqual([...FRAMEWORKS].sort());
    for (const fw of FRAMEWORKS) {
      const s = FIXES[key][fw];
      expect(s.framework, `${key}/${fw}`).toBe(fw);
      expect(s.language, `${key}/${fw}`).toBe(LANGUAGE[fw]);
      expect(typeof s.code).toBe('string');
      expect(s.code.trim().length, `${key}/${fw} is empty`).toBeGreaterThan(40);
      expect(s.code, `${key}/${fw} has surrounding blank lines`).toBe(s.code.trim());
      expect(s.code, `${key}/${fw} contains TODO`).not.toMatch(/TODO|FIXME|XXX/);
      if (s.note !== undefined) expect(s.note.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps snippets to plain ASCII, as the library promises', () => {
    const offenders = KEYS.flatMap((key) => FRAMEWORKS.filter((fw) => /[^\t\n\r\x20-\x7E]/.test(FIXES[key][fw].code)).map((fw) => `${key}/${fw}`));
    expect(offenders).toEqual([]);
  });
});

describe('fixKeyForRule and fixFor', () => {
  const mapped = RULE_IDS.filter((id) => fixKeyForRule(id) !== null);

  it('maps the main rules to a family', () => {
    expect(fixKeyForRule('API1-OWNERSHIP')).toBe('ownership');
    expect(fixKeyForRule('CORS-REFLECTED')).toBe('cors-allowlist');
    expect(fixKeyForRule('JWT-NO-SIGNATURE')).toBe('jwt-verify');
    expect(fixKeyForRule('TOOL-NEEDS-APPROVAL')).toBe('agent-approval');
    expect(mapped.length).toBeGreaterThan(50);
  });

  it.each(mapped)('%s returns the snippet of its family for every framework', (rule) => {
    const key = fixKeyForRule(rule)!;
    expect(KEYS).toContain(key);
    for (const fw of FRAMEWORKS) {
      const s = fixFor(rule, fw);
      expect(s).not.toBeNull();
      expect(s).toBe(FIXES[key][fw]);
    }
  });

  it('returns null for unknown rules and rules without a code fix', () => {
    for (const rule of ['NOT-A-RULE', '', 'api1-ownership', 'API1-OWNERSHIP ', 'DOC-NO-OWNER']) {
      expect(fixKeyForRule(rule), rule).toBeNull();
      expect(fixFor(rule, 'express'), rule).toBeNull();
    }
  });

  it('uses every family for at least one rule', () => {
    const used = new Set(mapped.map((r) => fixKeyForRule(r)));
    expect(KEYS.filter((k) => !used.has(k))).toEqual([]);
  });

  it('maps only rule ids the engine can emit', () => {
    // read the mapping table from the source so a typo in a rule id cannot hide behind a null
    const source = readFileSync(join(ENGINE_DIR, 'fixes.ts'), 'utf8');
    const table = source.slice(source.indexOf('const RULES_BY_FIX'), source.indexOf('const FIX_BY_RULE'));
    expect(table.length).toBeGreaterThan(100);
    const ids = [...table.matchAll(/'([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(50);
    expect(ids.filter((id) => !RULE_IDS.includes(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length); // one family per rule
  });
});
