import yaml from 'js-yaml';
import type {
  ApiModel, HttpMethod, OperationModel, ParamModel, SchemaField, SecurityRequirement, SecurityScheme, ToolModel,
} from './types';

const METHODS: HttpMethod[] = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'];
const MAX_INPUT = 5 * 1024 * 1024; // 5 MB: larger specs are refused rather than freezing the tab
const MAX_DEPTH = 12; // schema nesting followed when flattening
const MAX_FIELDS = 5000; // fields kept per flattened schema: shared sub-schemas cannot fan out without bound

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Parse JSON or YAML text. Throws an Error with a readable message. */
export function parseDocument(text: string): Json {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The input is empty.');
  if (text.length > MAX_INPUT) throw new Error('The input is larger than 5 MB. Split the spec or remove unused parts.');
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t); } catch (e) { throw new Error('This looks like JSON but does not parse: ' + (e as Error).message); }
  }
  try {
    // JSON_SCHEMA: no custom tags, no functions, nothing executable
    return yaml.load(t, { schema: yaml.JSON_SCHEMA, json: true });
  } catch (e) {
    throw new Error('The YAML does not parse: ' + (e as Error).message.split('\n')[0]);
  }
}

/** Resolve a local JSON pointer like "#/components/schemas/User". External refs are left alone. */
function resolvePointer(root: Json, ref: string): Json | undefined {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function deref(root: Json, node: Json, seen: Set<string> = new Set()): Json {
  let cur = node;
  let guard = 0;
  while (cur && typeof cur === 'object' && typeof cur.$ref === 'string' && guard < 20) {
    if (seen.has(cur.$ref)) return {};
    seen.add(cur.$ref);
    const next = resolvePointer(root, cur.$ref);
    if (next === undefined) return {};
    cur = next;
    guard++;
  }
  return cur;
}

/** Flatten a schema into dotted field paths. Follows $ref, allOf, oneOf, anyOf and array items. */
function flattenSchema(root: Json, schema: Json, prefix = '', depth = 0, seen: Set<string> = new Set(), out: SchemaField[] = []): SchemaField[] {
  if (!schema || typeof schema !== 'object' || depth > MAX_DEPTH || out.length >= MAX_FIELDS) return out;
  if (typeof schema.$ref === 'string') {
    if (seen.has(schema.$ref)) return out;
    const nextSeen = new Set(seen); nextSeen.add(schema.$ref);
    return flattenSchema(root, resolvePointer(root, schema.$ref), prefix, depth + 1, nextSeen, out);
  }
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(schema[key])) for (const s of schema[key]) flattenSchema(root, s, prefix, depth + 1, seen, out);
  }
  if (schema.type === 'array' || schema.items) {
    flattenSchema(root, schema.items, prefix ? prefix + '[]' : '', depth + 1, seen, out);
  }
  const props = schema.properties;
  if (props && typeof props === 'object') {
    for (const [name, raw] of Object.entries<Json>(props)) {
      const s = deref(root, raw);
      const path = prefix ? `${prefix}.${name}` : name;
      out.push({
        path, name,
        type: Array.isArray(s?.type) ? s.type.join('|') : s?.type,
        format: s?.format,
        readOnly: !!s?.readOnly,
        writeOnly: !!s?.writeOnly,
        maxLength: typeof s?.maxLength === 'number' ? s.maxLength : undefined,
        maximum: typeof s?.maximum === 'number' ? s.maximum : undefined,
        enumValues: Array.isArray(s?.enum) ? s.enum : undefined,
        description: typeof s?.description === 'string' ? s.description : undefined,
      });
      // a property that is a $ref already open on this branch is a cycle: keep the field, stop descending
      const ref = raw && typeof raw === 'object' && typeof raw.$ref === 'string' ? raw.$ref as string : undefined;
      if (ref && seen.has(ref)) continue;
      if (s && (s.properties || s.items || s.allOf || s.oneOf || s.anyOf || s.$ref)) {
        flattenSchema(root, s, path, depth + 1, ref ? new Set(seen).add(ref) : seen, out);
      }
    }
  }
  return out;
}

function schemaIsArray(root: Json, schema: Json): boolean {
  const s = deref(root, schema);
  if (!s || typeof s !== 'object') return false;
  if (s.type === 'array') return true;
  // common envelope: { data: [...] } or { items: [...] }
  const props = s.properties || {};
  for (const k of ['data', 'items', 'results', 'records', 'content']) {
    const p = deref(root, props[k]);
    if (p && p.type === 'array') return true;
  }
  return false;
}

