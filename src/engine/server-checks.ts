import type { Finding } from './types';
import { API_TOP10, COURSE } from './refs';

// Checks a pasted HTTP response (status line optional, headers, optional body) the way the
// "Securing API Servers" course reviews a server: CORS, cookies, transport, disclosure, errors, limits.

export interface ParsedResponse {
  status?: number;
  headers: { name: string; value: string }[];
  body: string;
}

export function parseResponse(text: string): ParsedResponse {
  const raw = (text ?? '').replace(/\r\n/g, '\n');
  const split = raw.indexOf('\n\n');
  const head = split >= 0 ? raw.slice(0, split) : raw;
  const body = split >= 0 ? raw.slice(split + 2) : '';
  const lines = head.split('\n').map((l) => l.trim()).filter(Boolean);
  let status: number | undefined;
  const headers: ParsedResponse['headers'] = [];
  for (const line of lines) {
    const st = line.match(/^HTTP\/[\d.]+\s+(\d{3})/i);
    if (st) { status = Number(st[1]); continue; }
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const name = line.slice(0, i).trim();
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) continue;
    headers.push({ name: name.toLowerCase(), value: line.slice(i + 1).trim() });
  }
  return { status, headers, body };
}

const get = (r: ParsedResponse, n: string) => r.headers.find((h) => h.name === n)?.value;
const all = (r: ParsedResponse, n: string) => r.headers.filter((h) => h.name === n).map((h) => h.value);

function f(p: Omit<Finding, 'area' | 'refs'> & { refs?: Finding['refs'] }): Finding {
  return { area: 'server', refs: [], ...p };
}

