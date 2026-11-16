import './app.css';
import {
  analyze, toGherkin, toJson, toMarkdown, toSarif, toWorkflow, gherkinScenario, fixFor, fixKeyForRule, FIX_TITLE,
  AREA_LABEL, FRAMEWORK_LABEL, SAFEGUARDS, SEVERITY_ORDER, revealHidden, REPO_URL, SITE_URL,
  type Finding, type FullReport, type Framework, type Severity,
} from '../engine/index';
import { SAMPLE_JWT, SAMPLE_RESPONSE, SAMPLE_SAFEGUARDS, SAMPLE_SPEC, SAMPLE_SPEC_V1, SAMPLE_TOOLS } from '../engine/samples';
import { el, append, clear, svg, ICON, codeBlock, copyButton, download, debounce } from './ui';

// ---------- state ----------

type DeskId = 'spec' | 'server' | 'token' | 'release' | 'agents' | 'ci';

const DESKS: { id: DeskId; label: string }[] = [
  { id: 'spec', label: 'Spec' },
  { id: 'server', label: 'Server' },
  { id: 'token', label: 'Token' },
  { id: 'release', label: 'Release' },
  { id: 'agents', label: 'Agents' },
  { id: 'ci', label: 'CI' },
];

const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };
const STORE = 'patchlane:v1';
const PREFS = 'patchlane:prefs';

interface Inputs {
  spec: string; previousSpec: string; response: string; origin: string; authenticated: boolean;
  jwt: string; tools: string; safeguardsOn: boolean; safeguards: Record<string, boolean>;
}

const blank = (): Inputs => ({ spec: '', previousSpec: '', response: '', origin: '', authenticated: false, jwt: '', tools: '', safeguardsOn: false, safeguards: {} });

const prefs = (() => {
  try { return JSON.parse(localStorage.getItem(PREFS) || '{}'); } catch { return {}; }
})() as { framework?: Framework; remember?: boolean };

const state = {
  inputs: blank(),
  desk: 'spec' as DeskId,
  framework: (prefs.framework && prefs.framework in FRAMEWORK_LABEL ? prefs.framework : 'express') as Framework,
  remember: !!prefs.remember,
  sev: new Set<Severity>(),
  area: 'all',
  q: '',
  selected: null as string | null,
  report: null as FullReport | null,
  view: 'inputs' as 'inputs' | 'findings',
  ci: { spec: 'openapi.yaml', failOn: 'high' as Severity, compareBase: true },
};

if (state.remember) {
  try { Object.assign(state.inputs, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* ignore a damaged store */ }
}

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
const keyOf = (f: Finding) => `${f.rule}|${f.where}|${f.evidence ?? ''}`;

function deskOf(f: Finding): DeskId {
  if (/^(TOOL|AGENT)-/.test(f.rule)) return 'agents';
  if (/^REL-/.test(f.rule)) return 'release';
  if (/^(HDR|CORS|COOKIE|ERR)-|^SL-STATUS/.test(f.rule)) return 'server';
  if (/^JWT-/.test(f.rule)) return 'token';
  return 'spec';
}

function savePrefs() {
  try { localStorage.setItem(PREFS, JSON.stringify({ framework: state.framework, remember: state.remember })); } catch { /* private mode */ }
}
function saveInputs() {
  try {
    if (state.remember) localStorage.setItem(STORE, JSON.stringify(state.inputs));
    else localStorage.removeItem(STORE);
  } catch { /* storage full or blocked */ }
}

// ---------- shell ----------

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const main = $<HTMLElement>('.desk');
const tabsEl = $<HTMLElement>('#desk-tabs');
const panelsEl = $<HTMLElement>('#desk-panels');
const resultsEl = $<HTMLElement>('#results');
const detailEl = $<HTMLElement>('#detail');
const fwSelect = $<HTMLSelectElement>('#framework');
const viewSwitch = $<HTMLElement>('#view-switch');

for (const [id, label] of Object.entries(FRAMEWORK_LABEL)) fwSelect.appendChild(el('option', { value: id }, label));
fwSelect.value = state.framework;
fwSelect.addEventListener('change', () => { state.framework = fwSelect.value as Framework; savePrefs(); renderDetail(); });

// ---------- code input with line numbers and file drop ----------

interface CodeInputOpts { id: string; label: string; hint?: string | Node; rows?: number; placeholder: string; value: () => string; set: (v: string) => void; accept?: string; spellcheck?: boolean }

function codeInput(o: CodeInputOpts) {
  const area = el('textarea', { id: o.id, class: 'code__area', rows: o.rows ?? 14, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', placeholder: o.placeholder, 'aria-describedby': `${o.id}-status` });
  area.value = o.value();
  const gutter = el('div', { class: 'code__gutter', 'aria-hidden': 'true' });
  const status = el('p', { class: 'field__status', id: `${o.id}-status`, role: 'status' });
  const drop = el('div', { class: 'code__drop', 'aria-hidden': 'true' }, 'Drop the file to read it here');
  const box = el('div', { class: 'code' }, gutter, area, drop);
  const file = el('input', { type: 'file', name: `${o.id}-file`, id: `${o.id}-file`, accept: o.accept ?? '.json,.yaml,.yml,.txt', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });

  const lines = () => {
    const n = Math.max(1, area.value.split('\n').length);
    if (Number(gutter.dataset.n) === n) return;
    gutter.dataset.n = String(n);
    gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
  };
  const sync = () => { gutter.scrollTop = area.scrollTop; };
  const read = (f: File) => {
    if (f.size > 5 * 1024 * 1024) { status.textContent = 'That file is larger than 5 MB. Split it or remove unused parts.'; status.dataset.tone = 'error'; return; }
    f.text().then((t) => { area.value = t; o.set(t); lines(); changed(); });
  };
  area.addEventListener('input', () => { o.set(area.value); lines(); changed(); });
  area.addEventListener('scroll', sync, { passive: true });
  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) read(f); file.value = ''; });
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('is-drop'); });
  box.addEventListener('dragleave', () => box.classList.remove('is-drop'));
  box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('is-drop'); const f = e.dataTransfer?.files?.[0]; if (f) read(f); });
  lines();

  const tools = el('div', { class: 'field__tools' },
    el('button', { type: 'button', class: 'btn-ghost btn-ghost--sm', onclick: () => file.click() }, svg(ICON.file, 14), 'Open a file'),
    el('button', { type: 'button', class: 'btn-ghost btn-ghost--sm', onclick: () => { area.value = ''; o.set(''); lines(); changed(); area.focus(); } }, svg(ICON.clear, 14), 'Clear'),
  );
  const wrap = el('div', { class: 'field' },
    el('div', { class: 'field__head' }, el('label', { for: o.id, class: 'field__label' }, o.label), tools),
    o.hint ? el('p', { class: 'field__hint' }, o.hint) : null,
    box, file, status,
  );
  return { wrap, area, status, refresh: () => { area.value = o.value(); lines(); } };
}

