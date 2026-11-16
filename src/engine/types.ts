// Patchlane engine: shared types.
// Everything here runs the same in the browser and in Node (the CLI). No network, no DOM.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

/** Where a rule comes from: a public standard plus the course module that taught it. */
export interface Ref {
  /** e.g. "API1:2023 Broken Object Level Authorization" or "OWASP LLM: Prompt injection" */
  standard?: string;
  /** e.g. "OWASP API Security Top 10 and Beyond" */
  course?: string;
}

export type FindingArea = 'api' | 'auth' | 'docs' | 'inventory' | 'server' | 'token' | 'release' | 'agent';

export const AREA_LABEL: Record<FindingArea, string> = {
  api: 'Authorization and data',
  auth: 'Authentication',
  docs: 'Documentation',
  inventory: 'Inventory',
  server: 'Server configuration',
  token: 'Tokens',
  release: 'Release',
  agent: 'AI agents',
};

export interface Finding {
  /** Stable id of the rule, e.g. "API1-OWNERSHIP" */
  rule: string;
  area: FindingArea;
  severity: Severity;
  title: string;
  /** Where it was found: "POST /v2/refunds", "tool issue_refund", "header Set-Cookie" */
  where: string;
  detail: string;
  fix: string;
  refs: Ref[];
  /** A short quote of the matched text, when there is one */
  evidence?: string;
}

// ---------- API model ----------

export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'patch' | 'head' | 'options' | 'trace';

export interface SchemaField {
  /** dotted path inside the body, e.g. "card.number" */
  path: string;
  name: string;
  type?: string;
  format?: string;
  readOnly?: boolean;
  writeOnly?: boolean;
  maxLength?: number;
  maximum?: number;
  enumValues?: unknown[];
  description?: string;
}

export interface ParamModel {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  type?: string;
  format?: string;
  maximum?: number;
  description?: string;
}

export interface SecurityRequirement {
  /** scheme name -> scopes */
  [scheme: string]: string[];
}

export interface SecurityScheme {
  name: string;
  type: string; // apiKey | http | oauth2 | openIdConnect | mutualTLS
  scheme?: string; // basic | bearer
  in?: string; // query | header | cookie
  bearerFormat?: string;
  flows?: Record<string, { scopes?: Record<string, string>; authorizationUrl?: string; tokenUrl?: string }>;
}

export interface OperationModel {
  key: string; // "POST /v2/refunds"
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  params: ParamModel[];
  requestFields: SchemaField[];
  requestAdditionalProps: boolean | null; // null = not a JSON object body
  requestHasBinary: boolean;
  responseFields: SchemaField[];
  responseIsArray: boolean;
  responseCodes: string[];
  errorFields: SchemaField[];
  /** effective security: [] means explicitly public, null means not declared anywhere */
  security: SecurityRequirement[] | null;
  deprecated: boolean;
  /** x-* extension keys on the operation, lower-cased */
  extensions: Record<string, unknown>;
  hasExamples: boolean;
  callbacks: boolean;
}

export interface ApiModel {
  title: string;
  version: string;
  openapi: string; // "3.0.3", "3.1.0", "2.0"
  description?: string;
  hasContact: boolean;
  servers: string[];
  schemes: SecurityScheme[];
  globalSecurity: SecurityRequirement[] | null;
  operations: OperationModel[];
  webhooks: number;
}

// ---------- Agent tools ----------

export interface ToolParam {
  name: string;
  type?: string;
  description?: string;
  default?: unknown;
}

export interface ToolModel {
  name: string;
  description: string;
  params: ToolParam[];
  /** every human-readable string in the definition, joined, for the text scans */
  scanText: string;
  /** additionalProperties is not false on the input schema */
  schemaOpen: boolean;
  required: string[];
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  source: 'mcp' | 'openai' | 'anthropic' | 'plain';
}

// ---------- Fixes ----------

export type Framework = 'express' | 'fastapi' | 'django' | 'laravel' | 'spring';

export const FRAMEWORK_LABEL: Record<Framework, string> = {
  express: 'Express (Node.js)',
  fastapi: 'FastAPI (Python)',
  django: 'Django REST Framework',
  laravel: 'Laravel (PHP)',
  spring: 'Spring Boot (Java)',
};

export interface FixSnippet {
  framework: Framework;
  language: string;
  code: string;
  note?: string;
}

// ---------- Report ----------

export interface Report {
  generatedAt: string;
  engineVersion: string;
  api: ApiModel | null;
  /** which inputs were checked: spec, response, token, release, tools, safeguards */
  inputs: string[];
  findings: Finding[];
  docsScore: { score: number; parts: { label: string; value: number }[] } | null;
  grade: { letter: 'A' | 'B' | 'C' | 'D' | 'F'; score: number };
  bySeverity: Record<Severity, number>;
  worst: Severity | null;
}
