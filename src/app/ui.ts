// Small DOM helpers for the analyzer. Every string from the user's input goes in through
// textContent or attributes, never innerHTML, so pasted specs and tokens cannot inject markup.

type Child = Node | string | number | false | null | undefined;
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') node.className = String(v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  append(node, children);
  return node;
}

export function append(node: Node, children: (Child | Child[])[]) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function svg(path: string, size = 16, extra = ''): SVGSVGElement {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.5');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  if (extra) s.setAttribute('class', extra);
  for (const d of path.split('|')) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
  }
  return s;
}

/** One stroke family for every glyph in the app (16px grid, 1.5 stroke). */
export const ICON = {
  copy: 'M5.5 5.5h7v7h-7z|M3.5 10.5v-7h7',
  check: 'M3.5 8.5l3 3 6-7',
  download: 'M8 2.5v8|M4.5 7.5 8 11l3.5-3.5|M3 13.5h10',
  file: 'M4 1.75h5l3 3v9.5H4z|M9 1.75v3h3',
  clear: 'M4 4l8 8|M12 4l-8 8',
  chevron: 'M4.5 6.5 8 10l3.5-3.5',
  left: 'M9.5 4 5.5 8l4 4',
  right: 'M6.5 4l4 4-4 4',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M10.6 10.6 14 14',
  lock: 'M4.5 7.5h7v6h-7z|M5.75 7.5V5.25a2.25 2.25 0 0 1 4.5 0V7.5',
  spark: 'M8 2.5v3|M8 10.5v3|M2.5 8h3|M10.5 8h3',
  back: 'M10 3.5 5.5 8l4.5 4.5',
};

export function clear(node: Element) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function download(name: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = el('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** A copy button that confirms in place for 1.6 s. */
export function copyButton(getText: () => string, label = 'Copy'): HTMLButtonElement {
  const text = el('span', {}, label);
  const b = el('button', { type: 'button', class: 'btn-ghost btn-ghost--sm', 'aria-label': label }, svg(ICON.copy, 14), text);
  b.addEventListener('click', async () => {
    const ok = await copyText(getText());
    text.textContent = ok ? 'Copied' : 'Press Ctrl+C';
    b.classList.toggle('is-done', ok);
    setTimeout(() => { text.textContent = label; b.classList.remove('is-done'); }, 1600);
  });
  return b;
}

// ---------- a small highlighter for the fix code, YAML, JSON and Gherkin ----------

const KEYWORDS: Record<string, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'of', 'in', 'new', 'await', 'async', 'import', 'from', 'export', 'default', 'throw', 'try', 'catch', 'true', 'false', 'null', 'undefined', 'class', 'typeof'],
  python: ['def', 'return', 'if', 'elif', 'else', 'for', 'in', 'not', 'and', 'or', 'import', 'from', 'as', 'class', 'raise', 'try', 'except', 'with', 'async', 'await', 'None', 'True', 'False', 'is', 'lambda', 'pass'],
  php: ['function', 'return', 'if', 'else', 'foreach', 'as', 'new', 'use', 'class', 'public', 'private', 'protected', 'static', 'fn', 'throw', 'null', 'true', 'false', 'namespace', 'extends'],
  java: ['public', 'private', 'protected', 'class', 'static', 'final', 'void', 'return', 'if', 'else', 'new', 'import', 'package', 'throw', 'throws', 'try', 'catch', 'null', 'true', 'false', 'var', 'extends', 'implements', 'interface', 'record'],
  yaml: ['true', 'false', 'null'],
  gherkin: ['Feature', 'Scenario', 'Given', 'When', 'Then', 'And', 'But', 'Background'],
  json: ['true', 'false', 'null'],
};

export function highlight(code: string, language: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const kw = new Set(KEYWORDS[language] ?? []);
  const slash = '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const comment = ({ python: '#[^\\n]*', yaml: '#[^\\n]*', gherkin: '#[^\\n]*', php: `${slash}|#[^\\n]*`, json: '(?!)' } as Record<string, string>)[language] ?? slash;
  const re = new RegExp(`(${comment})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|(@[A-Za-z_][\\w.]*)|(\\b\\d[\\d_.]*\\b)|([A-Za-z_$][\\w$]*)`, 'gm');
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (text: string, cls?: string) => {
    if (!text) return;
    if (!cls) { frag.appendChild(document.createTextNode(text)); return; }
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    frag.appendChild(s);
  };
  while ((m = re.exec(code))) {
    if (m.index > last) push(code.slice(last, m.index));
    const [tok, c, str, deco, num, word] = m;
    if (c) push(tok, 'tk-c');
    else if (str) push(tok, 'tk-s');
    else if (deco) push(tok, 'tk-d');
    else if (num) push(tok, 'tk-n');
    else if (word && kw.has(word)) push(tok, 'tk-k');
    else if (word && language === 'yaml' && /^\s*$/.test(code.slice(code.lastIndexOf('\n', m.index) + 1, m.index)) && code[m.index + word.length] === ':') push(tok, 'tk-p');
    else push(tok);
    last = m.index + tok.length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < code.length) push(code.slice(last));
  return frag;
}

export function codeBlock(code: string, language: string, label: string): HTMLElement {
  const pre = el('pre', { class: 'code-block', tabindex: '0', 'aria-label': label });
  const c = el('code', { class: `lang-${language}` });
  c.appendChild(highlight(code, language));
  pre.appendChild(c);
  return pre;
}

export function debounce<T extends (...a: never[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  return ((...a: Parameters<T>) => { if (t) clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}