function textField(id: string, label: string, value: () => string, set: (v: string) => void, placeholder = '', hint?: string) {
  const input = el('input', { id, type: 'text', class: 'input', value: value(), placeholder, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
  input.addEventListener('input', () => { set(input.value); changed(); });
  return { wrap: el('div', { class: 'field field--inline' }, el('label', { for: id, class: 'field__label' }, label), hint ? el('p', { class: 'field__hint' }, hint) : null, input), input };
}

function checkField(id: string, label: string, value: () => boolean, set: (v: boolean) => void, hint?: string) {
  const input = el('input', { id, type: 'checkbox', class: 'check__box' });
  input.checked = value();
  input.addEventListener('change', () => { set(input.checked); changed(); });
  return { wrap: el('label', { class: 'check', for: id }, input, el('span', { class: 'check__mark', 'aria-hidden': 'true' }, svg(ICON.check, 12)), el('span', { class: 'check__text' }, el('span', {}, label), hint ? el('span', { class: 'check__hint' }, hint) : null)), input };
}

// ---------- desks ----------

const tabButtons = new Map<DeskId, HTMLButtonElement>();
const panels = new Map<DeskId, HTMLElement>();
const badges = new Map<DeskId, HTMLElement>();
const refreshers: (() => void)[] = [];

for (const d of DESKS) {
  const badge = el('span', { class: 'tab__count', 'aria-hidden': 'true' });
  const b = el('button', { type: 'button', role: 'tab', class: 'tab', id: `tab-${d.id}`, 'aria-controls': `desk-${d.id}`, 'aria-selected': 'false', tabindex: '-1' }, el('span', {}, d.label), badge);
  b.addEventListener('click', () => selectDesk(d.id, true));
  tabsEl.appendChild(b);
  tabButtons.set(d.id, b);
  badges.set(d.id, badge);
  const panel = el('section', { role: 'tabpanel', id: `desk-${d.id}`, class: 'panel', 'aria-labelledby': `tab-${d.id}`, hidden: true });
  panelsEl.appendChild(panel);
  panels.set(d.id, panel);
}

tabsEl.addEventListener('keydown', (e) => {
  const ids = DESKS.map((d) => d.id);
  const i = ids.indexOf(state.desk);
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ids.length;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ids.length) % ids.length;
  if (e.key === 'Home') next = 0;
  if (e.key === 'End') next = ids.length - 1;
  if (next >= 0) { e.preventDefault(); selectDesk(ids[next], true); }
});

function selectDesk(id: DeskId, focus = false) {
  state.desk = id;
  for (const [k, b] of tabButtons) {
    const on = k === id;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    panels.get(k)!.hidden = !on;
  }
  if (focus) tabButtons.get(id)!.focus();
}

// Spec
const specInput = codeInput({
  id: 'in-spec', label: 'OpenAPI or Swagger spec', rows: 18,
  hint: 'JSON or YAML: OpenAPI 3.0, 3.1 or Swagger 2.0. Paste it, drop the file here or open it.',
  placeholder: 'openapi: 3.0.3\ninfo:\n  title: Orders API\n  version: 1.4.0\npaths:\n  /v1/orders/{orderId}:\n    get: …',
  value: () => state.inputs.spec, set: (v) => { state.inputs.spec = v; },
});
append(panels.get('spec')!, [
  el('div', { class: 'panel__intro' }, el('h2', { class: 'panel__title' }, 'Review the API design'), el('p', {}, 'Checks every operation against the OWASP API Security Top 10, the auth schemes, the docs and the inventory, plus any AI endpoints it exposes.')),
  specInput.wrap,
]);
refreshers.push(specInput.refresh);

// Server
const responseInput = codeInput({
  id: 'in-response', label: 'HTTP response with its headers', rows: 12, accept: '.txt,.http,.log',
  hint: el('span', {}, 'Copy the output of ', el('code', {}, 'curl -si -H "Origin: https://unknown.example" https://your-api/v1/me'), ', or the response headers from your browser’s network tab.'),
  placeholder: 'HTTP/1.1 200 OK\nContent-Type: application/json\nAccess-Control-Allow-Origin: …\nSet-Cookie: …\n\n{"id": 42}',
  value: () => state.inputs.response, set: (v) => { state.inputs.response = v; },
});
const originField = textField('in-origin', 'Origin sent with the request', () => state.inputs.origin, (v) => { state.inputs.origin = v; }, 'https://unknown.example', 'Optional. Patchlane tells you when the server copies it back.');
const authField = checkField('in-auth', 'The request was signed in', () => state.inputs.authenticated, (v) => { state.inputs.authenticated = v; }, 'Adds the caching and CORS checks for personal data.');
append(panels.get('server')!, [
  el('div', { class: 'panel__intro' }, el('h2', { class: 'panel__title' }, 'Check the server’s answer'), el('p', {}, 'Reads CORS, cookies, transport headers, version banners, error bodies and rate-limit headers the way a reviewer would.')),
  responseInput.wrap, originField.wrap, authField.wrap,
]);
refreshers.push(responseInput.refresh, () => { originField.input.value = state.inputs.origin; authField.input.checked = state.inputs.authenticated; });

// Token
const jwtInput = codeInput({
  id: 'in-jwt', label: 'JSON Web Token', rows: 5, accept: '.txt,.jwt',
  hint: 'Decoded in this tab. Patchlane never verifies the signature and never sends the token anywhere.',
  placeholder: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOi…',
  value: () => state.inputs.jwt, set: (v) => { state.inputs.jwt = v; },
});
const jwtView = el('div', { class: 'decoded', 'aria-live': 'polite' });
append(panels.get('token')!, [
  el('div', { class: 'panel__intro' }, el('h2', { class: 'panel__title' }, 'Inspect an access token'), el('p', {}, 'Looks at the algorithm, key headers, lifetime, audience, issuer, scopes and anything personal stored in the claims.')),
  jwtInput.wrap, jwtView,
]);
refreshers.push(jwtInput.refresh);

// Release
const prevInput = codeInput({
  id: 'in-previous', label: 'Previous release of the spec', rows: 14,
  hint: 'Compared with the spec on the Spec tab: security regressions, breaking changes and the version bump they need.',
  placeholder: 'The spec as it was in your last release',
  value: () => state.inputs.previousSpec, set: (v) => { state.inputs.previousSpec = v; },
});
const releaseView = el('div', { class: 'release', 'aria-live': 'polite' });
append(panels.get('release')!, [
  el('div', { class: 'panel__intro' }, el('h2', { class: 'panel__title' }, 'Compare two releases'), el('p', {}, 'Finds endpoints that lost authentication or scopes, new sensitive fields, removed operations, and checks MAJOR.MINOR.PATCH.')),
  prevInput.wrap, releaseView,
]);
refreshers.push(prevInput.refresh);

// Agents
const toolsInput = codeInput({
  id: 'in-tools', label: 'Tool definitions an AI agent can call', rows: 12,
  hint: 'An MCP tools/list result, or an OpenAI or Anthropic tools array.',
  placeholder: '{ "tools": [ { "name": "issue_refund", "description": "…", "inputSchema": { … } } ] }',
  value: () => state.inputs.tools, set: (v) => { state.inputs.tools = v; },
});
const sgToggle = checkField('in-sg', 'Review our agent safeguards', () => state.inputs.safeguardsOn, (v) => { state.inputs.safeguardsOn = v; sgList.hidden = !v; }, 'Tick what is in place. Each one left open becomes a finding.');
const sgList = el('div', { class: 'safeguards', hidden: !state.inputs.safeguardsOn });
const sgChecks = SAFEGUARDS.map((s) => {
  const c = checkField(`sg-${s.id}`, s.label, () => !!state.inputs.safeguards[s.id], (v) => { state.inputs.safeguards[s.id] = v; });
  sgList.appendChild(c.wrap);
  return { id: s.id, input: c.input };
});
append(panels.get('agents')!, [
  el('div', { class: 'panel__intro' }, el('h2', { class: 'panel__title' }, 'Review what an agent can do'), el('p', {}, 'Finds invisible characters and model-directed text in tool descriptions, tools that act without approval, risky parameters and look-alike names.')),
  toolsInput.wrap,
  el('fieldset', { class: 'fieldset' }, el('legend', { class: 'visually-hidden' }, 'Agent safeguards'), sgToggle.wrap, sgList),
]);
refreshers.push(toolsInput.refresh, () => {
  sgToggle.input.checked = state.inputs.safeguardsOn; sgList.hidden = !state.inputs.safeguardsOn;
  for (const c of sgChecks) c.input.checked = !!state.inputs.safeguards[c.id];
});

// CI gate
const ciYaml = el('div', { class: 'ci__yaml' });
const ciSpec = textField('ci-spec', 'Spec path in your repository', () => state.ci.spec, (v) => { state.ci.spec = v.trim() || 'openapi.yaml'; }, 'openapi.yaml');
const ciFail = el('select', { id: 'ci-fail', class: 'input' }, ...SEVERITY_ORDER.map((s) => el('option', { value: s }, `${SEV_LABEL[s]} or worse`)));
ciFail.value = state.ci.failOn;
ciFail.addEventListener('change', () => { state.ci.failOn = ciFail.value as Severity; renderCi(); });
const ciBase = checkField('ci-base', 'Compare each pull request with its base branch', () => state.ci.compareBase, (v) => { state.ci.compareBase = v; }, 'Adds the release check to every PR.');
const exportsList = el('div', { class: 'exports' });
append(panels.get('ci')!, [
  el('div', { class: 'panel__intro' }, el('h2', { class: 'panel__title' }, 'Block risky releases in CI'), el('p', {}, 'The same engine runs as a GitHub Action. Findings appear in code scanning and the pull request fails at the level you choose.')),
  ciSpec.wrap,
  el('div', { class: 'field field--inline' }, el('label', { for: 'ci-fail', class: 'field__label' }, 'Fail the check on'), ciFail),
  ciBase.wrap,
  ciYaml,
  el('div', { class: 'field' }, el('p', { class: 'field__label' }, 'Or run it in a terminal'), codeBlock('npx --yes github:abuhuraira99/patchlane check openapi.yaml \\\n  --fail-on high --sarif patchlane.sarif --report report.md', 'yaml', 'Terminal command')),
  el('div', { class: 'field' }, el('p', { class: 'field__label' }, 'Download this check-up'), exportsList),
]);

function renderCi() {
  clear(ciYaml);
  const yaml = toWorkflow({ spec: state.ci.spec, failOn: state.ci.failOn, compareBase: state.ci.compareBase });
  append(ciYaml, [
    el('div', { class: 'field__head' }, el('p', { class: 'field__label' }, '.github/workflows/api-security.yml'),
      el('div', { class: 'field__tools' }, copyButton(() => yaml), el('button', { type: 'button', class: 'btn-ghost btn-ghost--sm', onclick: () => download('api-security.yml', yaml, 'text/yaml') }, svg(ICON.download, 14), 'Download'))),
    codeBlock(yaml, 'yaml', 'GitHub Actions workflow'),
  ]);
}
ciSpec.input.addEventListener('input', renderCi);
ciBase.input.addEventListener('change', renderCi);

// ---------- exports ----------

const EXPORTS = [
  { id: 'md', label: 'Markdown report', file: 'patchlane-report.md', type: 'text/markdown', make: (r: FullReport) => toMarkdown(r, state.framework) },
  { id: 'sarif', label: 'SARIF for code scanning', file: 'patchlane.sarif', type: 'application/sarif+json', make: (r: FullReport) => toSarif(r, { specText: state.inputs.spec }) },
  { id: 'feature', label: 'Security specs (Gherkin)', file: 'security.feature', type: 'text/plain', make: (r: FullReport) => toGherkin(r) },
  { id: 'json', label: 'JSON', file: 'patchlane.json', type: 'application/json', make: (r: FullReport) => toJson(r) },
];

const menuBtn = $<HTMLButtonElement>('#export-button');
const menuList = $<HTMLElement>('#export-list');
for (const x of EXPORTS) {
  const item = el('button', { type: 'button', role: 'menuitem', class: 'menu__item', tabindex: '-1' }, svg(ICON.download, 14), x.label);
  item.addEventListener('click', () => { if (state.report) download(x.file, x.make(state.report), x.type); closeMenu(); menuBtn.focus(); });
  menuList.appendChild(item);
}
function openMenu() { menuList.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); (menuList.querySelector('[role=menuitem]') as HTMLElement)?.focus(); }
function closeMenu() { menuList.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', () => (menuList.hidden ? openMenu() : closeMenu()));
menuList.addEventListener('keydown', (e) => {
  const items = [...menuList.querySelectorAll<HTMLElement>('[role=menuitem]')];
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  if (e.key === 'Escape') { closeMenu(); menuBtn.focus(); }
});
document.addEventListener('click', (e) => { if (!(e.target instanceof Element) || !e.target.closest('#export-menu')) closeMenu(); });

function renderExports() {
  clear(exportsList);
  for (const x of EXPORTS) {
    exportsList.appendChild(el('button', { type: 'button', class: 'btn-ghost', disabled: !state.report || !state.report.inputs.length, onclick: () => state.report && download(x.file, x.make(state.report), x.type) }, svg(ICON.download, 14), x.label));
  }
  menuBtn.disabled = !state.report || !state.report.inputs.length;
}

// ---------- analysis ----------

function runNow() {
  const i = state.inputs;
  state.report = analyze({
    spec: i.spec, previousSpec: i.previousSpec, response: i.response, jwt: i.jwt, tools: i.tools,
    responseOptions: { testOrigin: i.origin.trim() || undefined, authenticated: i.authenticated },
    safeguards: i.safeguardsOn ? i.safeguards : undefined,
  });
  if (state.selected && !state.report.findings.some((f) => keyOf(f) === state.selected)) state.selected = null;
  renderAll();
}
const run = debounce(runNow, 220);

function changed() { saveInputs(); run(); }

function renderStatus() {
  const r = state.report;
  const err = (k: string) => r?.errors.find((e) => e.input === k)?.message;
  const set = (node: HTMLElement, text: string, tone: 'ok' | 'error' | '' = '') => { node.textContent = text; node.dataset.tone = tone; };

  if (!state.inputs.spec.trim()) set(specInput.status, '');
  else if (err('spec')) set(specInput.status, err('spec')!, 'error');
  else if (r?.api) set(specInput.status, `${r.api.title} ${r.api.version} · ${r.api.operations.length} operation${r.api.operations.length === 1 ? '' : 's'} · ${r.api.openapi.startsWith('2') ? 'Swagger' : 'OpenAPI'} ${r.api.openapi}`, 'ok');

  if (!state.inputs.response.trim()) set(responseInput.status, '');
  else if (err('response')) set(responseInput.status, err('response')!, 'error');
  else set(responseInput.status, `${r?.findings.filter((f) => deskOf(f) === 'server').length ?? 0} findings in the headers and body`, 'ok');

  clear(jwtView);
  if (!state.inputs.jwt.trim()) set(jwtInput.status, '');
  else if (err('jwt')) set(jwtInput.status, err('jwt')!, 'error');
  else if (r?.jwt) {
    set(jwtInput.status, `alg ${String(r.jwt.header.alg ?? 'missing')} · ${Object.keys(r.jwt.payload).length} claims`, 'ok');
    const when = (v: unknown) => (typeof v === 'number' ? new Date(v * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : null);
    const claims = el('dl', { class: 'claims' });
    for (const [k, v] of Object.entries(r.jwt.payload)) {
      const date = ['exp', 'iat', 'nbf', 'auth_time'].includes(k) ? when(v) : null;
      append(claims, [el('dt', {}, k), el('dd', {}, typeof v === 'string' ? v : JSON.stringify(v), date ? el('span', { class: 'claims__date' }, date) : null)]);
    }
    append(jwtView, [
      el('p', { class: 'field__label' }, 'Header'), codeBlock(JSON.stringify(r.jwt.header, null, 2), 'json', 'Token header'),
      el('p', { class: 'field__label' }, 'Claims'), claims,
    ]);
  }

  clear(releaseView);
  if (!state.inputs.previousSpec.trim()) set(prevInput.status, '');
  else if (err('previousSpec')) set(prevInput.status, err('previousSpec')!, 'error');
  else if (r?.release) {
    const rel = r.release;
    set(prevInput.status, `${rel.declared.from} → ${rel.declared.to}`, 'ok');
    const row = (label: string, value: string, tone = '') => el('div', { class: 'release__row', 'data-tone': tone }, el('dt', {}, label), el('dd', {}, value));
    releaseView.appendChild(el('dl', { class: 'release__grid' },
      row('Added', String(rel.added.length)), row('Removed', String(rel.removed.length), rel.removed.length ? 'warn' : ''),
      row('Changed', String(rel.changed.length)),
      row('Needs', `${rel.requiredBump} bump`), row('Version moved by', rel.declared.bump === 'unknown' ? 'unreadable' : rel.declared.bump, rel.bumpOk ? 'ok' : 'warn'),
    ));
    if (rel.changed.length) releaseView.appendChild(el('ul', { class: 'release__list' }, ...rel.changed.slice(0, 8).map((c) => el('li', {}, c))));
  }

  if (!state.inputs.tools.trim()) set(toolsInput.status, '');
  else if (err('tools')) set(toolsInput.status, err('tools')!, 'error');
  else set(toolsInput.status, `${r?.toolCount ?? 0} tool${r?.toolCount === 1 ? '' : 's'} read`, 'ok');

  for (const d of DESKS) {
    const n = r ? r.findings.filter((f) => deskOf(f) === d.id).length : 0;
    const b = badges.get(d.id)!;
    b.textContent = d.id === 'ci' || !n ? '' : String(n);
    tabButtons.get(d.id)!.setAttribute('aria-label', d.id === 'ci' || !n ? d.label : `${d.label}, ${n} finding${n === 1 ? '' : 's'}`);
  }
}

// ---------- results ----------

function visibleFindings(): Finding[] {
  const r = state.report;
  if (!r) return [];
  const q = state.q.trim().toLowerCase();
  return r.findings.filter((f) =>
    (!state.sev.size || state.sev.has(f.severity)) &&
    (state.area === 'all' || f.area === state.area) &&
    (!q || `${f.title} ${f.where} ${f.rule} ${f.evidence ?? ''} ${f.detail}`.toLowerCase().includes(q)));
}

let listEl: HTMLElement | null = null;

function renderResults() {
  clear(resultsEl);
  const r = state.report;
  if (!r || !r.inputs.length) {
    const hasErrors = !!r?.errors.length;
    resultsEl.appendChild(el('div', { class: 'empty' },
      el('div', { class: 'empty__mark', 'aria-hidden': 'true' }, svg(ICON.lock, 22)),
      el('h2', { class: 'empty__title' }, hasErrors ? 'Patchlane could not read that input' : 'Nothing checked yet'),
      el('p', { class: 'empty__text' }, hasErrors ? 'The message under the field says what went wrong. Fix it and the findings appear here at once.' : 'Paste a spec, a server response, a token or a tool list on the left. The check runs as you type, in this tab.'),
      hasErrors ? null : el('button', { type: 'button', class: 'btn btn--primary', onclick: loadSample }, 'Load the sample'),
      hasErrors ? null : el('p', { class: 'empty__note' }, 'The sample is Larkspur, a made-up lending API with 9 operations, a response, a token and five agent tools.'),
    ));
    return;
  }

  // summary
  const gradeTone = r.grade.letter === 'A' || r.grade.letter === 'B' ? 'good' : r.grade.letter === 'C' ? 'mid' : 'bad';
  const title = r.api ? `${r.api.title} ${r.api.version}`.trim() : 'Check-up';
  const summary = el('div', { class: 'summary' },
    el('div', { class: 'grade', 'data-tone': gradeTone, role: 'img', 'aria-label': `Grade ${r.grade.letter}, ${r.grade.score} out of 100` }, el('span', { class: 'grade__letter' }, r.grade.letter), el('span', { class: 'grade__score' }, `${r.grade.score}/100`)),
    el('div', { class: 'summary__text' },
      el('h2', { class: 'summary__title' }, title),
      el('p', { class: 'summary__meta' }, `${r.findings.length} finding${r.findings.length === 1 ? '' : 's'} from ${listFormat.format(r.inputs.map((x) => ({ spec: 'the spec', release: 'the release diff', response: 'the response', token: 'the token', tools: 'the tool list', safeguards: 'the safeguards' } as Record<string, string>)[x] ?? x))}`),
      r.docsScore ? el('p', { class: 'summary__docs' }, el('span', { class: 'meter', style: `--v:${r.docsScore.score}`, 'aria-hidden': 'true' }), `Documentation ${r.docsScore.score}/100`) : null,
    ),
  );

  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by severity' },
    ...SEVERITY_ORDER.map((s) => {
      const n = r.bySeverity[s];
      const b = el('button', { type: 'button', class: 'chip', 'data-sev': s, 'aria-pressed': String(state.sev.has(s)), disabled: !n }, el('i', { class: 'sev-dot', 'data-sev': s, 'aria-hidden': 'true' }), SEV_LABEL[s], el('span', { class: 'chip__n' }, String(n)));
      b.addEventListener('click', () => { state.sev.has(s) ? state.sev.delete(s) : state.sev.add(s); renderResults(); });
      return b;
    }));

  const areas = [...new Set(r.findings.map((f) => f.area))];
  const areaSel = el('select', { class: 'input input--sm', name: 'area', id: 'filter-area', 'aria-label': 'Filter by area' }, el('option', { value: 'all' }, 'All areas'), ...areas.map((a) => el('option', { value: a }, AREA_LABEL[a])));
  areaSel.value = areas.includes(state.area as never) ? state.area : 'all';
  areaSel.addEventListener('change', () => { state.area = areaSel.value; renderResults(); });
  const search = el('input', { type: 'search', name: 'q', id: 'filter-q', class: 'input input--sm', placeholder: 'Filter findings', 'aria-label': 'Filter findings by text', value: state.q });
  search.addEventListener('input', debounce(() => { state.q = search.value; renderList(); }, 120));

  append(resultsEl, [summary, el('div', { class: 'filters' }, chips, el('div', { class: 'filters__row' }, el('span', { class: 'filters__search' }, svg(ICON.search, 14), search), areaSel))]);

  if (r.errors.length) {
    resultsEl.appendChild(el('div', { class: 'notice', role: 'note' }, ...r.errors.map((e) => el('p', {}, `${{ spec: 'Spec', previousSpec: 'Previous release', response: 'Response', jwt: 'Token', tools: 'Tools' }[e.input]}: ${e.message}`))));
  }
  listEl = el('ul', { class: 'list', role: 'listbox', 'aria-label': 'Findings', tabindex: '0' });
  resultsEl.appendChild(listEl);
  renderList();
}

function renderList() {
  if (!listEl) return;
  clear(listEl);
  const list = visibleFindings();
  if (!list.length) {
    listEl.appendChild(el('li', { class: 'list__empty', role: 'presentation' }, state.report?.findings.length ? 'No finding matches these filters.' : 'No findings from these inputs. Re-run Patchlane on every release so it stays that way.'));
    listEl.removeAttribute('aria-activedescendant');
    return;
  }
  list.forEach((f, i) => {
    const k = keyOf(f);
    const id = `f-${i}`;
    const li = el('li', { id, role: 'option', class: 'row', 'aria-selected': String(k === state.selected), 'data-key': k },
      el('i', { class: 'sev-dot', 'data-sev': f.severity, 'aria-hidden': 'true' }),
      el('span', { class: 'row__main' }, el('span', { class: 'row__title' }, f.title), el('span', { class: 'row__where' }, revealHidden(f.where))),
      el('span', { class: 'row__meta' }, el('span', { class: 'row__sev' }, SEV_LABEL[f.severity]), el('span', { class: 'row__rule' }, f.rule)),
    );
    li.addEventListener('click', () => select(k, true));
    listEl!.appendChild(li);
  });
  const cur = listEl.querySelector('[aria-selected="true"]');
  if (cur) listEl.setAttribute('aria-activedescendant', cur.id); else listEl.removeAttribute('aria-activedescendant');
}

function move(step: number) {
  const list = visibleFindings();
  if (!list.length) return;
  const i = list.findIndex((f) => keyOf(f) === state.selected);
  const next = list[Math.min(list.length - 1, Math.max(0, i < 0 ? 0 : i + step))];
  select(keyOf(next), false);
  listEl?.querySelector(`[data-key="${CSS.escape(keyOf(next))}"]`)?.scrollIntoView({ block: 'nearest' });
}

function select(k: string | null, openOnSmall: boolean) {
  state.selected = k;
  for (const li of listEl?.querySelectorAll<HTMLElement>('.row') ?? []) li.setAttribute('aria-selected', String(li.dataset.key === k));
  const cur = listEl?.querySelector('[aria-selected="true"]');
  if (cur && listEl) listEl.setAttribute('aria-activedescendant', cur.id);
  main.classList.toggle('has-detail', !!k);
  renderDetail();
  if (openOnSmall && k && matchMedia('(max-width: 1199px)').matches) (detailEl.querySelector('.detail__close') as HTMLElement)?.focus();
}

listObserver();
function listObserver() {
  resultsEl.addEventListener('keydown', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('.list')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    if (e.key === 'Home') { e.preventDefault(); move(-1e6); }
    if (e.key === 'End') { e.preventDefault(); move(1e6); }
    if (e.key === 'Enter' && state.selected && matchMedia('(max-width: 1199px)').matches) select(state.selected, true);
  });
}

