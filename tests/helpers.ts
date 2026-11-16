// Shared helpers for the test suite (not a test file itself).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Finding } from '../src/engine/types';
import type { FullReport } from '../src/engine/report';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE_DIR = join(ROOT, 'src', 'engine');

/** The safeguard rules are built at run time (`AGENT-${id}`), so they never appear as literals. */
export const SAFEGUARD_RULES = [
  'AGENT-APPROVAL', 'AGENT-IDENTITY', 'AGENT-SCOPES', 'AGENT-LOG', 'AGENT-PINNED', 'AGENT-EGRESS', 'AGENT-UNTRUSTED', 'AGENT-LIMITS',
];

/** Every `rule: 'X'` literal in src/engine/*.ts plus the safeguard rules, sorted. */
export function engineRuleIds(): string[] {
  const ids = new Set<string>(SAFEGUARD_RULES);
  for (const file of readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts'))) {
    const text = readFileSync(join(ENGINE_DIR, file), 'utf8');
    for (const m of text.matchAll(/rule: '([A-Z0-9-]+)'/g)) ids.add(m[1]);
  }
  return [...ids].sort();
}

export const rulesOf = (r: FullReport): Set<string> => new Set(r.findings.map((f) => f.rule));

export function only(r: FullReport | Finding[], rule: string, where?: string): Finding[] {
  const list = Array.isArray(r) ? r : r.findings;
  return list.filter((f) => f.rule === rule && (where === undefined || f.where === where));
}

/** The single finding for a rule (and place); fails loudly when there is not exactly one. */
export function one(r: FullReport | Finding[], rule: string, where?: string): Finding {
  const hits = only(r, rule, where);
  if (hits.length !== 1) {
    const list = Array.isArray(r) ? r : r.findings;
    throw new Error(`expected one ${rule}${where ? ` at ${where}` : ''}, got ${hits.length}: ${list.map((f) => `${f.rule}@${f.where}`).join('; ')}`);
  }
  return hits[0];
}

/** A small deterministic PRNG (mulberry32) so fuzz failures can be replayed. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
