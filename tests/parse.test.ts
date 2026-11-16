import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { buildApiModel, parseApi, parseDocument, parseTools } from '../src/engine/parse';
import { analyze } from '../src/engine/report';
import {
  CLEAN_SPEC, ORDERS_SPEC, PAYMENTS_SPEC, TOOLS_ANTHROPIC, TOOLS_JSONRPC, TOOLS_MCP, TOOLS_OPENAI, WAREHOUSE_SWAGGER,
} from '../src/engine/fixtures';
import type { OperationModel } from '../src/engine/types';

const op = (api: { operations: OperationModel[] }, key: string): OperationModel => {
  const found = api.operations.find((o) => o.key === key);
  if (!found) throw new Error(`no operation ${key}; have ${api.operations.map((o) => o.key).join(', ')}`);
  return found;
};
const paths = (fields: { path: string }[]) => fields.map((f) => f.path);

/** A minimal OpenAPI 3.0 document around the given paths and components. */
const doc = (pathsObj: unknown, components: unknown = {}) =>
  JSON.stringify({ openapi: '3.0.3', info: { title: 'Fixture', version: '1.0.0' }, paths: pathsObj, components });

describe('parseDocument', () => {
  it('reads JSON and YAML into the same value', () => {
    const fromYaml = parseDocument('a: 1\nb: [x, y]\nc: { d: true }');
    const fromJson = parseDocument('{"a":1,"b":["x","y"],"c":{"d":true}}');
    expect(fromYaml).toEqual(fromJson);
  });

  it.each([
    ['empty input', '', /empty/],
    ['whitespace only', '  \n\t ', /empty/],
    ['invalid JSON', '{"openapi": "3.0.0", ', /looks like JSON but does not parse/],
    ['invalid JSON array', '[1, 2', /looks like JSON but does not parse/],
    ['invalid YAML', 'openapi: 3.0.0\npaths: [unclosed', /The YAML does not parse/],
    ['YAML with bad indentation', 'a:\n  b: 1\n c: 2', /The YAML does not parse/],
  ])('gives a readable error for %s', (_label, text, re) => {
    expect(() => parseDocument(text)).toThrow(re);
    try { parseDocument(text); } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message.split('\n')).toHaveLength(1);
    }
  });

  it('refuses input over 5 MB', () => {
    const big = 'openapi: 3.0.0\n' + '#'.repeat(5 * 1024 * 1024);
    expect(() => parseDocument(big)).toThrow(/larger than 5 MB/);
    expect(analyze({ spec: big }).errors[0]).toEqual({ input: 'spec', message: expect.stringMatching(/5 MB/) });
  });

  it('never runs code from YAML tags', () => {
    const g = globalThis as Record<string, unknown>;
    delete g.__patchlaneTagRan;
    const attempts = [
      'x: !!js/function "function () { globalThis.__patchlaneTagRan = true }"',
      'x: !!js/undefined ""',
      'x: !!js/regexp /a/',
      'x: !!python/object:os.system ["echo"]',
      'x: !Ref SomethingElse',
      'x: !<tag:example.com,2026:custom> value',
      'x: !!binary aGVsbG8=',
    ];
    for (const text of attempts) {
      let value: unknown;
      try { value = parseDocument(text); } catch (e) {
        expect((e as Error).message).toMatch(/YAML/);
        continue;
      }
      // if a tag is ever accepted, it must come back as plain data
      expect(JSON.parse(JSON.stringify(value))).toEqual(value);
      expect(typeof (value as { x: unknown }).x).not.toBe('function');
    }
    expect(g.__patchlaneTagRan).toBeUndefined();
  });

  it('keeps __proto__ and constructor keys as plain data (no prototype pollution)', () => {
    const yamlText = `openapi: 3.0.3
info: { title: Pollution fixture, version: 1.0.0 }
__proto__: { polluted: yes }
constructor: { prototype: { polluted: yes } }
paths:
  /__proto__:
    __proto__: { polluted: yes }
    get:
      parameters:
        - { name: __proto__, in: query, schema: { type: string } }
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  __proto__: { type: string }
                  constructor: { type: string }
                  bad: { $ref: '#/__proto__' }
                  worse: { $ref: '#/constructor/prototype' }
`;
    const jsonText = '{"openapi":"3.0.3","info":{"title":"P","version":"1"},"__proto__":{"polluted":true},"paths":{"/a":{"__proto__":{"polluted":true},"get":{"responses":{"200":{"description":"ok"}}}}}}';
    for (const text of [yamlText, jsonText]) {
      const parsed = parseDocument(text) as Record<string, unknown>;
      expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
      // written as raw JSON: in an object literal, __proto__ would set the prototype instead of a key
      const tools = '{"tools":[{"name":"x","__proto__":{"polluted":true},"inputSchema":{"properties":{"__proto__":{"type":"string"}}}}]}';
      const report = analyze({ spec: text, previousSpec: text, tools });
      expect(report.errors).toEqual([]);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
  });
});