document.addEventListener('keydown', (e) => {
  const t = e.target;
  if ((t instanceof Element && t.closest('input, textarea, select, [contenteditable], [role=tab], button')) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'j') { move(1); }
  if (e.key === 'k') { move(-1); }
  if (e.key === 'Escape' && state.selected) { select(null, false); listEl?.focus(); }
});

// ---------- detail ----------

/** What to change in a fix pattern for this finding, in words that fit what the finding is about. */
function adaptNote(f: Finding): string {
  const where = revealHidden(f.where).split(' · ')[0];
  if (/^(GET|PUT|POST|DELETE|PATCH|HEAD|OPTIONS|TRACE) \S/.test(where)) return `Written for an example route: put in the route, parameter and model of ${where}.`;
  if (f.area === 'server') return 'Written for an example app: put in your own origins, cookie names and paths.';
  if (f.area === 'token') return 'Written for an example issuer: put in your own issuer, audience and key source.';
  if (f.area === 'agent' && /^tools? /.test(where)) return `Written for an example tool: put in the tool and fields of ${where.replace(/^tools? /, '')}.`;
  if (f.area === 'agent') return 'Written for an example agent backend: put in your own tools and limits.';
  return 'Written for an example app: put in your own names.';
}

function renderDetail() {
  clear(detailEl);
  const f = state.report?.findings.find((x) => keyOf(x) === state.selected);
  if (!f) {
    detailEl.appendChild(el('div', { class: 'detail__idle' },
      el('p', { class: 'detail__idle-title' }, state.report?.findings.length ? 'Pick a finding to see its fix' : 'Fixes appear here'),
      el('p', {}, 'Each finding opens with why it matters, the fix in your framework, a test that proves it, and where the rule comes from.'),
      state.report?.findings.length ? el('p', { class: 'detail__keys' }, el('kbd', {}, 'J'), ' and ', el('kbd', {}, 'K'), ' move through the list.') : null,
    ));
    return;
  }
  const list = visibleFindings();
  const i = list.findIndex((x) => keyOf(x) === state.selected);

  const head = el('div', { class: 'detail__head' },
    el('button', { type: 'button', class: 'btn-ghost btn-ghost--sm detail__close', onclick: () => { select(null, false); listEl?.focus(); } }, svg(ICON.back, 14), 'All findings'),
    el('div', { class: 'detail__nav' },
      el('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Previous finding', disabled: i <= 0, onclick: () => move(-1) }, svg(ICON.left, 14)),
      el('span', { class: 'detail__pos' }, i >= 0 ? `${i + 1} of ${list.length}` : ''),
      el('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Next finding', disabled: i < 0 || i >= list.length - 1, onclick: () => move(1) }, svg(ICON.right, 14)),
    ),
  );

  const meta = el('div', { class: 'detail__meta' },
    el('span', { class: 'sev-pill', 'data-sev': f.severity }, el('i', { class: 'sev-dot', 'data-sev': f.severity, 'aria-hidden': 'true' }), SEV_LABEL[f.severity]),
    el('span', { class: 'detail__rule' }, f.rule), el('span', { class: 'detail__area' }, AREA_LABEL[f.area]));

  const body = el('article', { class: 'detail__body', 'aria-labelledby': 'detail-title' },
    meta,
    el('h2', { id: 'detail-title', class: 'detail__title' }, f.title),
    el('dl', { class: 'detail__where' }, el('dt', {}, 'Where'), el('dd', {}, revealHidden(f.where))),
    f.evidence ? el('div', { class: 'evidence' }, el('p', { class: 'field__label' }, 'What matched'), el('p', { class: 'evidence__text' }, revealHidden(f.evidence))) : null,
    el('section', { class: 'detail__block' }, el('h3', {}, 'Why it matters'), el('p', {}, f.detail)),
    el('section', { class: 'detail__block' }, el('h3', {}, 'The fix'), el('p', {}, f.fix)),
  );

  const key = fixKeyForRule(f.rule);
  if (key) {
    const fwTabs = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Framework' });
    const codeSlot = el('div', { class: 'fix__code', role: 'tabpanel', id: 'fix-panel' });
    const draw = () => {
      clear(codeSlot);
      const s = fixFor(f.rule, state.framework);
      if (!s) return;
      append(codeSlot, [
        el('div', { class: 'fix__bar' }, el('span', { class: 'fix__lang' }, `The pattern in ${FRAMEWORK_LABEL[state.framework]}`), copyButton(() => s.code.trim(), 'Copy code')),
        codeBlock(s.code.trim(), s.language, `Fix in ${FRAMEWORK_LABEL[state.framework]}`),
        el('p', { class: 'fix__note' }, `${adaptNote(f)}${s.note ? ' ' + s.note : ''}`),
      ]);
      for (const b of fwTabs.querySelectorAll<HTMLElement>('[role=tab]')) { const on = b.dataset.fw === state.framework; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
    };
    for (const [id, label] of Object.entries(FRAMEWORK_LABEL) as [Framework, string][]) {
      const b = el('button', { type: 'button', role: 'tab', class: 'seg__item', 'data-fw': id, 'aria-controls': 'fix-panel' }, label.split(' (')[0].replace(' REST Framework', '').replace(' Boot', ''));
      b.addEventListener('click', () => { state.framework = id; fwSelect.value = id; savePrefs(); draw(); });
      fwTabs.appendChild(b);
    }
    fwTabs.addEventListener('keydown', (e) => {
      const ids = Object.keys(FRAMEWORK_LABEL) as Framework[];
      const j = ids.indexOf(state.framework);
      const n = e.key === 'ArrowRight' ? (j + 1) % ids.length : e.key === 'ArrowLeft' ? (j - 1 + ids.length) % ids.length : -1;
      if (n >= 0) { e.preventDefault(); state.framework = ids[n]; fwSelect.value = ids[n]; savePrefs(); draw(); (fwTabs.querySelector(`[data-fw="${ids[n]}"]`) as HTMLElement).focus(); }
    });
    body.appendChild(el('section', { class: 'detail__block fix' }, el('h3', {}, FIX_TITLE[key]), fwTabs, codeSlot));
    draw();
  }

  const g = gherkinScenario(f);
  if (g) {
    body.appendChild(el('section', { class: 'detail__block' },
      el('div', { class: 'fix__bar' }, el('h3', {}, 'Prove it is fixed'), copyButton(() => g, 'Copy test')),
      el('p', { class: 'detail__sub' }, 'A Given-When-Then test for your suite. It fails today and passes once the fix ships.'),
      codeBlock(g, 'gherkin', 'Security test scenario')));
  }

  const refs = f.refs.filter((x) => x.standard || x.course);
  if (refs.length) {
    body.appendChild(el('section', { class: 'detail__block' }, el('h3', {}, 'Where this rule comes from'),
      el('ul', { class: 'refs' }, ...refs.map((x) => el('li', {},
        x.standard ? el('span', { class: 'refs__std' }, x.standard) : null,
        x.course ? el('span', { class: 'refs__course' }, `APIsec University: ${x.course}`) : null)))));
  }
  append(detailEl, [head, body]);
  detailEl.scrollTop = 0;
}