const STACK = [
  /\bat\s+[\w.$]+\([\w.]+\.java:\d+\)/, // Java
  /Traceback \(most recent call last\)/, // Python
  /\bat\s+.+\s\(.+\.(js|ts):\d+:\d+\)/, // Node
  /(Fatal error|Warning):.+ on line \d+/i, // PHP
  /System\.[\w.]+Exception/, // .NET
  /(SQLSTATE\[|You have an error in your SQL syntax|ORA-\d{5}|PG::|psycopg2\.|SequelizeDatabaseError)/i, // SQL
  /(\/var\/www\/|\/home\/\w+\/|C:\\\\(inetpub|Users)\\\\)/i, // file paths
];

/**
 * @param testOrigin the Origin the request was sent with, when the user tested CORS with a foreign origin
 * @param authenticated whether the response belongs to a signed-in request
 */
export function checkResponse(text: string, opts: { testOrigin?: string; authenticated?: boolean; isHtml?: boolean } = {}): Finding[] {
  const r = parseResponse(text);
  const out: Finding[] = [];
  if (!r.headers.length) return out;
  const isHtml = opts.isHtml ?? /text\/html/i.test(get(r, 'content-type') ?? '');

  // ---- CORS ----
  const acao = get(r, 'access-control-allow-origin');
  const acac = (get(r, 'access-control-allow-credentials') ?? '').toLowerCase() === 'true';
  if (acao) {
    if (acao === '*' && acac) {
      out.push(f({ rule: 'CORS-WILDCARD-CREDS', severity: 'high', title: 'CORS allows any origin together with credentials', where: 'Access-Control-Allow-Origin',
        evidence: `Access-Control-Allow-Origin: * and Access-Control-Allow-Credentials: true`,
        detail: 'Browsers refuse this pair, which usually means the server was set up to reflect origins to make it "work".',
        fix: 'List the exact origins that may call the API with credentials; never combine * with credentials.',
        refs: [{ standard: API_TOP10.API8, course: COURSE.servers }] }));
    } else if (acao === '*') {
      out.push(f({ rule: 'CORS-WILDCARD', severity: opts.authenticated ? 'medium' : 'low', title: 'CORS allows every origin', where: 'Access-Control-Allow-Origin', evidence: '*',
        detail: 'Any website can read this response from a visitor\'s browser. That is fine for public data and wrong for anything personal.',
        fix: 'Keep * only on public, unauthenticated endpoints; allow-list origins everywhere else.',
        refs: [{ standard: API_TOP10.API8, course: COURSE.servers }] }));
    }
    if (acao.toLowerCase() === 'null') {
      out.push(f({ rule: 'CORS-NULL', severity: 'high', title: 'CORS allows the "null" origin', where: 'Access-Control-Allow-Origin', evidence: 'null',
        detail: 'Sandboxed frames and local files send Origin: null, so allowing it lets pages you do not control read the response.',
        fix: 'Remove null from the allowed origins.',
        refs: [{ standard: API_TOP10.API8, course: COURSE.servers }] }));
    }
    if (opts.testOrigin && acao === opts.testOrigin.trim()) {
      out.push(f({ rule: 'CORS-REFLECTED', severity: acac ? 'critical' : 'high', title: 'CORS echoes back an origin it should not trust', where: 'Access-Control-Allow-Origin',
        evidence: `${opts.testOrigin} was allowed${acac ? ' with credentials' : ''}`,
        detail: 'The server copies the request\'s Origin into the response, so every website is treated as trusted.',
        fix: 'Compare the Origin against a fixed allow-list and send Vary: Origin; do not copy it.',
        refs: [{ standard: API_TOP10.API8, course: COURSE.servers }] }));
    }
    if (acao !== '*' && !/origin/i.test(get(r, 'vary') ?? '')) {
      out.push(f({ rule: 'CORS-NO-VARY', severity: 'low', title: 'An origin-specific CORS answer has no Vary: Origin', where: 'Vary',
        detail: 'Caches may serve one origin\'s CORS answer to another.',
        fix: 'Add Vary: Origin whenever Access-Control-Allow-Origin depends on the request.',
        refs: [{ course: COURSE.servers }] }));
    }
  }
  const methods = get(r, 'access-control-allow-methods');
  if (methods && (methods.trim() === '*' || /\b(PUT|DELETE|PATCH)\b/i.test(methods) && /\bTRACE\b/i.test(methods))) {
    out.push(f({ rule: 'CORS-METHODS', severity: 'low', title: 'CORS allows more methods than needed', where: 'Access-Control-Allow-Methods', evidence: methods,
      detail: 'Allowing every method across origins widens what another site can ask a browser to do.',
      fix: 'Allow only the methods each route uses.', refs: [{ course: COURSE.servers }] }));
  }

  // ---- cookies ----
  for (const c of all(r, 'set-cookie')) {
    const name = c.split('=')[0].trim();
    const lower = c.toLowerCase();
    const missing: string[] = [];
    if (!/;\s*secure/.test(lower)) missing.push('Secure');
    if (!/;\s*httponly/.test(lower)) missing.push('HttpOnly');
    const ss = lower.match(/;\s*samesite=(\w+)/)?.[1];
    if (!ss) missing.push('SameSite');
    const session = /(sess|sid|auth|token|jwt|login|remember)/i.test(name);
    if (missing.length) {
      out.push(f({ rule: 'COOKIE-FLAGS', severity: session ? (missing.includes('Secure') || missing.includes('HttpOnly') ? 'high' : 'medium') : 'low',
        title: `Cookie ${name} is missing ${missing.join(', ')}`, where: 'Set-Cookie', evidence: c.slice(0, 120),
        detail: `${missing.includes('Secure') ? 'Without Secure it can travel over plain HTTP. ' : ''}${missing.includes('HttpOnly') ? 'Without HttpOnly any script on the page can read it. ' : ''}${missing.includes('SameSite') ? 'Without SameSite the browser sends it on cross-site requests. ' : ''}`.trim(),
        fix: 'Set Secure; HttpOnly; SameSite=Lax (or Strict) on session cookies, plus a Path and a short Max-Age.',
        refs: [{ standard: API_TOP10.API8, course: COURSE.servers }] }));
    }
    if (ss === 'none' && !/;\s*secure/.test(lower)) {
      out.push(f({ rule: 'COOKIE-SAMESITE-NONE', severity: 'medium', title: `Cookie ${name} uses SameSite=None without Secure`, where: 'Set-Cookie',
        detail: 'Browsers reject this combination, and it signals the cookie is meant to cross sites.',
        fix: 'Use SameSite=Lax unless a cross-site flow needs None, and then always add Secure.', refs: [{ course: COURSE.servers }] }));
    }
  }

  // ---- transport and browser hardening ----
  const hsts = get(r, 'strict-transport-security');
  if (!hsts) {
    out.push(f({ rule: 'HDR-NO-HSTS', severity: 'medium', title: 'No Strict-Transport-Security header', where: 'response headers',
      detail: 'Without HSTS a browser may still try plain HTTP first, where the connection can be intercepted.',
      fix: 'Send Strict-Transport-Security: max-age=31536000; includeSubDomains over HTTPS.',
      refs: [{ standard: API_TOP10.API8, course: COURSE.servers }] }));
  } else {
    const age = Number(hsts.match(/max-age=(\d+)/i)?.[1] ?? 0);
    if (age < 15552000) {
      out.push(f({ rule: 'HDR-SHORT-HSTS', severity: 'low', title: 'HSTS max-age is under six months', where: 'Strict-Transport-Security', evidence: hsts,
        detail: 'A short max-age lets the protection lapse between visits.', fix: 'Use max-age=31536000 (one year) once HTTPS is stable.', refs: [{ course: COURSE.servers }] }));
    }
  }
  if ((get(r, 'x-content-type-options') ?? '').toLowerCase() !== 'nosniff') {
    out.push(f({ rule: 'HDR-NO-NOSNIFF', severity: 'low', title: 'No X-Content-Type-Options: nosniff', where: 'response headers',
      detail: 'Browsers may guess the content type and run a JSON or text response as script or HTML.',
      fix: 'Send X-Content-Type-Options: nosniff on every response.', refs: [{ course: COURSE.servers }] }));
  }
  if (isHtml) {
    const csp = get(r, 'content-security-policy');
    if (!csp) {
      out.push(f({ rule: 'HDR-NO-CSP', severity: 'medium', title: 'An HTML page has no Content-Security-Policy', where: 'response headers',
        detail: 'Without a CSP, any injected script runs with the page\'s full rights.',
        fix: "Start with default-src 'self'; frame-ancestors 'none'; object-src 'none' and loosen only what the page needs.", refs: [{ course: COURSE.servers }] }));
    } else {
      // read the directive that governs scripts (script-src, else default-src); 'unsafe-inline' in style-src is
      // a different, lesser risk, and next to a nonce or hash browsers ignore 'unsafe-inline' altogether
      const directives = new Map(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map((d) => [d[0].toLowerCase(), d.slice(1)]));
      const scripts = directives.get('script-src') ?? directives.get('default-src');
      const hashed = !!scripts?.some((s) => /^'(nonce|sha256|sha384|sha512)-/i.test(s));
      const weak = scripts?.filter((s) => s === "'unsafe-eval'" || (s === "'unsafe-inline'" && !hashed)) ?? [];
      if (weak.length) {
        out.push(f({ rule: 'HDR-WEAK-CSP', severity: 'low', title: "The CSP allows 'unsafe-inline' or 'unsafe-eval' scripts", where: 'Content-Security-Policy', evidence: `${directives.has('script-src') ? 'script-src' : 'default-src'} ${weak.join(' ')}`,
          detail: 'Inline and eval allowances undo most of the protection a CSP gives.', fix: 'Move inline scripts to files or use nonces, then drop the unsafe keywords.', refs: [{ course: COURSE.servers }] }));
      }
    }
    if (!get(r, 'x-frame-options') && !/frame-ancestors/i.test(csp ?? '')) {
      out.push(f({ rule: 'HDR-NO-FRAME', severity: 'low', title: 'The page can be framed by any site', where: 'response headers',
        detail: 'Without frame-ancestors or X-Frame-Options another site can load the page invisibly and trick clicks on it.',
        fix: "Send Content-Security-Policy: frame-ancestors 'none' (or 'self').", refs: [{ course: COURSE.servers }] }));
    }
  }
  if (opts.authenticated) {
    const cc = (get(r, 'cache-control') ?? '').toLowerCase();
    if (!/no-store|private/.test(cc)) {
      out.push(f({ rule: 'HDR-CACHEABLE', severity: 'medium', title: 'A signed-in response may be cached', where: 'Cache-Control', evidence: cc || '(none)',
        detail: 'Shared caches and proxies can keep personal data and hand it to the next person.',
        fix: 'Send Cache-Control: no-store on responses that contain personal or account data.', refs: [{ course: COURSE.servers }] }));
    }
  }

  // ---- disclosure ----
  for (const n of ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator']) {
    const v = get(r, n);
    if (v && (/\d/.test(v) || n !== 'server')) {
      out.push(f({ rule: 'HDR-VERSION-LEAK', severity: 'low', title: `The ${n} header names the software${/\d/.test(v) ? ' and its version' : ''}`, where: n, evidence: `${n}: ${v}`,
        detail: 'Version banners tell anyone which known vulnerabilities to look up.',
        fix: `Remove ${n} or reduce it to a generic value at the proxy.`, refs: [{ standard: API_TOP10.API8, course: COURSE.servers }] }));
    }
  }

  // ---- error bodies ----
  if (r.body) {
    // error pages print the trace first; reading only the head keeps a huge body from freezing the tab
    const head = r.body.slice(0, 20000);
    const hit = STACK.find((re) => re.test(head));
    if (hit) {
      out.push(f({ rule: 'ERR-STACK', severity: 'high', title: 'The response body shows a stack trace, SQL error or file path', where: 'response body',
        evidence: (head.match(hit)?.[0] ?? '').slice(0, 120),
        detail: 'Internal errors reveal the language, libraries, file layout and sometimes the query, which narrows down what to try next.',
        fix: 'Catch errors at one handler, return a short message with a correlation id, and log the detail on the server only.',
        refs: [{ standard: API_TOP10.API8, course: COURSE.servers }] }));
    }
  }

  // ---- limits ----
  const rl = r.headers.some((h) => /^(x-)?ratelimit|^retry-after$|^x-rate-limit/i.test(h.name));
  if (!rl) {
    out.push(f({ rule: 'HDR-NO-RATELIMIT', severity: 'info', title: 'No rate-limit headers in the response', where: 'response headers',
      detail: 'The response does not show a limit. One may exist; if it does, telling clients helps them back off.',
      fix: 'Send RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset (or the X- versions), and 429 with Retry-After.',
      refs: [{ standard: API_TOP10.API4, course: COURSE.servers }] }));
  }
  if (r.status === 401 || r.status === 403) {
    out.push(f({ rule: 'SL-STATUS-DISCLOSURE', severity: 'info', title: `Status ${r.status} tells the caller the resource exists`, where: `HTTP ${r.status}`,
      detail: 'For objects the caller may not see, 404 reveals less than 401 or 403.',
      fix: 'Pick one rule for your API standard and apply it everywhere.', refs: [{ course: COURSE.startLeft }] }));
  }
  return out;
}
