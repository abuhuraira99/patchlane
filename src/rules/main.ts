import '../app/app.css';
import './rules.css';
import { analyze, AREA_LABEL, SEVERITY_ORDER, fixKeyForRule, FIX_TITLE, type Finding, type FindingArea } from '../engine/index';
import { ALL_FIXTURES } from '../engine/fixtures';
import { el, append, clear } from '../app/ui';

// The catalogue is built by running the real engine over fixtures that trigger every rule,
// so this page can never list a rule the engine does not have, or miss one it does.

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

interface Entry { rule: string; area: FindingArea; severity: Finding['severity']; title: string; detail: string; fix: string; refs: Finding['refs'] }

function build(): Entry[] {
  const seen = new Map<string, Entry>();
  for (const input of ALL_FIXTURES) {
    for (const f of analyze(input).findings) {
      const prev = seen.get(f.rule);
      if (!prev || SEVERITY_ORDER.indexOf(f.severity) < SEVERITY_ORDER.indexOf(prev.severity)) {
        seen.set(f.rule, { rule: f.rule, area: f.area, severity: f.severity, title: GENERIC[f.rule] ?? f.title, detail: f.detail, fix: f.fix, refs: f.refs });
      }
    }
  }
  return [...seen.values()];
}

const entries = build();
const root = document.getElementById('rules')!;
const count = document.getElementById('rule-count')!;
count.textContent = String(entries.length);
const search = document.getElementById('rule-search') as HTMLInputElement;
const ORDER: FindingArea[] = ['api', 'auth', 'inventory', 'docs', 'server', 'token', 'release', 'agent'];
const SEV: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

function render() {
  clear(root);
  const norm = (t: string) => t.toLowerCase().replace(/[-_]+/g, ' ');
  const q = norm(search.value.trim());
  let shown = 0;
  for (const area of ORDER) {
    const list = entries.filter((e) => e.area === area && (!q || norm(`${e.rule} ${e.title} ${e.detail} ${e.fix} ${e.refs.map((r) => r.standard).join(' ')}`).includes(q)))
      .sort((a, b) => a.rule.localeCompare(b.rule, 'en', { numeric: true }));
    if (!list.length) continue;
    shown += list.length;
    const section = el('section', { class: 'rules__group', 'aria-labelledby': `g-${area}` },
      el('h2', { id: `g-${area}`, class: 'rules__group-title' }, AREA_LABEL[area], el('span', {}, String(list.length))));
    for (const e of list) {
      const key = fixKeyForRule(e.rule);
      section.appendChild(el('article', { class: 'rule', id: e.rule },
        el('div', { class: 'rule__head' },
          el('a', { class: 'rule__id', href: `#${e.rule}` }, e.rule),
          el('span', { class: 'sev-pill', 'data-sev': e.severity }, el('i', { class: 'sev-dot', 'data-sev': e.severity, 'aria-hidden': 'true' }), `Up to ${SEV[e.severity].toLowerCase()}`)),
        el('h3', { class: 'rule__title' }, e.title),
        el('p', { class: 'rule__text' }, e.detail),
        el('p', { class: 'rule__fix' }, el('b', {}, 'Fix. '), e.fix),
        el('p', { class: 'rule__src' },
          ...e.refs.filter((r) => r.standard).map((r) => el('span', {}, r.standard!)),
          key ? el('span', { class: 'rule__code' }, `Fix code: ${FIX_TITLE[key]}, in 5 frameworks`) : null),
      ));
    }
    root.appendChild(section);
  }
  if (!shown) root.appendChild(el('p', { class: 'rules__none' }, 'No rule matches that search.'));
}

search.addEventListener('input', render);
render();
// jump to a linked rule once the web font has set the final line lengths
const jump = () => { if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'start' }); };
(document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(jump));
window.addEventListener('hashchange', jump);
void append;