describe('parseApi: OpenAPI 3.0 YAML', () => {
  const api = parseApi(ORDERS_SPEC);

  it('reads info, servers, schemes and global security', () => {
    expect(api).toMatchObject({ title: 'Orders API', version: '1.4.0', openapi: '3.0.3', hasContact: false, description: undefined, webhooks: 0 });
    expect(api.servers).toEqual(['https://api.orders.example', 'http://staging-api.orders.example']);
    expect(api.schemes).toEqual([{ name: 'bearerAuth', type: 'http', scheme: 'bearer', in: undefined, bearerFormat: 'JWT', flows: undefined }]);
    expect(api.globalSecurity).toEqual([{ bearerAuth: [] }]);
    expect(api.operations).toHaveLength(15);
  });

  it('builds operation keys, params and effective security', () => {
    const getOrder = op(api, 'GET /v1/orders/{orderId}');
    expect(getOrder).toMatchObject({ method: 'get', path: '/v1/orders/{orderId}', operationId: 'getOrder', summary: 'Read one order', deprecated: false });
    expect(getOrder.params).toEqual([{ name: 'orderId', in: 'path', required: true, type: 'integer', format: 'int64', maximum: undefined, description: undefined }]);
    expect(getOrder.security).toEqual([{ bearerAuth: [] }]); // inherited from the root
    expect(op(api, 'POST /v1/auth/login').security).toEqual([]); // explicitly public
    expect(getOrder.responseCodes).toEqual(['200', '500']);
    expect(paths(getOrder.errorFields)).toEqual(['message', 'stack', 'sql']);
  });

  it('flattens request and response bodies through $ref', () => {
    expect(paths(op(api, 'GET /v1/customers/{customerId}').responseFields)).toEqual(['id', 'email', 'name', 'password_hash', 'ssn']);
    const patch = op(api, 'PATCH /v1/customers/{customerId}');
    expect(paths(patch.requestFields)).toEqual(['name', 'role', 'credit_limit']);
    expect(patch.requestAdditionalProps).toBe(true);
    const login = op(api, 'POST /v1/auth/login');
    expect(login.requestFields.find((f) => f.name === 'password')?.writeOnly).toBe(true);
  });

  it('detects list responses, plain and enveloped', () => {
    expect(op(api, 'GET /v1/orders').responseIsArray).toBe(true);
    expect(op(api, 'GET /v1/customers').responseIsArray).toBe(true); // { data: [...] }
    expect(op(api, 'GET /v1/orders/{orderId}').responseIsArray).toBe(false);
  });

  it('reads uploads, callbacks and deprecation', () => {
    expect(op(api, 'POST /v1/orders/{orderId}/attachments').requestHasBinary).toBe(true);
    expect(op(api, 'POST /v1/webhooks').callbacks).toBe(true);
    expect(op(api, 'GET /v1/orders/{orderId}/status').deprecated).toBe(true);
  });

  it('reads the same model from the JSON form of the document', () => {
    const asJson = JSON.stringify(yaml.load(ORDERS_SPEC), null, 2);
    expect(parseApi(asJson)).toEqual(api);
  });
});