function hasAnyExample(node: Json, depth = 0): boolean {
  if (!node || typeof node !== 'object' || depth > 8) return false;
  if ('example' in node || 'examples' in node) return true;
  return Object.values(node).some((v) => hasAnyExample(v, depth + 1));
}

function jsonBodySchema(content: Json): Json | undefined {
  if (!content || typeof content !== 'object') return undefined;
  const key = Object.keys(content).find((k) => /json/i.test(k)) ?? Object.keys(content).find((k) => /form/i.test(k));
  return key ? content[key]?.schema : undefined;
}

function binaryBody(root: Json, content: Json): boolean {
  if (!content || typeof content !== 'object') return false;
  if (Object.keys(content).some((k) => /multipart|octet-stream|image\/|application\/pdf/i.test(k))) return true;
  for (const v of Object.values<Json>(content)) {
    const fields = flattenSchema(root, v?.schema);
    if (fields.some((f) => f.format === 'binary' || f.format === 'byte')) return true;
  }
  return false;
}

function parseSchemes(doc: Json): SecurityScheme[] {
  const out: SecurityScheme[] = [];
  const v3 = doc?.components?.securitySchemes;
  const v2 = doc?.securityDefinitions;
  const src = v3 || v2 || {};
  for (const [name, raw] of Object.entries<Json>(src)) {
    const s = deref(doc, raw) || {};
    let flows = s.flows;
    if (!flows && s.type === 'oauth2' && s.flow) {
      // Swagger 2: a single flow with names implicit | password | application | accessCode
      const map: Record<string, string> = { accessCode: 'authorizationCode', application: 'clientCredentials' };
      flows = { [map[s.flow] || s.flow]: { scopes: s.scopes, authorizationUrl: s.authorizationUrl, tokenUrl: s.tokenUrl } };
    }
    out.push({
      name,
      type: s.type === 'basic' ? 'http' : String(s.type || 'unknown'),
      scheme: s.type === 'basic' ? 'basic' : s.scheme ? String(s.scheme).toLowerCase() : undefined,
      in: s.in,
      bearerFormat: s.bearerFormat,
      flows,
    });
  }
  return out;
}

function parseServers(doc: Json): string[] {
  if (Array.isArray(doc?.servers)) return doc.servers.map((s: Json) => String(s?.url ?? '')).filter(Boolean);
  if (doc?.host) {
    const schemes: string[] = Array.isArray(doc.schemes) && doc.schemes.length ? doc.schemes : ['https'];
    return schemes.map((sc) => `${sc}://${doc.host}${doc.basePath || ''}`);
  }
  return [];
}

