import type { ApiModel, Finding, OperationModel } from './types';
import { API_TOP10 } from './refs';

// Release check: compares two versions of a spec. It reports security regressions and breaking changes,
// and says which semantic-version bump the change needs (MAJOR.MINOR.PATCH, as taught in "Start Left").

export type Bump = 'major' | 'minor' | 'patch' | 'none';

export interface ReleaseDiff {
  added: string[];
  removed: string[];
  changed: string[];
  findings: Finding[];
  requiredBump: Bump;
  declared: { from: string; to: string; bump: Bump | 'unknown' };
  bumpOk: boolean;
}

const SENSITIVE = /^(password|passwd|pass_?hash|password_?hash|secret|client_?secret|api_?key|access_?token|refresh_?token|token|otp|pin|cvv|cvc|card_?number|pan|ssn|tax_?id|national_?id|private_?key)$/i;

function isPublic(op: OperationModel): boolean {
  if (op.security === null) return true;
  return op.security.length === 0 || op.security.some((r) => Object.keys(r).length === 0);
}
const scopes = (op: OperationModel) => [...new Set((op.security ?? []).flatMap((r) => Object.values(r).flat()))].sort();

function parseVersion(v: string): [number, number, number] | null {
  const m = String(v).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

function declaredBump(a: string, b: string): Bump | 'unknown' {
  const x = parseVersion(a); const y = parseVersion(b);
  if (!x || !y) return 'unknown';
  if (y[0] > x[0]) return 'major';
  if (y[0] === x[0] && y[1] > x[1]) return 'minor';
  if (y[0] === x[0] && y[1] === x[1] && y[2] > x[2]) return 'patch';
  if (y[0] === x[0] && y[1] === x[1] && y[2] === x[2]) return 'none';
  return 'unknown';
}

const RANK: Record<Bump, number> = { none: 0, patch: 1, minor: 2, major: 3 };

/** A comparable form of the operations that never throws on cyclic YAML aliases inside x- extensions. */
function fingerprint(api: ApiModel): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(api.operations, (_k, v) => {
      if (v && typeof v === 'object') { if (seen.has(v)) return '[cycle]'; seen.add(v); }
      return v;
    });
  } catch {
    return String(api.operations.length);
  }
}

