// After `vite build`: write Cloudflare Pages headers (with a CSP that hashes the page's inline
// scripts instead of allowing 'unsafe-inline'), redirects, and publish the CLI bundle.
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const dist = 'dist';

// The design kit ships demos, galleries, sample photographs and scenes the site never loads. Publish only its
// runtime: scripts, styles and data of the parts the pages use, and the icons they name.
const KEEP = [
  /^system\.(css|js)$/,
  /^(ui|motion|backgrounds|layout|diagrams|moments|effects)\/[^/]+\.(js|css|json)$/,
  /^moments\/counter-rolls\/[^/]+\.(js|css|json)$/,
  /^effects\/painterly-landscape\/[^/]+$/,
  /^icons\/icon\.css$/,
  /^icons\/(github|ui-[a-z0-9-]+)\.svg$/,
  /^(LICENSE|README\.txt)$/, // the kit's MIT notice travels with its files
];
const DROP = /\.(html|mjs)$/;
let kept = 0, dropped = 0;
function prune(dir, rel = '') {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name), r = rel ? rel + '/' + name : name;
    if (statSync(p).isDirectory()) { prune(p, r); if (!readdirSync(p).length) rmSync(p, { recursive: true }); continue; }
    if (KEEP.some((re) => re.test(r)) && !DROP.test(r)) kept++; else { rmSync(p); dropped++; }
  }
}
if (existsSync(join(dist, 'assets'))) prune(join(dist, 'assets'));
const hashes = new Set();
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'assets') walk(p); continue; }
    if (!name.endsWith('.html')) continue;
    const html = readFileSync(p, 'utf8');
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:json|ld\+json)")[^>]*>([\s\S]*?)<\/script>/g)) {
      if (m[1].trim()) hashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
    }
  }
}
walk(dist);

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const headers = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  ! Access-Control-Allow-Origin

/_app/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=86400

/patchlane.mjs
  Content-Type: text/javascript; charset=utf-8
  Cache-Control: public, max-age=3600
`;
writeFileSync(join(dist, '_headers'), headers);
writeFileSync(join(dist, '_redirects'), '/rules /rules/ 301\n/app /app/ 301\n');
if (existsSync('cli/dist/patchlane.mjs')) copyFileSync('cli/dist/patchlane.mjs', join(dist, 'patchlane.mjs'));
console.log(`postbuild: kit runtime kept ${kept} files, dropped ${dropped}; _headers with ${hashes.size} script hash(es), _redirects, CLI bundle ${existsSync('cli/dist/patchlane.mjs') ? 'copied' : 'missing'}`);
