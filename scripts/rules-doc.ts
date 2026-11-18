// Writes docs/RULES.md from the engine itself: every rule the fixtures trigger, with its area, worst
// severity, standard and fix family. Run: npx vite-node scripts/rules-doc.ts
import { writeFileSync } from 'node:fs';
import { analyze, AREA_LABEL, SEVERITY_ORDER, fixKeyForRule, FIX_TITLE, type Finding, type FindingArea } from '../src/engine/index';
import { ALL_FIXTURES } from '../src/engine/fixtures';

const GENERIC: Record<string, string> = {
  'COOKIE-FLAGS': 'A cookie is missing Secure, HttpOnly or SameSite',
  'COOKIE-SAMESITE-NONE': 'A cookie uses SameSite=None without Secure',
  'HDR-VERSION-LEAK': 'A header names the server software or its version',
  'DOC-UNDESCRIBED': 'Many operations have no summary or description',
  'DOC-NO-ERRORS': 'Many operations document no error response',
  'JWT-SHARED-SECRET': 'The token is signed with a shared secret',
  'JWT-KEY-IN-HEADER': 'The token header points to its own key',
  'JWT-LONG-LIFE': 'The token lives longer than a day',
  'REL-SEMVER': 'The release needs a bigger version bump',
  'SL-STATUS-DISCLOSURE': 'A 401 or 403 tells the caller the resource exists',
};
const seen = new Map<string, Finding>();
for (const input of ALL_FIXTURES) for (const f of analyze(input).findings) {
  const p = seen.get(f.rule);
  if (!p || SEVERITY_ORDER.indexOf(f.severity) < SEVERITY_ORDER.indexOf(p.severity)) seen.set(f.rule, f);
}
const ORDER: FindingArea[] = ['api', 'auth', 'inventory', 'docs', 'server', 'token', 'release', 'agent'];
const L: string[] = [
  '# Patchlane rules',
  '',
  `${seen.size} checks, generated from the engine by \`scripts/rules-doc.ts\`. Severity is the highest the rule can raise; most rules scale with context (a public write is worse than a public read). Browse them with search at [patchlane.pages.dev/rules](https://patchlane.pages.dev/rules/).`,
  '',
];
for (const area of ORDER) {
  const list = [...seen.values()].filter((f) => f.area === area).sort((a, b) => a.rule.localeCompare(b.rule, 'en', { numeric: true }));
  if (!list.length) continue;
  L.push(`## ${AREA_LABEL[area]} (${list.length})`, '', '| Rule | Up to | What it finds | Standard | Fix code |', '|---|---|---|---|---|');
  for (const f of list) {
    const std = [...new Set(f.refs.map((r) => r.standard).filter(Boolean))].join('<br>') || '—';
    const key = fixKeyForRule(f.rule);
    L.push(`| \`${f.rule}\` | ${f.severity} | ${(GENERIC[f.rule] ?? f.title).replace(/\|/g, '\|')} | ${std} | ${key ? FIX_TITLE[key] : '—'} |`);
  }
  L.push('');
}
writeFileSync('docs/RULES.md', L.join('\n'));
console.log(`docs/RULES.md: ${seen.size} rules`);