describe('parseApi: OpenAPI 3.1', () => {
  it('reads a JSON 3.1 document with oauth2 flows', () => {
    const api = parseApi(PAYMENTS_SPEC);
    expect(api.openapi).toBe('3.1.0');
    expect(api.hasContact).toBe(true);
    const byName = Object.fromEntries(api.schemes.map((s) => [s.name, s]));
    expect(byName.partnerQueryKey).toMatchObject({ type: 'apiKey', in: 'query' });
    expect(byName.partnerHeaderKey).toMatchObject({ type: 'apiKey', in: 'header' });
    expect(byName.basicAuth).toMatchObject({ type: 'http', scheme: 'basic' });
    expect(Object.keys(byName.oauth.flows ?? {})).toEqual(['implicit', 'password']);
    expect(byName.oauth.flows?.implicit.scopes).toEqual({ 'payments:read': 'Read payments', 'payments:all': 'Everything' });
  });

  it('joins type arrays and keeps readOnly, maxLength and maximum', () => {
    const api = parseApi(CLEAN_SPEC);
    const list = op(api, 'GET /orders');
    expect(list.responseFields.find((f) => f.path === 'next')?.type).toBe('string|null');
    expect(list.responseFields.find((f) => f.path === 'data[].id')).toMatchObject({ readOnly: true, format: 'uuid' });
    expect(list.params.find((p) => p.name === 'limit')?.maximum).toBe(100);
    const place = op(api, 'POST /orders');
    expect(place.requestAdditionalProps).toBe(false);
    expect(place.requestFields.find((f) => f.name === 'sku')?.maxLength).toBe(32);
    expect(place.hasExamples).toBe(true);
    expect(place.params[0]).toMatchObject({ name: 'Idempotency-Key', in: 'header', required: true });
  });

  it('counts webhooks', () => {
    const api = parseApi(JSON.stringify({ openapi: '3.1.0', info: { title: 'W', version: '1' }, paths: {}, webhooks: { orderShipped: {}, orderPaid: {} } }));
    expect(api.webhooks).toBe(2);
    expect(api.operations).toEqual([]);
  });
});

describe('parseApi: Swagger 2.0', () => {
  const api = parseApi(WAREHOUSE_SWAGGER);

  it('builds servers from host, basePath and schemes', () => {
    expect(api.openapi).toBe('2.0');
    expect(api.servers).toEqual(['https://api.warehouse.example/v1']);
    const multi = WAREHOUSE_SWAGGER.replace('schemes: [https]', 'schemes: [http, https]');
    expect(parseApi(multi).servers).toEqual(['http://api.warehouse.example/v1', 'https://api.warehouse.example/v1']);
    expect(parseApi(WAREHOUSE_SWAGGER.replace('schemes: [https]\n', '')).servers).toEqual(['https://api.warehouse.example/v1']);
    expect(parseApi(WAREHOUSE_SWAGGER.replace('host: api.warehouse.example\n', '')).servers).toEqual([]);
  });

  it('maps securityDefinitions, including basic and a single oauth2 flow', () => {
    const byName = Object.fromEntries(api.schemes.map((s) => [s.name, s]));
    expect(byName.basicAuth).toMatchObject({ type: 'http', scheme: 'basic' });
    expect(byName.partnerKey).toMatchObject({ type: 'apiKey', in: 'header' });
    expect(byName.oauth.type).toBe('oauth2');
    expect(byName.oauth.flows).toEqual({
      authorizationCode: {
        scopes: { 'stock:read': 'Read stock', 'stock:write': 'Change stock' },
        authorizationUrl: 'https://auth.warehouse.example/authorize',
        tokenUrl: 'https://auth.warehouse.example/token',
      },
    });
    expect(api.globalSecurity).toEqual([{ oauth: ['stock:read'] }]);
  });

  it('reads body parameters and v2 response schemas', () => {
    const replace = op(api, 'PUT /items/{itemId}');
    expect(paths(replace.requestFields)).toEqual(['id', 'name', 'quantity']);
    expect(replace.requestFields[0].readOnly).toBe(true);
    expect(replace.requestAdditionalProps).toBe(false);
    expect(replace.security).toEqual([{ oauth: ['stock:write'] }]);
    expect(paths(op(api, 'GET /items/{itemId}').responseFields)).toEqual(['id', 'name', 'quantity']);
  });

  it('reads formData parameters, with a file as binary', () => {
    const upload = op(api, 'POST /items/{itemId}/photo');
    expect(upload.requestHasBinary).toBe(true);
    expect(upload.requestFields.map((f) => [f.name, f.format])).toEqual([['photo', 'binary'], ['caption', undefined]]);
    expect(upload.params.map((p) => p.name)).toEqual(['itemId']); // formData is body, not params
  });

  it('applies path-level parameters to every operation on the path', () => {
    for (const key of ['GET /items/{itemId}', 'PUT /items/{itemId}']) {
      expect(op(api, key).params).toEqual([{ name: 'itemId', in: 'path', required: true, type: 'string', format: undefined, maximum: undefined, description: 'The stock item' }]);
    }
  });
});

