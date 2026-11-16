import type { Finding } from './types';
import { API_TOP10, COURSE } from './refs';

// Decodes a JSON Web Token locally and reviews its header and claims, as taught in "API Authentication".
// It never verifies or alters the signature and never sends the token anywhere.

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signaturePresent: boolean;
}

function b64urlDecode(part: string): string {
  const pad = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bin = typeof atob === 'function' ? atob(pad) : Buffer.from(pad, 'base64').toString('binary');
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwt(token: string): DecodedJwt {
  const t = (token ?? '').trim().replace(/^Bearer\s+/i, '');
  const parts = t.split('.');
  if (parts.length !== 3 && parts.length !== 2) throw new Error('A JWT has three parts separated by dots.');
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try { header = JSON.parse(b64urlDecode(parts[0])); } catch { throw new Error('The first part does not decode to a JSON header.'); }
  try { payload = JSON.parse(b64urlDecode(parts[1])); } catch { throw new Error('The second part does not decode to JSON claims.'); }
  if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') throw new Error('The token parts are not JSON objects.');
  return { header, payload, signaturePresent: parts.length === 3 && parts[2].length > 0 };
}

const SENSITIVE_CLAIM = /^(password|pwd|pass|secret|ssn|social_security|card|card_number|pan|cvv|dob|date_of_birth|address|phone|national_id|tax_id|salary|diagnosis)$/i;

export function checkJwt(token: string, nowSeconds = Math.floor(Date.now() / 1000)): { decoded: DecodedJwt; findings: Finding[] } {
  const decoded = decodeJwt(token);
  const { header, payload } = decoded;
  const out: Finding[] = [];
  const ref = [{ standard: API_TOP10.API2, course: COURSE.auth }];
  const push = (p: Omit<Finding, 'area' | 'refs'> & { refs?: Finding['refs'] }) => out.push({ area: 'token', refs: ref, ...p });
  const alg = String(header.alg ?? '');

  if (!alg || alg.toLowerCase() === 'none' || !decoded.signaturePresent) {
    push({ rule: 'JWT-NO-SIGNATURE', severity: 'critical', title: 'The token is not signed', where: 'header.alg', evidence: `alg: ${alg || '(missing)'}`,
      detail: 'An unsigned token can be edited by anyone who holds it. A server that accepts it trusts whatever the claims say.',
      fix: 'Reject alg "none" and unsigned tokens on the server, and pin the algorithm you expect instead of reading it from the token.' });
  } else if (/^HS(256|384|512)$/.test(alg)) {
    push({ rule: 'JWT-SHARED-SECRET', severity: 'low', title: `Signed with a shared secret (${alg})`, where: 'header.alg', evidence: alg,
      detail: 'Every service that verifies the token also holds the key that can create one, and a short secret can be guessed offline.',
      fix: 'Use a random secret of at least 32 bytes, or move to RS256 or ES256 so verifiers only hold a public key.' });
  }
  for (const k of ['jku', 'x5u', 'jwk']) {
    if (k in header) {
      push({ rule: 'JWT-KEY-IN-HEADER', severity: 'high', title: `The header carries "${k}", which points to its own key`, where: `header.${k}`, evidence: String(header[k]).slice(0, 80),
        detail: 'If the server follows it, the token chooses the key it is checked with.',
        fix: `Ignore ${k} and verify only with keys from your own configuration or an allow-listed JWKS URL.` });
    }
  }
  if (typeof header.kid === 'string' && /(\.\.|\/|\\|'|;|\s)/.test(header.kid)) {
    push({ rule: 'JWT-ODD-KID', severity: 'medium', title: 'The key id contains path or query characters', where: 'header.kid', evidence: header.kid.slice(0, 80),
      detail: 'A kid that is used to look up a file or row should be a plain identifier.',
      fix: 'Accept only kid values from a fixed list of your own keys.' });
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
  if (exp === undefined) {
    push({ rule: 'JWT-NO-EXP', severity: 'high', title: 'The token never expires', where: 'payload.exp',
      detail: 'A stolen token without exp works until the signing key changes.',
      fix: 'Issue access tokens with exp 5 to 60 minutes ahead and use refresh tokens for longer sessions.' });
  } else {
    const life = iat !== undefined ? exp - iat : undefined;
    if (life !== undefined && Number.isFinite(life) && life > 24 * 3600) {
      push({ rule: 'JWT-LONG-LIFE', severity: 'medium', title: `The token lives for ${Math.round(life / 3600)} hours`, where: 'payload.exp',
        detail: 'Long-lived access tokens give a stolen token a long useful life.',
        fix: 'Keep access tokens under an hour; refresh them with a revocable refresh token.' });
    }
    if (exp < nowSeconds) {
      const when = new Date(exp * 1000); // exp beyond the Date range has no ISO form: quote the number instead of throwing
      push({ rule: 'JWT-EXPIRED', severity: 'info', title: 'The token has expired', where: 'payload.exp', evidence: Number.isNaN(when.getTime()) ? `exp ${exp}` : when.toISOString(),
        detail: 'Check that your API rejects it: send it once and expect 401.', fix: 'Nothing to change in the token; make sure the server checks exp.' });
    }
  }
  if (!('aud' in payload)) {
    push({ rule: 'JWT-NO-AUD', severity: 'medium', title: 'No audience claim', where: 'payload.aud',
      detail: 'Without aud, a token issued for one API can be replayed against another that trusts the same issuer.',
      fix: 'Set aud to the API it is meant for and check it on every request.' });
  }
  if (!('iss' in payload)) {
    push({ rule: 'JWT-NO-ISS', severity: 'low', title: 'No issuer claim', where: 'payload.iss',
      detail: 'Verifiers cannot tell which authorization server issued the token.', fix: 'Set iss and check it against the expected issuer.' });
  }
  const sensitive = Object.keys(payload).filter((k) => SENSITIVE_CLAIM.test(k));
  if (sensitive.length) {
    push({ rule: 'JWT-SENSITIVE-CLAIMS', severity: 'high', title: 'Personal or secret data is stored in the claims', where: 'payload', evidence: sensitive.join(', '),
      detail: 'JWT claims are only encoded, not encrypted: anyone holding the token can read them.',
      fix: 'Keep only identifiers and scopes in the token; look personal data up on the server.',
      refs: [{ standard: API_TOP10.API3, course: COURSE.auth }] });
  }
  const scope = String(payload.scope ?? payload.scp ?? '');
  if (/(^|\s)(\*|admin|all|full_access|root)(\s|$)/i.test(scope)) {
    push({ rule: 'JWT-BROAD-SCOPE', severity: 'medium', title: 'The token carries an all-powerful scope', where: 'payload.scope', evidence: scope.slice(0, 80),
      detail: 'One leaked token with a broad scope opens every endpoint.', fix: 'Issue the narrowest scopes each client needs.',
      refs: [{ standard: API_TOP10.API5, course: COURSE.auth }] });
  }
  return { decoded, findings: out };
}