// ---------- view switch (phones) ----------

for (const b of viewSwitch.querySelectorAll<HTMLButtonElement>('button')) {
  b.addEventListener('click', () => setView(b.dataset.view as 'inputs' | 'findings'));
}
function setView(v: 'inputs' | 'findings') {
  state.view = v;
  main.dataset.view = v;
  for (const b of viewSwitch.querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
}

// ---------- remember toggle ----------

const remember = $<HTMLInputElement>('#remember');
remember.checked = state.remember;
remember.addEventListener('change', () => { state.remember = remember.checked; savePrefs(); saveInputs(); });

// ---------- sample ----------

function loadSample() {
  state.inputs = { spec: SAMPLE_SPEC, previousSpec: SAMPLE_SPEC_V1, response: SAMPLE_RESPONSE, origin: 'https://unknown.example', authenticated: true, jwt: SAMPLE_JWT, tools: SAMPLE_TOOLS, safeguardsOn: true, safeguards: { ...SAMPLE_SAFEGUARDS } };
  state.sev.clear(); state.area = 'all'; state.q = ''; state.selected = null;
  for (const r of refreshers) r();
  saveInputs();
  runNow();
  if (matchMedia('(max-width: 759px)').matches) setView('findings');
}
$<HTMLButtonElement>('#load-sample').addEventListener('click', loadSample);

// ---------- render ----------

function renderAll() {
  renderStatus();
  renderResults();
  renderDetail();
  renderExports();
  const n = state.report?.findings.length ?? 0;
  const fb = viewSwitch.querySelector<HTMLElement>('[data-view="findings"] .switch__n');
  if (fb) fb.textContent = n ? String(n) : '';
  main.classList.toggle('has-detail', !!state.selected);
}

selectDesk('spec');
setView('inputs');
renderCi();
const params = new URLSearchParams(location.search);
if (location.hash === '#ci') selectDesk('ci');
if (params.has('sample')) loadSample();
else runNow();

// footer links
$<HTMLAnchorElement>('#repo-link').href = REPO_URL;
void SITE_URL;
