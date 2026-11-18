# Patchlane rules

100 checks, generated from the engine by `scripts/rules-doc.ts`. Severity is the highest the rule can raise; most rules scale with context (a public write is worse than a public read). Browse them with search at [patchlane.pages.dev/rules](https://patchlane.pages.dev/rules/).

## Authorization and data (14)

| Rule | Up to | What it finds | Standard | Fix code |
|---|---|---|---|---|
| `API1-OWNERSHIP` | critical | The caller picks which object to act on | API1:2023 Broken Object Level Authorization | Check ownership on the server |
| `API3-MASS-ASSIGNMENT` | high | The request accepts fields a user should not set | API3:2023 Broken Object Property Level Authorization | Accept only allow-listed input fields |
| `API3-OPEN-BODY` | low | The request body accepts unknown properties | API3:2023 Broken Object Property Level Authorization | Accept only allow-listed input fields |
| `API3-SENSITIVE-OUT` | high | The response carries secrets or regulated data | API3:2023 Broken Object Property Level Authorization | Return only allow-listed fields |
| `API4-NO-429` | medium | No operation documents a rate limit | API4:2023 Unrestricted Resource Consumption | Rate limit per user and per IP |
| `API4-NO-MAX` | medium | The page size has no maximum | API4:2023 Unrestricted Resource Consumption | Cap the page size and paginate with a cursor |
| `API4-NO-PAGING` | medium | A list endpoint has no page size parameter | API4:2023 Unrestricted Resource Consumption | Cap the page size and paginate with a cursor |
| `API4-UPLOAD` | low | An upload has no documented size or type limit | API4:2023 Unrestricted Resource Consumption | Limit upload size and file types |
| `API5-ADMIN-PATH` | high | An administrative function is in the same API | API5:2023 Broken Function Level Authorization | Require the right scope or role on each route |
| `API6-BUSINESS-FLOW` | high | A sensitive business flow has no documented limit | API6:2023 Unrestricted Access to Sensitive Business Flows | Require an Idempotency-Key on money-moving calls |
| `API7-URL-INPUT` | medium | The caller supplies a URL | API7:2023 Server Side Request Forgery | Guard server-side fetches of user-supplied URLs |
| `API8-ERROR-DETAIL` | medium | Error responses carry internal detail | API8:2023 Security Misconfiguration | Return generic errors with a correlation id |
| `API8-PLAIN-HTTP` | high | A server is listed on plain HTTP | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `API10-CALLBACK` | low | The API calls back to URLs it is given | API10:2023 Unsafe Consumption of APIs | — |

## Authentication (9)

| Rule | Up to | What it finds | Standard | Fix code |
|---|---|---|---|---|
| `API2-BASIC` | medium | HTTP Basic authentication sends the password on every call | API2:2023 Broken Authentication | — |
| `API2-BROAD-SCOPE` | medium | A scope grants everything at once | API5:2023 Broken Function Level Authorization | Require the right scope or role on each route |
| `API2-IMPLICIT-FLOW` | high | The OAuth implicit flow is allowed | API2:2023 Broken Authentication | — |
| `API2-KEY-IN-QUERY` | high | An API key travels in the query string | API2:2023 Broken Authentication | Require authentication by default |
| `API2-LOGIN-RATE` | high | A sign-in or token endpoint shows no rate limit | API2:2023 Broken Authentication | Rate limit per user and per IP |
| `API2-NO-SCHEME` | high | The spec defines no authentication scheme | API2:2023 Broken Authentication | Require authentication by default |
| `API2-PASSWORD-FLOW` | medium | The OAuth password grant is allowed | API2:2023 Broken Authentication | — |
| `API2-PUBLIC-OP` | critical | A write operation needs no authentication | API2:2023 Broken Authentication | Require authentication by default |
| `API2-STATIC-KEY` | low | A static API key identifies the caller | API2:2023 Broken Authentication | Require authentication by default |

## Inventory (4)

| Rule | Up to | What it finds | Standard | Fix code |
|---|---|---|---|---|
| `API9-DEPRECATED-LIVE` | low | A deprecated operation is still published | API9:2023 Improper Inventory Management | — |
| `API9-NONPROD-SERVER` | medium | A non-production server is in the public spec | API9:2023 Improper Inventory Management | — |
| `API9-OLD-VERSION` | medium | An older API version is still reachable | API9:2023 Improper Inventory Management | — |
| `DOC-NO-OWNER` | info | The spec names no owner | API9:2023 Improper Inventory Management | — |

## Documentation (4)

| Rule | Up to | What it finds | Standard | Fix code |
|---|---|---|---|---|
| `DOC-NO-ERRORS` | low | Many operations document no error response | API9:2023 Improper Inventory Management | — |
| `DOC-NO-OVERVIEW` | info | The spec has no overview | API9:2023 Improper Inventory Management | — |
| `DOC-UNDESCRIBED` | low | Many operations have no summary or description | API9:2023 Improper Inventory Management | — |
| `SL-409-DISCLOSES` | info | 409 Conflict tells a caller the record exists | — | — |

## Server configuration (19)

| Rule | Up to | What it finds | Standard | Fix code |
|---|---|---|---|---|
| `COOKIE-FLAGS` | high | A cookie is missing Secure, HttpOnly or SameSite | API8:2023 Security Misconfiguration | Set Secure, HttpOnly and SameSite on session cookies |
| `COOKIE-SAMESITE-NONE` | medium | A cookie uses SameSite=None without Secure | API8:2023 Security Misconfiguration | Set Secure, HttpOnly and SameSite on session cookies |
| `CORS-METHODS` | low | CORS allows more methods than needed | API8:2023 Security Misconfiguration | Allow CORS only from a fixed list of origins |
| `CORS-NO-VARY` | low | An origin-specific CORS answer has no Vary: Origin | API8:2023 Security Misconfiguration | Allow CORS only from a fixed list of origins |
| `CORS-NULL` | high | CORS allows the "null" origin | API8:2023 Security Misconfiguration | Allow CORS only from a fixed list of origins |
| `CORS-REFLECTED` | critical | CORS echoes back an origin it should not trust | API8:2023 Security Misconfiguration | Allow CORS only from a fixed list of origins |
| `CORS-WILDCARD` | low | CORS allows every origin | API8:2023 Security Misconfiguration | Allow CORS only from a fixed list of origins |
| `CORS-WILDCARD-CREDS` | high | CORS allows any origin together with credentials | API8:2023 Security Misconfiguration | Allow CORS only from a fixed list of origins |
| `ERR-STACK` | high | The response body shows a stack trace, SQL error or file path | API8:2023 Security Misconfiguration | Return generic errors with a correlation id |
| `HDR-CACHEABLE` | medium | A signed-in response may be cached | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `HDR-NO-CSP` | medium | An HTML page has no Content-Security-Policy | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `HDR-NO-FRAME` | low | The page can be framed by any site | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `HDR-NO-HSTS` | medium | No Strict-Transport-Security header | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `HDR-NO-NOSNIFF` | low | No X-Content-Type-Options: nosniff | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `HDR-NO-RATELIMIT` | info | No rate-limit headers in the response | API4:2023 Unrestricted Resource Consumption | Rate limit per user and per IP |
| `HDR-SHORT-HSTS` | low | HSTS max-age is under six months | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `HDR-VERSION-LEAK` | low | A header names the server software or its version | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `HDR-WEAK-CSP` | low | The CSP allows 'unsafe-inline' or 'unsafe-eval' scripts | API8:2023 Security Misconfiguration | Send security headers and refuse plain HTTP |
| `SL-STATUS-DISCLOSURE` | info | A 401 or 403 tells the caller the resource exists | — | — |

## Tokens (11)

| Rule | Up to | What it finds | Standard | Fix code |
|---|---|---|---|---|
| `JWT-BROAD-SCOPE` | medium | The token carries an all-powerful scope | API5:2023 Broken Function Level Authorization | Require the right scope or role on each route |
| `JWT-EXPIRED` | info | The token has expired | API2:2023 Broken Authentication | — |
| `JWT-KEY-IN-HEADER` | high | The token header points to its own key | API2:2023 Broken Authentication | Verify JWTs with a pinned algorithm, issuer and audience |
| `JWT-LONG-LIFE` | medium | The token lives longer than a day | API2:2023 Broken Authentication | Verify JWTs with a pinned algorithm, issuer and audience |
| `JWT-NO-AUD` | medium | No audience claim | API2:2023 Broken Authentication | Verify JWTs with a pinned algorithm, issuer and audience |
| `JWT-NO-EXP` | high | The token never expires | API2:2023 Broken Authentication | Verify JWTs with a pinned algorithm, issuer and audience |
| `JWT-NO-ISS` | low | No issuer claim | API2:2023 Broken Authentication | Verify JWTs with a pinned algorithm, issuer and audience |
| `JWT-NO-SIGNATURE` | critical | The token is not signed | API2:2023 Broken Authentication | Verify JWTs with a pinned algorithm, issuer and audience |
| `JWT-ODD-KID` | medium | The key id contains path or query characters | API2:2023 Broken Authentication | Verify JWTs with a pinned algorithm, issuer and audience |
| `JWT-SENSITIVE-CLAIMS` | high | Personal or secret data is stored in the claims | API3:2023 Broken Object Property Level Authorization | Verify JWTs with a pinned algorithm, issuer and audience |
| `JWT-SHARED-SECRET` | low | The token is signed with a shared secret | API2:2023 Broken Authentication | Verify JWTs with a pinned algorithm, issuer and audience |

## Release (10)

| Rule | Up to | What it finds | Standard | Fix code |
|---|---|---|---|---|
| `REL-AUTH-REMOVED` | critical | An operation lost its authentication | API2:2023 Broken Authentication | Require authentication by default |
| `REL-BODY-OPENED` | low | The request body accepts unknown properties again | API3:2023 Broken Object Property Level Authorization | Accept only allow-listed input fields |
| `REL-FIELD-REMOVED` | low | Response fields were removed | API9:2023 Improper Inventory Management | — |
| `REL-LIMIT-REMOVED` | medium | An operation no longer documents its rate limit | API4:2023 Unrestricted Resource Consumption | Rate limit per user and per IP |
| `REL-NEW-PUBLIC` | high | A new operation needs no authentication | API2:2023 Broken Authentication | Require authentication by default |
| `REL-NEW-REQUIRED` | low | A new required parameter breaks existing clients | API9:2023 Improper Inventory Management | — |
| `REL-NEW-SENSITIVE` | high | The response now includes sensitive fields | API3:2023 Broken Object Property Level Authorization | Return only allow-listed fields |
| `REL-REMOVED` | medium | An operation was removed | API9:2023 Improper Inventory Management | — |
| `REL-SCOPE-REDUCED` | high | An operation now needs fewer scopes | API5:2023 Broken Function Level Authorization | Require the right scope or role on each route |
| `REL-SEMVER` | medium | The release needs a bigger version bump | API9:2023 Improper Inventory Management | — |

## AI agents (29)

| Rule | Up to | What it finds | Standard | Fix code |
|---|---|---|---|---|
| `AGENT-APPROVAL` | high | No confirmation before high-impact actions | OWASP LLM: Excessive agency | Hold agent actions for human approval |
| `AGENT-EGRESS` | high | Outbound hosts are not restricted | OWASP LLM: Improper output handling | Guard server-side fetches of user-supplied URLs |
| `AGENT-IDENTITY` | high | The agent uses a shared key, not the user's token | API1:2023 Broken Object Level Authorization | — |
| `AGENT-LIMITS` | medium | No per-user limits on agent use | API4:2023 Unrestricted Resource Consumption | Rate limit per user and per IP |
| `AGENT-LOG` | medium | Tool calls are not fully logged | — | — |
| `AGENT-PINNED` | medium | Tool versions are not pinned or reviewed | OWASP LLM: Supply chain | — |
| `AGENT-SCOPES` | medium | The agent's token is broader than its tools | API5:2023 Broken Function Level Authorization | Require the right scope or role on each route |
| `AGENT-UNTRUSTED` | high | Outside content is not kept apart from instructions | OWASP LLM: Prompt injection | — |
| `LLM-CLIENT-INSTRUCTIONS` | high | The caller can set the model's instructions | OWASP LLM: Prompt injection | Limit and redact what reaches the model |
| `LLM-COST-LIMIT` | high | An AI endpoint shows no rate or spend limit | API4:2023 Unrestricted Resource Consumption | Rate limit per user and per IP |
| `LLM-INPUT-LIMIT` | medium | The prompt has no length limit | API4:2023 Unrestricted Resource Consumption | Limit and redact what reaches the model |
| `LLM-MODEL-CHOICE` | medium | The caller picks the model or the output size | API4:2023 Unrestricted Resource Consumption | Limit and redact what reaches the model |
| `LLM-PII-IN` | medium | Personal data is sent to the model | OWASP LLM: Sensitive information disclosure | Limit and redact what reaches the model |
| `LLM-RAW-OUTPUT` | medium | Model output is returned ready to render | OWASP LLM: Improper output handling | Treat model output as untrusted when rendering it |
| `SPEC-HIDDEN-TEXT` | high | The spec text contains invisible characters | OWASP LLM: Prompt injection | — |
| `SPEC-INSTRUCTION-TEXT` | medium | A description addresses an AI model | OWASP LLM: Prompt injection | — |
| `TOOL-FREEFORM-EXEC` | critical | A parameter takes a command, script or query | OWASP LLM: Excessive agency | — |
| `TOOL-HIDDEN-CHARS` | critical | The definition contains invisible characters | OWASP LLM: Prompt injection | — |
| `TOOL-ID-PARAM` | high | The model chooses whose data to act on | API1:2023 Broken Object Level Authorization | Check ownership on the server |
| `TOOL-INSTRUCTION-TEXT` | high | The description talks to the model, not about the tool | OWASP LLM: Prompt injection<br>OWASP LLM: Supply chain | — |
| `TOOL-LONG-DESC` | low | The description is too long to review | OWASP LLM: Prompt injection | — |
| `TOOL-LOOKALIKE` | high | A tool name uses non-ASCII letters | OWASP LLM: Supply chain | — |
| `TOOL-NEEDS-APPROVAL` | high | A tool moves money, deletes data or changes access | OWASP LLM: Excessive agency | Hold agent actions for human approval |
| `TOOL-NO-ANNOTATIONS` | low | A tool that changes data declares no hints | OWASP LLM: Excessive agency | Hold agent actions for human approval |
| `TOOL-PATH-PARAM` | medium | The model chooses a file path | API8:2023 Security Misconfiguration | Keep file paths inside a fixed directory |
| `TOOL-SCHEMA-OPEN` | low | The input schema accepts extra properties | API3:2023 Broken Object Property Level Authorization | Accept only allow-listed input fields |
| `TOOL-SECRET-PARAM` | high | A credential passes through the model | OWASP LLM: Sensitive information disclosure | — |
| `TOOL-UNDESCRIBED` | low | The tool or its inputs are barely described | — | — |
| `TOOL-URL-PARAM` | medium | The model chooses a URL the server fetches | API7:2023 Server Side Request Forgery | Guard server-side fetches of user-supplied URLs |