describe('parseApi: parameters', () => {
  it('lets an operation-level parameter override the path-level one', () => {
    const api = parseApi(doc({
      '/orders/{orderId}': {
        parameters: [
          { name: 'orderId', in: 'path', required: true, description: 'path level', schema: { type: 'string' } },
          { name: 'expand', in: 'query', description: 'shared', schema: { type: 'string' } },
        ],
        get: {
          parameters: [{ name: 'orderId', in: 'path', required: true, description: 'operation level', schema: { type: 'integer' } }],
          responses: { '200': { description: 'ok' } },
        },
        delete: { responses: { '204': { description: 'gone' } } },
      },
    }));
    const get = op(api, 'GET /orders/{orderId}');
    expect(get.params.map((p) => [p.name, p.description, p.type])).toEqual([['orderId', 'operation level', 'integer'], ['expand', 'shared', 'string']]);
    expect(op(api, 'DELETE /orders/{orderId}').params.map((p) => p.description)).toEqual(['path level', 'shared']);
  });

  it('treats every path parameter as required and skips unknown locations', () => {
    const api = parseApi(doc({
      '/a/{id}': { get: { parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }, { name: 'x', in: 'nowhere' }, 'not a parameter', null], responses: {} } },
    }));
    expect(op(api, 'GET /a/{id}').params).toEqual([expect.objectContaining({ name: 'id', required: true })]);
  });
});

describe('parseApi: $ref resolution', () => {
  it('resolves parameters, request bodies, responses, path items and escaped pointers', () => {
    const api = parseApi(doc({
      '/orders/{orderId}': { $ref: '#/components/pathItems/OrderItem' },
      '/lines': {
        post: {
          requestBody: { $ref: '#/components/requestBodies/NewLine' },
          responses: { '201': { $ref: '#/components/responses/Line' }, '400': { $ref: '#/components/responses/Problem' } },
        },
      },
    }, {
      pathItems: { OrderItem: { get: { parameters: [{ $ref: '#/components/parameters/OrderId' }], responses: { '200': { description: 'ok' } } } } },
      parameters: { OrderId: { name: 'orderId', in: 'path', required: true, schema: { $ref: '#/components/schemas/Id' } } },
      requestBodies: { NewLine: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order~1Line' } } } } },
      responses: {
        Line: { description: 'created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Order~1Line' } } } },
        Problem: { description: 'bad', content: { 'application/problem+json': { schema: { properties: { detail: { type: 'string' } } } } } },
      },
      schemas: {
        Id: { type: 'string', format: 'uuid' },
        'Order/Line': { type: 'object', additionalProperties: false, properties: { sku: { type: 'string' }, qty: { type: 'integer', maximum: 9 } } },
      },
    }));
    expect(op(api, 'GET /orders/{orderId}').params[0]).toMatchObject({ name: 'orderId', type: 'string', format: 'uuid' });
    const post = op(api, 'POST /lines');
    expect(paths(post.requestFields)).toEqual(['sku', 'qty']);
    expect(post.requestFields[1].maximum).toBe(9);
    expect(post.requestAdditionalProps).toBe(false);
    expect(paths(post.responseFields)).toEqual(['sku', 'qty']);
    expect(paths(post.errorFields)).toEqual(['detail']);
  });

  it('leaves external and dangling refs empty instead of failing', () => {
    const api = parseApi(doc({
      '/x': { get: { responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: 'other.yaml#/Thing' } } } }, '404': { $ref: '#/components/responses/Missing' } } } },
    }));
    expect(op(api, 'GET /x').responseFields).toEqual([]);
    expect(op(api, 'GET /x').errorFields).toEqual([]);
  });

  it('does not hang on circular schemas, and stops at the repeated field', () => {
    // a tree node that points back to itself through several properties and an array
    const node = { type: 'object', properties: { name: { type: 'string' }, parent: { $ref: '#/components/schemas/Node' }, left: { $ref: '#/components/schemas/Node' }, right: { $ref: '#/components/schemas/Node' }, next: { $ref: '#/components/schemas/Node' }, children: { type: 'array', items: { $ref: '#/components/schemas/Node' } } } };
    const text = doc({
      '/nodes': {
        post: {
          requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } },
          responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } } },
        },
      },
      '/pairs': { get: { responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/A' } } } } } } },
      '/loop': { get: { responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Loop1' } } } } } } },
      '/self': { $ref: '#/paths/~1self' },
    }, {
      schemas: {
        Node: node,
        A: { type: 'object', properties: { b1: { $ref: '#/components/schemas/B' }, b2: { $ref: '#/components/schemas/B' }, b3: { $ref: '#/components/schemas/B' } } },
        B: { type: 'object', properties: { a1: { $ref: '#/components/schemas/A' }, a2: { $ref: '#/components/schemas/A' }, a3: { $ref: '#/components/schemas/A' }, label: { type: 'string' } } },
        Loop1: { $ref: '#/components/schemas/Loop2' },
        Loop2: { $ref: '#/components/schemas/Loop1' },
      },
    });
    const started = Date.now();
    const api = parseApi(text);
    const report = analyze({ spec: text, previousSpec: text });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(report.errors).toEqual([]);
    expect(paths(op(api, 'POST /nodes').responseFields)).toEqual(['name', 'parent', 'left', 'right', 'next', 'children']);
    expect(paths(op(api, 'GET /pairs').responseFields)).toEqual([
      'b1', 'b1.a1', 'b1.a2', 'b1.a3', 'b1.label', 'b2', 'b2.a1', 'b2.a2', 'b2.a3', 'b2.label', 'b3', 'b3.a1', 'b3.a2', 'b3.a3', 'b3.label',
    ]);
    expect(op(api, 'GET /loop').responseFields).toEqual([]);
    expect(api.operations.some((o) => o.path === '/self')).toBe(false);
  });

  it('bounds shared sub-schemas that fan out through YAML aliases', () => {
    let text = 'openapi: 3.0.3\ninfo: { title: Fan-out fixture, version: 1.0.0 }\nx-shapes:\n  l0: &l0 { type: object, properties: { a: { type: string } } }\n';
    for (let i = 1; i <= 10; i++) text += `  l${i}: &l${i} { type: object, properties: { a: *l${i - 1}, b: *l${i - 1}, c: *l${i - 1}, d: *l${i - 1} } }\n`;
    text += 'paths:\n  /shapes:\n    get:\n      responses:\n        "200":\n          description: ok\n          content:\n            application/json:\n              schema: *l10\n';
    const started = Date.now();
    const report = analyze({ spec: text });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(report.errors).toEqual([]);
    expect(report.api!.operations[0].responseFields.length).toBeLessThan(10_000);
  });
});