/** Build the API model from an OpenAPI 3.x or Swagger 2.0 document. */
export function buildApiModel(doc: Json): ApiModel {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('The spec is not an object.');
  const version = String(doc.openapi || doc.swagger || '');
  if (!version) throw new Error('No "openapi" or "swagger" field: this does not look like an OpenAPI document.');
  if (!doc.paths || typeof doc.paths !== 'object') throw new Error('The spec has no "paths".');

  // keep only requirement objects: `security: [null]` must not crash a check later
  const secList = (v: Json): SecurityRequirement[] | null =>
    Array.isArray(v) ? v.filter((r: Json) => r && typeof r === 'object' && !Array.isArray(r)) : null;
  const globalSecurity: SecurityRequirement[] | null = secList(doc.security);
  const operations: OperationModel[] = [];

  for (const [path, rawItem] of Object.entries<Json>(doc.paths)) {
    const item = deref(doc, rawItem) || {};
    const sharedParams: Json[] = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const op = item[method];
      if (!op || typeof op !== 'object') continue;

      const params: ParamModel[] = [];
      const bodyParamsV2: Json[] = [];
      const seenParam = new Set<string>();
      for (const rawP of [...(Array.isArray(op.parameters) ? op.parameters : []), ...sharedParams]) {
        const p = deref(doc, rawP) || {};
        const id = `${p.in}:${p.name}`;
        if (seenParam.has(id)) continue; // operation-level overrides path-level
        seenParam.add(id);
        if (p.in === 'body') { bodyParamsV2.push(p); continue; }
        if (p.in === 'formData') { bodyParamsV2.push({ schema: { properties: { [p.name]: { type: p.type, format: p.type === 'file' ? 'binary' : p.format } } } }); continue; }
        if (!['path', 'query', 'header', 'cookie'].includes(p.in)) continue;
        const sch = deref(doc, p.schema) || p;
        params.push({
          name: String(p.name), in: p.in, required: !!p.required || p.in === 'path',
          type: sch?.type, format: sch?.format,
          maximum: typeof sch?.maximum === 'number' ? sch.maximum : undefined,
          description: p.description,
        });
      }

      // request body
      let requestFields: SchemaField[] = [];
      let requestAdditionalProps: boolean | null = null;
      let requestHasBinary = false;
      const rb = deref(doc, op.requestBody);
      if (rb?.content) {
        const sch = jsonBodySchema(rb.content);
        if (sch) {
          requestFields = flattenSchema(doc, sch);
          const top = deref(doc, sch);
          if (top && (top.type === 'object' || top.properties)) requestAdditionalProps = top.additionalProperties === false ? false : true;
        }
        requestHasBinary = binaryBody(doc, rb.content);
      }
      for (const bp of bodyParamsV2) {
        requestFields = requestFields.concat(flattenSchema(doc, bp.schema));
        const top = deref(doc, bp.schema);
        if (top && (top.type === 'object' || top.properties)) requestAdditionalProps = top.additionalProperties === false ? false : true;
        if (flattenSchema(doc, bp.schema).some((f) => f.format === 'binary')) requestHasBinary = true;
      }

      // responses
      const responses = op.responses && typeof op.responses === 'object' ? op.responses : {};
      const responseCodes = Object.keys(responses);
      let responseFields: SchemaField[] = [];
      let errorFields: SchemaField[] = [];
      let responseIsArray = false;
      for (const [code, rawR] of Object.entries<Json>(responses)) {
        const r = deref(doc, rawR) || {};
        const sch = r.content ? jsonBodySchema(r.content) : r.schema; // v3 | v2
        if (!sch) continue;
        const fields = flattenSchema(doc, sch);
        if (/^2/.test(code)) {
          responseFields = responseFields.concat(fields);
          if (schemaIsArray(doc, sch)) responseIsArray = true;
        } else if (/^[45]/.test(code) || code === 'default') {
          errorFields = errorFields.concat(fields);
        }
      }

      const extensions: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(op)) if (k.startsWith('x-')) extensions[k.toLowerCase()] = v;

      const key = `${method.toUpperCase()} ${path}`;
      operations.push({
        key, method, path,
        operationId: typeof op.operationId === 'string' ? op.operationId : undefined,
        summary: typeof op.summary === 'string' ? op.summary : undefined,
        description: typeof op.description === 'string' ? op.description : undefined,
        tags: Array.isArray(op.tags) ? op.tags.map(String) : [],
        params, requestFields, requestAdditionalProps, requestHasBinary,
        responseFields, responseIsArray, responseCodes, errorFields,
        security: secList(op.security) ?? globalSecurity,
        deprecated: !!op.deprecated,
        extensions,
        hasExamples: hasAnyExample(op),
        callbacks: !!op.callbacks && Object.keys(op.callbacks).length > 0,
      });
    }
  }

  return {
    title: String(doc.info?.title || 'Untitled API'),
    version: String(doc.info?.version || ''),
    openapi: version,
    description: typeof doc.info?.description === 'string' ? doc.info.description : undefined,
    hasContact: !!doc.info?.contact,
    servers: parseServers(doc),
    schemes: parseSchemes(doc),
    globalSecurity,
    operations,
    webhooks: doc.webhooks && typeof doc.webhooks === 'object' ? Object.keys(doc.webhooks).length : 0,
  };
}

/**
 * The value of a `key:` line exactly as written, without quotes or a comment: a top-level key, or with
 * `inside` set, the first such key indented under that top-level block (so a schema property called
 * `version` elsewhere in the spec is never read by mistake).
 */
function asWritten(text: string, key: string, inside?: string): string | undefined {
  const value = new RegExp(`^${inside ? '[ \\t]+' : ''}${key}:[ \\t]*["']?([^"'#\\r\\n]+?)["']?[ \\t]*(?:#.*)?$`);
  const lines = text.split(/\r?\n/);
  let open = !inside;
  for (const line of lines) {
    if (inside) {
      if (new RegExp(`^${inside}:`).test(line)) { open = true; continue; }
      if (open && /^\S/.test(line)) break; // the next top-level key closes the block
    }
    if (open) { const m = line.match(value); if (m) return m[1]; }
  }
  return undefined;
}

