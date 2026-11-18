import type { ApiModel, Finding, OperationModel, Severity, ToolModel } from './types';
import { API_TOP10, LLM_RISK } from './refs';

// Reviews for APIs that AI agents call: the tool definitions a model reads (MCP tools/list,
// OpenAI or Anthropic tool arrays), the LLM endpoints in an OpenAPI spec, and a short checklist
// of the safeguards around an agent. Every finding is a review note with a fix; nothing here
// generates or sends anything.

type Partial = Omit<Finding, 'area' | 'refs'> & { refs?: Finding['refs'] };
const make = (p: Partial): Finding => ({ area: 'agent', refs: [], ...p });

// ---------- hidden characters ----------

/** Code points that render as nothing (or reorder text) but are still read by a model. */
const HIDDEN = /[­᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]|\uDB40[\uDC00-\uDC7F]/g;

export function findHiddenChars(text: string): { count: number; codes: string[] } {
  const hits = text.match(HIDDEN) ?? [];
  const codes = [...new Set(hits.map((h) => 'U+' + (h.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')))];
  return { count: hits.length, codes };
}

/** Text with hidden code points made visible, for evidence. */
export function revealHidden(text: string): string {
  return text.replace(HIDDEN, (h) => `[U+${(h.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}]`);
}

// ---------- instruction-like text in a definition ----------

/**
 * Wording that addresses the model rather than describing the tool. A tool description should say
 * what the tool does; text that tells the model what to do, or what to keep from the user, is the
 * pattern reviewers look for when a definition has been tampered with.
 */
const DIRECTIVES: { id: string; label: string; re: RegExp }[] = [
  { id: 'override', label: 'tells the model to set aside its other instructions', re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|other|all|system)\b[^.\n]{0,24}\b(instructions?|rules?|prompts?|guidelines?)\b/i },
  { id: 'conceal', label: 'asks the model to keep something from the user', re: /\b(do not|don't|never|without)\b[^.\n]{0,30}\b(tell|telling|mention|mentioning|inform|informing|reveal|revealing|show|showing|notify|notifying)\b[^.\n]{0,20}\b(the )?users?\b/i },
  { id: 'tags', label: 'contains markup aimed at the model', re: /<\/?\s*(important|system|instructions?|secret|hidden|admin|override)\s*>/i },
  { id: 'cross-tool', label: 'gives orders about other tools', re: /\b(before|after|instead of|whenever you)\b[^.\n]{0,40}\b(using|calling|call|use|invoking)\b[^.\n]{0,20}\b(any|other|another|every|the)\b[^.\n]{0,12}\btools?\b/i },
  { id: 'role', label: 'tries to redefine the model\'s role', re: /\b(you are now|from now on,? you|act as (an? )?(admin|administrator|developer|system)|system prompt)\b/i },
  { id: 'secrets', label: 'refers to credential files or keys', re: /(~\/\.ssh|id_rsa|\.env\b|\.aws\/credentials|mcp\.json|private key|api[_ ]?keys? (of|from) the user)/i },
  { id: 'forward', label: 'asks for conversation or credentials to be passed along', re: /\b(send|forward|upload|post|include|append|copy)\b[^.\n]{0,40}\b(conversation|chat history|message history|previous messages|credentials|passwords?|secrets?|tokens?)\b/i },
];

function directiveHits(text: string): { label: string; quote: string }[] {
  const out: { label: string; quote: string }[] = [];
  for (const d of DIRECTIVES) {
    const m = text.match(d.re);
    if (m && m.index !== undefined) {
      const start = Math.max(0, m.index - 20);
      const quote = text.slice(start, m.index + m[0].length + 20).replace(/\s+/g, ' ').trim();
      out.push({ label: d.label, quote: (start > 0 ? '…' : '') + quote + (m.index + m[0].length + 20 < text.length ? '…' : '') });
    }
  }
  return out;
}

// ---------- names ----------

function words(name: string): string[] {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

const WRITE_VERB = /^(delete|remove|destroy|drop|send|email|post|publish|refund|transfer|pay|charge|withdraw|update|edit|modify|patch|create|add|write|insert|upsert|set|execute|exec|run|deploy|approve|cancel|purge|reset|grant|revoke|invite|book|order|submit|move|rename|upload|merge|close|archive)$/;
const HIGH_IMPACT = /^(delete|remove|destroy|drop|refund|transfer|pay|charge|withdraw|purge|grant|revoke|execute|exec|deploy|send|email|publish|approve|reset)$/;

const CONFUSABLE: Record<string, string> = {
  '0': 'o', '1': 'l', '3': 'e', '5': 's', '7': 't', '|': 'l',
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'һ': 'h', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
};

function skeleton(name: string): string {
  return [...name.normalize('NFKC').toLowerCase()].map((c) => CONFUSABLE[c] ?? c).join('').replace(/[^a-z]/g, '');
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// ---------- parameters ----------

const FREEFORM = /^(command|cmd|shell|shell_?command|script|code|source_?code|sql|raw_?sql|sql_?query|query_?string|expression|expr|eval|javascript|js|python|bash|powershell)$/i;
const URL_PARAM = /^(url|uri|link|href|endpoint|webhook(_?url)?|callback(_?url)?|redirect(_?url|_?uri)?|target(_?url)?|fetch_?url|image_?url|feed(_?url)?|source_?url|host)$/i;
const PATH_PARAM = /^(path|file|filename|file_?name|file_?path|filepath|dir|directory|folder|location)$/i;
const ID_PARAM = /^(user_?id|account_?id|customer_?id|tenant_?id|org(anization)?_?id|owner_?id|member_?id|patient_?id|employee_?id|as_?user|on_?behalf_?of)$/i;
const SECRET_PARAM = /(password|passwd|secret|api_?key|apikey|access_?token|auth_?token|bearer|credential|private_?key)/i;

// ---------- tool review ----------

export function checkTools(tools: ToolModel[]): Finding[] {
  const out: Finding[] = [];

  for (const t of tools) {
    const where = `tool ${t.name}`;
    const w = words(t.name);
    const verb = w.find((x) => WRITE_VERB.test(x));
    const highImpact = w.some((x) => HIGH_IMPACT.test(x)) || t.annotations.destructiveHint === true;
    const declaredReadOnly = t.annotations.readOnlyHint === true;

    // hidden characters anywhere in what the model reads
    const hidden = findHiddenChars(`${t.name}\n${t.scanText}`);
    if (hidden.count) {
      out.push(make({
        rule: 'TOOL-HIDDEN-CHARS', severity: 'critical', title: 'The definition contains invisible characters', where,
        evidence: `${hidden.count} hidden code point${hidden.count > 1 ? 's' : ''}: ${hidden.codes.slice(0, 6).join(', ')}`,
        detail: 'Zero-width, direction-override or tag characters do not show in a review tool but the model still reads them. A definition that carries them cannot be reviewed by eye.',
        fix: 'Remove every invisible code point from names, descriptions and schemas, and fail CI when a tool definition contains one.',
        refs: [{ standard: LLM_RISK.injection }],
      }));
    }

    // wording that addresses the model
    const hits = directiveHits(t.scanText);
    if (hits.length) {
      out.push(make({
        rule: 'TOOL-INSTRUCTION-TEXT', severity: 'high', title: 'The description talks to the model, not about the tool', where,
        evidence: hits[0].quote.slice(0, 160),
        detail: `The text ${hits.map((h) => h.label).join('; ')}. A tool description should only say what the tool does and what its inputs mean; anything else is an instruction the model may follow.`,
        fix: 'Rewrite the description as a plain statement of what the tool does. Review every change to tool text before it ships, as you would review code.',
        refs: [{ standard: LLM_RISK.injection }, { standard: LLM_RISK.supply }],
      }));
    }

    // actions that change things
    if (highImpact && !declaredReadOnly) {
      out.push(make({
        rule: 'TOOL-NEEDS-APPROVAL', severity: /refund|transfer|pay|charge|withdraw|delete|destroy|drop|purge|grant|revoke|execute|exec|deploy/.test(w.join(' ')) ? 'high' : 'medium',
        title: 'A tool moves money, deletes data or changes access', where, evidence: verb ?? (t.annotations.destructiveHint ? 'destructiveHint: true' : undefined),
        detail: 'A model can call this tool on the strength of text it has read in a document, an email or a web page. Without a person in the loop, one misread instruction becomes a real action.',
        fix: 'Have the server hold the action as pending and execute it only after the signed-in user confirms. Cap how often it can run per user per day.',
        refs: [{ standard: LLM_RISK.agency }],
      }));
    }
    if (t.source === 'mcp' && verb && t.annotations.readOnlyHint === undefined && t.annotations.destructiveHint === undefined) {
      out.push(make({
        rule: 'TOOL-NO-ANNOTATIONS', severity: 'low', title: 'A tool that changes data declares no hints', where, evidence: verb,
        detail: 'MCP clients use readOnlyHint and destructiveHint to decide when to ask the user first. Without them the client has to guess.',
        fix: 'Set readOnlyHint: false and destructiveHint: true (or false) on every tool that writes, and readOnlyHint: true on the ones that only read.',
        refs: [{ standard: LLM_RISK.agency }],
      }));
    }

    // parameters
    for (const p of t.params) {
      if (FREEFORM.test(p.name)) {
        out.push(make({
          rule: 'TOOL-FREEFORM-EXEC', severity: 'critical', title: 'A parameter takes a command, script or query', where: `${where} · ${p.name}`, evidence: p.name,
          detail: 'Whatever the model writes into this parameter runs as code or as a query. The tool can do anything the server can.',
          fix: 'Replace it with narrow tools that each take typed values (an order id, a date range) and build the query on the server.',
          refs: [{ standard: LLM_RISK.agency }],
        }));
      }
      if (URL_PARAM.test(p.name) || /\b(url|uri)\b/i.test(p.description ?? '') && p.type === 'string' && /fetch|download|request|load/i.test(`${t.description} ${p.description}`)) {
        out.push(make({
          rule: 'TOOL-URL-PARAM', severity: 'medium', title: 'The model chooses a URL the server fetches', where: `${where} · ${p.name}`, evidence: p.name,
          detail: 'If the server fetches it, the model (or text it read) can point the server at internal addresses or send data to an outside host.',
          fix: 'Allow-list the hosts this tool may reach, block private and link-local ranges after DNS resolution, and never return the raw response.',
          refs: [{ standard: API_TOP10.API7 }],
        }));
      }
      if (PATH_PARAM.test(p.name)) {
        out.push(make({
          rule: 'TOOL-PATH-PARAM', severity: 'medium', title: 'The model chooses a file path', where: `${where} · ${p.name}`, evidence: p.name,
          detail: 'A path such as ../../.env reaches files outside the folder the tool was meant for.',
          fix: 'Resolve the path against one fixed base folder and reject anything that resolves outside it; prefer file ids over paths.',
          refs: [{ standard: API_TOP10.API8 }],
        }));
      }
      if (ID_PARAM.test(p.name)) {
        out.push(make({
          rule: 'TOOL-ID-PARAM', severity: 'high', title: 'The model chooses whose data to act on', where: `${where} · ${p.name}`, evidence: p.name,
          detail: 'The tool takes the user or account as an argument, so a confused or misled model can act on someone else\'s records.',
          fix: 'Take the identity from the signed-in session on the server, drop the parameter, and check ownership of every object.',
          refs: [{ standard: API_TOP10.API1 }],
        }));
      }
      if (SECRET_PARAM.test(p.name)) {
        out.push(make({
          rule: 'TOOL-SECRET-PARAM', severity: 'high', title: 'A credential passes through the model', where: `${where} · ${p.name}`, evidence: p.name,
          detail: 'The model has to hold this secret in its context to fill the parameter, where it can be logged, echoed in an answer or sent to another tool.',
          fix: 'Inject credentials on the server side of the tool, from a secret store, and remove the parameter.',
          refs: [{ standard: LLM_RISK.disclosure }],
        }));
      }
    }
    if (t.schemaOpen) {
      out.push(make({
        rule: 'TOOL-SCHEMA-OPEN', severity: 'low', title: 'The input schema accepts extra properties', where,
        detail: 'additionalProperties is not false, so the model can pass fields the server never meant to receive.',
        fix: 'Set additionalProperties: false, list required fields, and validate arguments on the server before acting.',
        refs: [{ standard: API_TOP10.API3 }],
      }));
    }

    // documentation
    const undescribed = t.params.filter((p) => !p.description).length;
    if (t.description.trim().length < 20 || (t.params.length > 1 && undescribed / t.params.length > 0.5)) {
      out.push(make({
        rule: 'TOOL-UNDESCRIBED', severity: 'low', title: 'The tool or its inputs are barely described', where,
        evidence: t.description.trim() ? `"${t.description.trim().slice(0, 60)}"` : '(no description)',
        detail: 'A model picks tools and fills arguments from these words. Thin descriptions lead to wrong calls.',
        fix: 'Say in one or two sentences what the tool does, what it changes and when not to use it; describe every parameter.',
        refs: [],
      }));
    }
    if (t.description.length > 1500) {
      out.push(make({
        rule: 'TOOL-LONG-DESC', severity: 'low', title: 'The description is too long to review', where, evidence: `${t.description.length} characters`,
        detail: 'Very long descriptions cost context on every call and are where unwanted instructions are easiest to miss.',
        fix: 'Keep descriptions under 500 characters and move usage notes to your own documentation.',
        refs: [{ standard: LLM_RISK.injection }],
      }));
    }
  }

  // look-alike and duplicate names across the set
  const seen = new Map<string, string>();
  const flagged = new Set<string>();
  for (const t of tools) {
    if (/[^\x20-\x7E]/.test(t.name) && !flagged.has(t.name)) {
      flagged.add(t.name);
      out.push(make({
        rule: 'TOOL-LOOKALIKE', severity: 'high', title: 'A tool name uses non-ASCII letters', where: `tool ${revealHidden(t.name)}`,
        detail: 'Letters from another alphabet can make one tool look like another, so a reviewer approves the wrong one.',
        fix: 'Restrict tool names to [a-z0-9_-] and reject anything else when servers register tools.',
        refs: [{ standard: LLM_RISK.supply }],
      }));
    }
  }
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const a = tools[i].name; const b = tools[j].name;
      const sa = skeleton(a); const sb = skeleton(b);
      const same = a === b;
      const close = !same && sa.length >= 5 && (sa === sb || editDistance(sa, sb) === 1);
      if ((same || close) && !seen.has(`${a}|${b}`)) {
        seen.set(`${a}|${b}`, '1');
        out.push(make({
          rule: 'TOOL-LOOKALIKE', severity: same ? 'high' : 'medium', title: same ? 'Two tools share one name' : 'Two tool names are nearly the same',
          where: `tools ${revealHidden(a)} and ${revealHidden(b)}`, evidence: same ? a : `${a} / ${b}`,
          detail: same
            ? 'When two servers register the same name, which one runs depends on load order. One can quietly shadow the other.'
            : 'Names this close are easy to confuse for a reviewer and for the model, and are a common sign of a copied or shadowing tool.',
          fix: 'Prefix tool names with their server (billing_issue_refund) and keep an allow-list of the exact tools each agent may call.',
          refs: [{ standard: LLM_RISK.supply }],
        }));
      }
    }
  }
  return out;
}

// ---------- LLM endpoints in an OpenAPI spec ----------

const AI_OP = /(chat|completion|prompt|generat|llm|assistant|\bask\b|\/ask|agent|embedding|summar|\brag\b|copilot|\/ai(\/|$)|\bai\b|gpt|inference|answer)/i;
const PROMPT_FIELD = /^(prompt|input|inputs|message|messages|content|query|question|text|user_?input|utterance)$/i;
const SYSTEM_FIELD = /^(system|system_?prompt|system_?message|instructions|preamble|persona|context_?prompt)$/i;
const MODEL_FIELD = /^(model|model_?id|engine|deployment)$/i;
const TOKENS_FIELD = /^(max_?tokens|max_?output_?tokens|max_?new_?tokens|max_?completion_?tokens|maxTokens|n|num_?results)$/i;
const PII_FIELD = /^(email|phone|phone_?number|mobile|ssn|social_?security(_?number)?|dob|date_?of_?birth|birth_?date|address|street|card_?number|pan|iban|passport(_?number)?|national_?id|tax_?id|patient(_?name)?|diagnosis|medical_?record|salary)$/i;
const RENDER_FIELD = /^(html|rendered|rendered_?html|answer_?html|markdown|body_?html|output_?html)$/i;

function isAiOperation(op: OperationModel): boolean {
  return AI_OP.test(`${op.path} ${op.operationId ?? ''} ${op.summary ?? ''} ${op.tags.join(' ')}`);
}

function documentsLimit(op: OperationModel): boolean {
  const ext = Object.keys(op.extensions).some((k) => /rate|throttl|limit|quota|budget/.test(k));
  return op.responseCodes.includes('429') || ext || /rate.?limit|throttl|per (minute|hour|day)|quota|budget/i.test(`${op.summary ?? ''} ${op.description ?? ''}`);
}

export function checkAiSurface(api: ApiModel): Finding[] {
  const out: Finding[] = [];

  // hidden characters in any text an agent would read from the spec
  const texts: { where: string; text: string }[] = [{ where: 'info.description', text: api.description ?? '' }];
  for (const op of api.operations) {
    texts.push({ where: op.key, text: [op.summary, op.description, ...op.params.map((p) => p.description), ...op.requestFields.map((f) => f.description)].filter(Boolean).join('\n') });
  }
  for (const t of texts) {
    const h = findHiddenChars(t.text);
    if (h.count) {
      out.push(make({
        rule: 'SPEC-HIDDEN-TEXT', severity: 'high', title: 'The spec text contains invisible characters', where: t.where,
        evidence: `${h.count} hidden code point${h.count > 1 ? 's' : ''}: ${h.codes.slice(0, 6).join(', ')}`,
        detail: 'Agents and tool generators turn these descriptions into tool text. Invisible characters reach the model without anyone seeing them.',
        fix: 'Strip invisible code points from the spec and add a CI check that fails on them.',
        refs: [{ standard: LLM_RISK.injection }],
      }));
    }
    const d = directiveHits(t.text);
    if (d.length) {
      out.push(make({
        rule: 'SPEC-INSTRUCTION-TEXT', severity: 'medium', title: 'A description addresses an AI model', where: t.where, evidence: d[0].quote.slice(0, 160),
        detail: `The text ${d.map((x) => x.label).join('; ')}. When this spec is turned into agent tools, the sentence becomes an instruction.`,
        fix: 'Keep descriptions factual: what the operation does, who may call it and what it changes.',
        refs: [{ standard: LLM_RISK.injection }],
      }));
    }
  }

  for (const op of api.operations.filter(isAiOperation)) {
    const where = op.key;
    const req = op.requestFields;

    const prompts = req.filter((f) => PROMPT_FIELD.test(f.name) && (f.type === 'string' || f.type === undefined) && f.maxLength === undefined);
    if (prompts.length) {
      out.push(make({
        rule: 'LLM-INPUT-LIMIT', severity: 'medium', title: 'The prompt has no length limit', where, evidence: prompts.map((f) => f.path).slice(0, 3).join(', '),
        detail: 'Unbounded input lets one request fill the model\'s context, run up its cost and bury your own instructions under someone else\'s text.',
        fix: 'Set maxLength on prompt fields, enforce it on the server and count tokens before calling the model.',
        refs: [{ standard: API_TOP10.API4 }],
      }));
    }
    const sys = req.filter((f) => SYSTEM_FIELD.test(f.name));
    const roleField = req.find((f) => /(^|\.)(messages\[\]\.)?role$/.test(f.path) || f.name === 'role');
    const roleOpen = roleField && (!roleField.enumValues || roleField.enumValues.includes('system'));
    if (sys.length || roleOpen) {
      out.push(make({
        rule: 'LLM-CLIENT-INSTRUCTIONS', severity: 'high', title: 'The caller can set the model\'s instructions', where,
        evidence: sys.length ? sys.map((f) => f.path).join(', ') : `${roleField!.path} allows "system"`,
        detail: 'If the client sends the system prompt or a system-role message, every safety rule you wrote into it can be replaced by the caller.',
        fix: 'Keep the system prompt on the server. Accept only user messages from the client and restrict role to "user".',
        refs: [{ standard: LLM_RISK.injection }],
      }));
    }
    const model = req.filter((f) => MODEL_FIELD.test(f.name) && !f.enumValues);
    const tokens = req.filter((f) => TOKENS_FIELD.test(f.name) && f.maximum === undefined);
    if (model.length || tokens.length) {
      out.push(make({
        rule: 'LLM-MODEL-CHOICE', severity: 'medium', title: 'The caller picks the model or the output size', where, evidence: [...model, ...tokens].map((f) => f.path).join(', '),
        detail: 'A free choice of model or max_tokens lets a caller pick the most expensive option every time.',
        fix: 'Choose the model on the server, or limit it with an enum, and set a maximum on token counts.',
        refs: [{ standard: API_TOP10.API4 }],
      }));
    }
    const pii = req.filter((f) => PII_FIELD.test(f.name));
    if (pii.length) {
      out.push(make({
        rule: 'LLM-PII-IN', severity: 'medium', title: 'Personal data is sent to the model', where, evidence: pii.map((f) => f.path).slice(0, 4).join(', '),
        detail: 'Personal fields sent to a model provider may be logged, retained or used outside your control, and can come back in another user\'s answer.',
        fix: 'Send ids instead of personal data, redact or pseudonymise before the call, and check the provider\'s retention terms.',
        refs: [{ standard: LLM_RISK.disclosure }],
      }));
    }
    if (!documentsLimit(op)) {
      out.push(make({
        rule: 'LLM-COST-LIMIT', severity: 'high', title: 'An AI endpoint shows no rate or spend limit', where,
        detail: 'Every call costs money at the model provider. Without a limit, one script can run up the bill or starve other users.',
        fix: 'Rate-limit per user, set a daily token or spend budget, return 429 when it is reached and document it.',
        refs: [{ standard: API_TOP10.API4 }],
      }));
    }
    const render = op.responseFields.filter((f) => RENDER_FIELD.test(f.name) || f.format === 'html');
    if (render.length) {
      out.push(make({
        rule: 'LLM-RAW-OUTPUT', severity: 'medium', title: 'Model output is returned ready to render', where, evidence: render.map((f) => f.path).join(', '),
        detail: 'Model output can contain markup, links and images it copied from what it read. Rendered as-is, it can run script or load content from other hosts.',
        fix: 'Return plain text, escape it before rendering, and drop links and images to hosts you have not allow-listed.',
        refs: [{ standard: LLM_RISK.output }],
      }));
    }
  }
  return out;
}

// ---------- safeguards checklist ----------

export interface Safeguard {
  id: string;
  title: string;
  label: string;
  why: string;
  severity: Severity;
  standard?: string;
}

export const SAFEGUARDS: Safeguard[] = [
  { id: 'approval', title: 'No confirmation before high-impact actions', label: 'Actions that move money, delete data or change access wait for a person to confirm.', why: 'An agent acts on text it has read; a confirmation step stops one misread instruction from becoming a real action.', severity: 'high', standard: LLM_RISK.agency },
  { id: 'identity', title: "The agent uses a shared key, not the user's token", label: 'The agent calls the API with the signed-in user\'s own token, never a shared service key.', why: 'With a shared key the API cannot tell users apart, so every ownership check passes.', severity: 'high', standard: API_TOP10.API1 },
  { id: 'scopes', title: "The agent's token is broader than its tools", label: 'The agent\'s token holds only the scopes its tools need.', why: 'Least privilege limits what a misled agent can reach.', severity: 'medium', standard: API_TOP10.API5 },
  { id: 'log', title: 'Tool calls are not fully logged', label: 'Every tool call is logged with user, tool, arguments, result, time and conversation id.', why: 'Without these six fields you cannot answer "who did this, and why" after an incident.', severity: 'medium' },
  { id: 'pinned', title: 'Tool versions are not pinned or reviewed', label: 'Tool servers are pinned to a reviewed version, and changed tool text is reviewed before release.', why: 'A tool definition is code the model reads; an unreviewed update can change what the agent does.', severity: 'medium', standard: LLM_RISK.supply },
  { id: 'egress', title: 'Outbound hosts are not restricted', label: 'The agent reaches only allow-listed hosts, and its answers cannot load links or images from other hosts.', why: 'Outbound links and images are how data leaves a conversation.', severity: 'high', standard: LLM_RISK.output },
  { id: 'untrusted', title: 'Outside content is not kept apart from instructions', label: 'Documents, emails and web pages the agent reads are handled as data, kept apart from its instructions.', why: 'Content from outside is the main way unwanted instructions reach a model.', severity: 'high', standard: LLM_RISK.injection },
  { id: 'limits', title: 'No per-user limits on agent use', label: 'Each user has limits on tool calls, tokens and spend per day.', why: 'Limits cap the damage of a loop, a bug or abuse.', severity: 'medium', standard: API_TOP10.API4 },
];

/** One finding per safeguard that is not in place. */
export function checkSafeguards(inPlace: Record<string, boolean>): Finding[] {
  return SAFEGUARDS.filter((s) => !inPlace[s.id]).map((s) => make({
    rule: `AGENT-${s.id.toUpperCase()}`, severity: s.severity, title: s.title,
    where: 'agent safeguards', detail: s.why, fix: s.label,
    refs: s.standard ? [{ standard: s.standard }] : [],
  }));
}