describe('parseApi: composition', () => {
  it('flattens allOf, oneOf and anyOf', () => {
    const api = parseApi(doc({
      '/payments': {
        post: {
          requestBody: { content: { 'application/json': { schema: { oneOf: [{ $ref: '#/components/schemas/Card' }, { $ref: '#/components/schemas/Bank' }] } } } },
          responses: { '200': { description: 'ok', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/Base' }, { properties: { status: { type: 'string' } } }] } } } } },
        },
      },
      '/refunds': { get: { responses: { '200': { description: 'ok', content: { 'application/json': { schema: { anyOf: [{ properties: { a: { type: 'string' } } }, { properties: { b: { type: 'string' } } }] } } } } } } },
    }, {
      schemas: {
        Base: { type: 'object', properties: { id: { type: 'string' }, createdAt: { type: 'string' } } },
        Card: { type: 'object', properties: { card: { type: 'object', properties: { last4: { type: 'string' } } } } },
        Bank: { type: 'object', properties: { iban: { type: 'string' } } },
      },
    }));
    expect(paths(op(api, 'POST /payments').responseFields)).toEqual(['id', 'createdAt', 'status']);
    expect(paths(op(api, 'POST /payments').requestFields)).toEqual(['card', 'card.last4', 'iban']);
    expect(paths(op(api, 'GET /refunds').responseFields)).toEqual(['a', 'b']);
  });
});

describe('buildApiModel errors', () => {
  it.each([
    ['an array', [1, 2], /not an object/],
    ['a string', 'openapi', /not an object/],
    ['null', null, /not an object/],
    ['no openapi or swagger field', { info: {}, paths: {} }, /No "openapi" or "swagger" field/],
    ['no paths', { openapi: '3.0.0', info: {} }, /no "paths"/],
    ['paths that are not an object', { openapi: '3.0.0', paths: 'nope' }, /no "paths"/],
  ])('rejects %s with a readable message', (_label, value, re) => {
    expect(() => buildApiModel(value)).toThrow(re);
  });

  it('reports the same messages through parseApi and analyze', () => {
    expect(() => parseApi('info:\n  title: x\npaths: {}')).toThrow(/No "openapi" or "swagger"/);
    expect(analyze({ spec: 'openapi: 3.0.0\ninfo: { title: x }' }).errors).toEqual([{ input: 'spec', message: 'The spec has no "paths".' }]);
    expect(analyze({ spec: 'just a sentence' }).errors[0].message).toMatch(/not an object/);
  });
});

describe('parseTools', () => {
  it('reads an MCP tools/list result', () => {
    const tools = parseTools(TOOLS_MCP);
    expect(tools).toHaveLength(14);
    const get = tools[0];
    expect(get).toMatchObject({ name: 'get_order', source: 'mcp', schemaOpen: false, required: ['orderId'], annotations: { readOnlyHint: true } });
    expect(get.params).toEqual([{ name: 'orderId', type: 'string', description: 'The order id.', default: undefined }]);
    expect(get.scanText).toContain('The order id.');
    expect(tools.find((t) => t.name === 'delete_order')?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, idempotentHint: undefined, openWorldHint: undefined });
    expect(tools.find((t) => t.name === 'lookup_status')?.schemaOpen).toBe(true);
  });

  it('reads a full JSON-RPC response', () => {
    const tools = parseTools(TOOLS_JSONRPC);
    expect(tools.map((t) => [t.name, t.source])).toEqual([['track_parcel', 'mcp']]);
  });

  it('reads OpenAI tools, nested and flat', () => {
    expect(parseTools(TOOLS_OPENAI)).toEqual([expect.objectContaining({ name: 'refund_payment', source: 'openai', required: ['payment_id'], schemaOpen: false })]);
    const flat = parseTools(JSON.stringify([{ name: 'get_weather', description: 'Weather for a city.', parameters: { type: 'object', properties: { city: { type: 'string' } } } }]));
    expect(flat[0]).toMatchObject({ source: 'openai', schemaOpen: true });
    const functions = parseTools(JSON.stringify({ functions: [{ name: 'f', description: 'A legacy function list entry.' }] }));
    expect(functions[0]).toMatchObject({ name: 'f', source: 'plain' });
  });

  it('reads Anthropic tools (input_schema)', () => {
    expect(parseTools(TOOLS_ANTHROPIC)).toEqual([expect.objectContaining({ name: 'search_orders', source: 'anthropic', params: [expect.objectContaining({ name: 'words' })] })]);
  });

  it('reads a plain array and a single tool object', () => {
    expect(parseTools('[{"name":"ping","description":"Check the server answers."}]')[0]).toMatchObject({ name: 'ping', source: 'plain', params: [], schemaOpen: false });
    expect(parseTools('{"name":"ping","description":"Check the server answers."}')).toHaveLength(1);
    expect(parseTools('- name: ping\n  description: YAML works too.')[0].name).toBe('ping');
  });

  it('collects every human-readable string for the text scans', () => {
    const [t] = parseTools(JSON.stringify([{
      name: 'pick', title: 'Pick a colour', description: 'Choose one.',
      inputSchema: { type: 'object', properties: { colour: { type: 'string', description: 'The colour', enum: ['red', 'teal'], default: 'teal', examples: ['red'] } } },
    }]));
    for (const s of ['Pick a colour', 'Choose one.', 'The colour', 'red', 'teal']) expect(t.scanText).toContain(s);
  });

  it('ignores annotation hints that are not booleans', () => {
    const [t] = parseTools(JSON.stringify({ tools: [{ name: 'x', inputSchema: {}, annotations: { readOnlyHint: 'true', destructiveHint: 1 } }] }));
    expect(t.annotations).toEqual({ readOnlyHint: undefined, destructiveHint: undefined, idempotentHint: undefined, openWorldHint: undefined });
  });

  it.each([
    ['an object without tools', '{"servers": []}', /No tools found/],
    ['an empty list', '{"tools": []}', /no tool with a name/],
    ['tools without names', '{"tools": [{"description": "nameless"}, 5, null]}', /no tool with a name/],
    ['invalid JSON', '{"tools": [', /looks like JSON but does not parse/],
    ['empty input', '', /empty/],
    ['more than 500 tools', JSON.stringify({ tools: Array.from({ length: 501 }, (_, i) => ({ name: `t${i}` })) }), /More than 500/],
  ])('rejects %s', (_label, text, re) => {
    expect(() => parseTools(text)).toThrow(re);
    if (text) expect(analyze({ tools: text }).errors).toEqual([{ input: 'tools', message: expect.stringMatching(re) }]);
  });
});
