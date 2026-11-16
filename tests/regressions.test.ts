import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine/report';
import { parseApi } from '../src/engine/parse';
import { checkResponse } from '../src/engine/server-checks';
import { checkJwt } from '../src/engine/jwt';
import { locateInSpec } from '../src/engine/exports';
import { makeJwt } from '../src/engine/fixtures';

// Each case here was a real defect found while testing; the test keeps it fixed.

const spec = (version: string, extra = '') => `openapi: 3.0.3
info:
  title: Ledger API
  version: ${version}
paths:
  /v1/entries:
    get:
      summary: List entries
      security:
        - bearer: []${extra}
      responses:
        '200': { description: OK }
components:
  securitySchemes:
    bearer: { type: http, scheme: bearer }
  schemas:
    Entry:
      type: object
      properties:
        version: { type: number }
`;

describe('regressions', () => {
  it('keeps an unquoted version such as 1.10 as written (YAML would read 1.1)', () => {
    expect(parseApi(spec('1.10')).version).toBe('1.10');
    expect(parseApi(spec('2.0')).version).toBe('2.0');
  });

  it('reads the spec version from info, never from a schema property named version', () => {
    expect(parseApi(spec('3.20')).version).toBe('3.20');
  });

  it('keeps swagger: 2.0 as "2.0"', () => {
    const api = parseApi('swagger: 2.0\ninfo:\n  title: T\n  version: 1.0.0\npaths: {}\n');
    expect(api.openapi).toBe('2.0');
  });

  it('gives the release check the right semver for 1.9 -> 1.10', () => {
    const r = analyze({ spec: spec('1.10'), previousSpec: spec('1.9') });
    expect(r.errors).toEqual([]);
    expect(r.release?.declared).toEqual({ from: '1.9', to: '1.10', bump: 'minor' });
  });

  it('ignores null entries in security instead of failing the whole spec', () => {
    const r = analyze({ spec: spec('1.0.0').replace('      security:\n        - bearer: []', '      security:\n        - null') });
    expect(r.errors).toEqual([]);
    expect(r.api?.operations).toHaveLength(1);
  });

  it('places a missing info.description on the info line, not on another description', () => {
    const text = spec('1.0.0');
    expect(locateInSpec(text, 'info.description')).toBe(2);
    expect(locateInSpec(text, 'info.contact')).toBe(2);
  });

  it('reads a huge response body fast', () => {
    const body = 'at ' + 'x'.repeat(400_000) + ' (y.js';
    const t = performance.now();
    checkResponse(`HTTP/1.1 500 Internal Server Error\nContent-Type: text/plain\n\n${body}`);
    expect(performance.now() - t).toBeLessThan(500);
  });

  it('does not report an infinite token lifetime', () => {
    const { findings } = checkJwt(makeJwt({ alg: 'RS256' }, { iat: 0, exp: Number.MAX_VALUE * 10, aud: 'a', iss: 'i' }));
    expect(findings.find((f) => f.rule === 'JWT-LONG-LIFE')?.title ?? '').not.toContain('Infinity');
  });

  it('reads the script directive of a CSP, not every directive', () => {
    const page = (csp: string) => checkResponse(`HTTP/1.1 200 OK\nContent-Type: text/html\nContent-Security-Policy: ${csp}\n\n<p>hi</p>`).map((f) => f.rule);
    // unsafe-inline only for styles, scripts by hash: not weak (Patchlane's own policy)
    expect(page("default-src 'self'; script-src 'self' 'sha256-abc='; style-src 'self' 'unsafe-inline'")).not.toContain('HDR-WEAK-CSP');
    // unsafe-inline next to a nonce is ignored by browsers
    expect(page("script-src 'self' 'nonce-r4nd0m' 'unsafe-inline'")).not.toContain('HDR-WEAK-CSP');
    expect(page("script-src 'self' 'unsafe-inline'")).toContain('HDR-WEAK-CSP');
    expect(page("default-src 'self' 'unsafe-eval'")).toContain('HDR-WEAK-CSP');
  });

  it('compares releases whose extensions hold YAML alias cycles', () => {
    const cyclic = (v: string) => spec(v, '\n      x-meta: &m\n        self: *m');
    const r = analyze({ spec: cyclic('1.0.1'), previousSpec: cyclic('1.0.0') });
    expect(r.errors).toEqual([]);
  });
});