export function diffApis(before: ApiModel, after: ApiModel): ReleaseDiff {
  const a = new Map(before.operations.map((o) => [o.key, o]));
  const b = new Map(after.operations.map((o) => [o.key, o]));
  const added = [...b.keys()].filter((k) => !a.has(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));
  const changed: string[] = [];
  const findings: Finding[] = [];
  let need: Bump = 'none';
  const raise = (x: Bump) => { if (RANK[x] > RANK[need]) need = x; };
  const ref = (s?: string) => (s ? [{ standard: s }] : []);

  if (removed.length) {
    raise('major');
    for (const k of removed) {
      findings.push({ rule: 'REL-REMOVED', area: 'release', severity: 'medium', title: 'An operation was removed', where: k,
        detail: 'Clients that still call it will break. This is a breaking change.', fix: 'Deprecate first with a removal date, then remove in a major version.', refs: ref(API_TOP10.API9) });
    }
  }
  if (added.length) raise('minor');
  for (const k of added) {
    const op = b.get(k)!;
    if (isPublic(op)) {
      findings.push({ rule: 'REL-NEW-PUBLIC', area: 'release', severity: op.method === 'get' ? 'medium' : 'high', title: 'A new operation needs no authentication', where: k,
        detail: 'This release adds an endpoint anyone can call.', fix: 'Apply the security scheme, or record why it is public.', refs: ref(API_TOP10.API2) });
    }
  }

  for (const [k, nb] of b) {
    const na = a.get(k);
    if (!na) continue;
    const notes: string[] = [];
    // security regressions
    if (!isPublic(na) && isPublic(nb)) {
      notes.push('lost its authentication');
      findings.push({ rule: 'REL-AUTH-REMOVED', area: 'release', severity: 'critical', title: 'An operation lost its authentication', where: k,
        detail: 'It required a token before this release and is now public.', fix: 'Restore the security requirement unless this was decided and reviewed.', refs: ref(API_TOP10.API2) });
    } else {
      const sa = scopes(na); const sb = scopes(nb);
      const dropped = sa.filter((s) => !sb.includes(s));
      if (sa.length && dropped.length && sb.length < sa.length) {
        notes.push('needs fewer scopes');
        findings.push({ rule: 'REL-SCOPE-REDUCED', area: 'release', severity: 'high', title: 'An operation now needs fewer scopes', where: k, evidence: `dropped ${dropped.join(', ')}`,
          detail: 'Clients with less permission can now call it.', fix: 'Confirm the change was intended and reviewed.', refs: ref(API_TOP10.API5) });
      }
    }
    const before = new Set(na.responseFields.map((f) => f.path));
    const newSensitive = nb.responseFields.filter((f) => !before.has(f.path) && SENSITIVE.test(f.name));
    if (newSensitive.length) {
      notes.push('returns new sensitive fields');
      findings.push({ rule: 'REL-NEW-SENSITIVE', area: 'release', severity: 'high', title: 'The response now includes sensitive fields', where: k, evidence: newSensitive.map((f) => f.path).join(', '),
        detail: 'This release starts returning data that should stay on the server.', fix: 'Remove the fields from the response model before release.', refs: ref(API_TOP10.API3) });
    }
    if (na.responseCodes.includes('429') && !nb.responseCodes.includes('429')) {
      notes.push('no longer documents a rate limit');
      findings.push({ rule: 'REL-LIMIT-REMOVED', area: 'release', severity: 'medium', title: 'An operation no longer documents its rate limit', where: k,
        detail: 'The previous release answered 429 here. If the limit went with the documentation, the endpoint can now be called without bound.', fix: 'Confirm the limit still runs at the gateway and restore the 429 response in the spec.', refs: ref(API_TOP10.API4) });
    }
    if (na.requestAdditionalProps === false && nb.requestAdditionalProps === true) {
      notes.push('accepts unknown properties again');
      findings.push({ rule: 'REL-BODY-OPENED', area: 'release', severity: 'low', title: 'The request body accepts unknown properties again', where: k,
        detail: 'additionalProperties: false was dropped, so fields the server never meant to bind now pass validation.', fix: 'Put additionalProperties: false back on the request schema.', refs: ref(API_TOP10.API3) });
    }
    // breaking changes
    const reqA = new Set(na.params.filter((p) => p.required).map((p) => `${p.in}:${p.name}`));
    const newRequired = nb.params.filter((p) => p.required && !reqA.has(`${p.in}:${p.name}`) && p.in !== 'path');
    if (newRequired.length) {
      raise('major'); notes.push('has new required parameters');
      findings.push({ rule: 'REL-NEW-REQUIRED', area: 'release', severity: 'low', title: 'A new required parameter breaks existing clients', where: k, evidence: newRequired.map((p) => p.name).join(', '),
        detail: 'Existing clients do not send it and will start failing.', fix: 'Make it optional with a default, or ship it in a major version.', refs: ref(API_TOP10.API9) });
    }
    const respB = new Set(nb.responseFields.map((f) => f.path));
    const goneFields = na.responseFields.filter((f) => !respB.has(f.path) && !SENSITIVE.test(f.name));
    if (goneFields.length) {
      raise('major'); notes.push('dropped response fields');
      findings.push({ rule: 'REL-FIELD-REMOVED', area: 'release', severity: 'low', title: 'Response fields were removed', where: k, evidence: goneFields.slice(0, 4).map((f) => f.path).join(', '),
        detail: 'Clients that read these fields will break.', fix: 'Keep them (deprecated) until the next major version.', refs: ref(API_TOP10.API9) });
    }
    const addedOptional = nb.params.filter((p) => !p.required && !na.params.some((q) => q.name === p.name && q.in === p.in));
    if (addedOptional.length || nb.responseFields.length > na.responseFields.length) { raise('minor'); if (!notes.length) notes.push('gained optional parameters or fields'); }
    if (!na.deprecated && nb.deprecated) notes.push('is now deprecated');
    if (JSON.stringify(na.responseCodes.sort()) !== JSON.stringify(nb.responseCodes.sort()) && !notes.length) { raise('patch'); notes.push('changed its documented responses'); }
    if (notes.length) changed.push(`${k}: ${notes.join(', ')}`);
  }
  if (need === 'none' && fingerprint(before) !== fingerprint(after)) raise('patch');

  const db = declaredBump(before.version, after.version);
  const bumpOk = db !== 'unknown' && RANK[db as Bump] >= RANK[need] && (need === 'none' || db !== 'none');
  if (!bumpOk && need !== 'none') {
    findings.push({ rule: 'REL-SEMVER', area: 'release', severity: need === 'major' ? 'medium' : 'low',
      title: `This release needs a ${need} version bump`, where: `info.version ${before.version} → ${after.version}`,
      detail: `The changes call for a ${need} bump, but the version ${db === 'unknown' ? 'could not be read as MAJOR.MINOR.PATCH' : db === 'none' ? 'did not change' : `only moved by a ${db}`}.`,
      fix: need === 'major' ? 'Raise the major number, or keep the old behaviour alongside the new until the next major release.' : `Raise the ${need} number.`,
      refs: ref(API_TOP10.API9) });
  }
  return { added, removed, changed, findings, requiredBump: need, declared: { from: before.version, to: after.version, bump: db }, bumpOk };
}