export function parseApi(text: string): ApiModel {
  const doc = parseDocument(text);
  // YAML reads an unquoted `version: 1.10` as the number 1.1 and `swagger: 2.0` as 2; keep the text as written
  if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
    if (doc.info && typeof doc.info.version === 'number') doc.info.version = asWritten(text, 'version', 'info') ?? String(doc.info.version);
    for (const k of ['openapi', 'swagger']) if (typeof doc[k] === 'number') doc[k] = asWritten(text, k) ?? String(doc[k]);
  }
  return buildApiModel(doc);
}

// ---------- tools ----------

function collectText(node: Json, depth = 0, out: string[] = []): string[] {
  if (depth > 10 || node == null) return out;
  if (typeof node === 'string') { out.push(node); return out; }
  if (Array.isArray(node)) { for (const v of node) collectText(v, depth + 1, out); return out; }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (['description', 'title', 'default', 'examples', 'example', 'enum', 'const', 'x-description'].includes(k)) collectText(v, depth + 1, out);
      else if (typeof v === 'object') collectText(v, depth + 1, out);
    }
  }
  return out;
}

function toolParams(schema: Json): ToolModel['params'] {
  const props = schema?.properties;
  if (!props || typeof props !== 'object') return [];
  return Object.entries<Json>(props).map(([name, s]) => ({
    name, type: s?.type, description: typeof s?.description === 'string' ? s.description : undefined, default: s?.default,
  }));
}

function schemaShape(schema: Json): { schemaOpen: boolean; required: string[] } {
  const hasProps = !!schema?.properties && typeof schema.properties === 'object' && Object.keys(schema.properties).length > 0;
  return {
    schemaOpen: hasProps && schema.additionalProperties !== false,
    required: Array.isArray(schema?.required) ? schema.required.map(String) : [],
  };
}

function oneTool(raw: Json): ToolModel | null {
  if (!raw || typeof raw !== 'object') return null;
  // OpenAI: { type: "function", function: { name, description, parameters } }
  if (raw.type === 'function' && raw.function && typeof raw.function === 'object') {
    const f = raw.function;
    if (!f.name) return null;
    return {
      name: String(f.name), description: String(f.description ?? ''), params: toolParams(f.parameters),
      scanText: [String(f.description ?? ''), ...collectText(f.parameters)].join('\n'),
      ...schemaShape(f.parameters),
      annotations: {}, source: 'openai',
    };
  }
  if (!raw.name) return null;
  const schema = raw.inputSchema ?? raw.input_schema ?? raw.parameters ?? {};
  const source: ToolModel['source'] = raw.inputSchema ? 'mcp' : raw.input_schema ? 'anthropic' : raw.parameters ? 'openai' : 'plain';
  const ann = raw.annotations && typeof raw.annotations === 'object' ? raw.annotations : {};
  return {
    name: String(raw.name),
    description: String(raw.description ?? ''),
    params: toolParams(schema),
    scanText: [String(raw.title ?? ''), String(raw.description ?? ''), ...collectText(schema)].join('\n'),
    ...schemaShape(schema),
    annotations: {
      readOnlyHint: typeof ann.readOnlyHint === 'boolean' ? ann.readOnlyHint : undefined,
      destructiveHint: typeof ann.destructiveHint === 'boolean' ? ann.destructiveHint : undefined,
      idempotentHint: typeof ann.idempotentHint === 'boolean' ? ann.idempotentHint : undefined,
      openWorldHint: typeof ann.openWorldHint === 'boolean' ? ann.openWorldHint : undefined,
    },
    source,
  };
}

/**
 * Accepts an MCP tools/list result ({ tools: [...] } or the full JSON-RPC response),
 * an OpenAI tools / functions array, an Anthropic tools array, or a plain array of tools.
 */
export function parseTools(text: string): ToolModel[] {
  const doc = parseDocument(text);
  let list: Json[] | undefined;
  if (Array.isArray(doc)) list = doc;
  else if (Array.isArray(doc?.tools)) list = doc.tools;
  else if (Array.isArray(doc?.result?.tools)) list = doc.result.tools;
  else if (Array.isArray(doc?.functions)) list = doc.functions;
  else if (doc && typeof doc === 'object' && doc.name) list = [doc];
  if (!list) throw new Error('No tools found. Paste an MCP tools/list result, or an array of OpenAI or Anthropic tool definitions.');
  const tools = list.map(oneTool).filter((t): t is ToolModel => !!t);
  if (!tools.length) throw new Error('The list holds no tool with a name.');
  if (tools.length > 500) throw new Error('More than 500 tools: split them by server.');
  return tools;
}
