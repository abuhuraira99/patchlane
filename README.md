<div align="center">

<a href="https://patchlane.pages.dev"><img src="public/share.jpg" alt="Patchlane: security check-up for APIs and AI agent tools" width="100%"></a>

# Patchlane

**A security check-up for APIs and the AI agents that call them.**<br>
Paste an OpenAPI spec, a server response, a JWT or an MCP tool list. Patchlane ranks what is risky and writes the fix in your framework, all inside your browser.

[![CI](https://github.com/abuhuraira99/patchlane/actions/workflows/ci.yml/badge.svg)](https://github.com/abuhuraira99/patchlane/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/live-patchlane.pages.dev-a08672?labelColor=111111)](https://patchlane.pages.dev)
[![Checks](https://img.shields.io/badge/checks-100-a08672?labelColor=111111)](docs/RULES.md)
[![Tests](https://img.shields.io/badge/tests-472%20passing-a08672?labelColor=111111)](tests)
[![OWASP API Top 10](https://img.shields.io/badge/OWASP%20API%20Top%2010-2023-a08672?labelColor=111111)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
[![License: MIT](https://img.shields.io/badge/license-MIT-a08672?labelColor=111111)](LICENSE)

[**Open the check-up**](https://patchlane.pages.dev/app/) · [Sample report](https://patchlane.pages.dev/app/?sample=1) · [Every rule](https://patchlane.pages.dev/rules/) · [GitHub Action](#github-action) · [CLI](#cli)

</div>

---

## Why Patchlane exists

Most API breaches are not clever. An endpoint returns another customer's record because nobody checked who owns it. A `PATCH` accepts `role: "admin"`. A token never expires. A staging server is listed in the public spec. And now AI agents call those same APIs through tool definitions that a model reads and obeys, so one sentence hidden in a tool description can steer real actions.

Small teams rarely have a security engineer to catch these before release. Patchlane reads the artefacts you already have, finds the problems, explains why each one matters, and hands you **the fix in your own framework** plus **a test that proves it is fixed**. It never sends a request to your API, and nothing you paste leaves your browser.

It is built for three kinds of people:

- **Product teams without a security hire** who want to know what is risky before a customer or an auditor asks.
- **Freelancers and agencies** who hand an API over to a client and want a clean report to go with it.
- **Security reviewers** who want a fast, explainable first pass before the manual review.

## What it checks

| Desk | You paste | Patchlane looks for | Rules |
|---|---|---|---|
| **Spec** | OpenAPI 3.0 / 3.1 or Swagger 2.0, JSON or YAML | Object ownership (BOLA), unauthenticated writes, secrets and regulated fields in responses, mass assignment, missing paging limits, admin functions in the public API, sensitive business flows without limits or idempotency, URLs the server fetches (SSRF), error detail, auth schemes (API keys in query strings, implicit and password grants, broad scopes), old versions still live, non-production servers, documentation gaps | 31 |
| **Server** | A raw HTTP response (`curl -i`) | CORS that reflects origins or allows `null`, cookies without `Secure`/`HttpOnly`/`SameSite`, missing HSTS, CSP and `nosniff`, framing, version banners, stack traces and SQL errors in bodies, cacheable personal data | 19 |
| **Token** | A JWT (decoded locally, never verified or sent) | `alg: none`, keys pointed to from the header (`jku`, `x5u`, `jwk`), odd `kid` values, missing `exp`/`aud`/`iss`, long lifetimes, broad scopes, personal data in claims | 11 |
| **Release** | The previous version of the spec | Operations that lost authentication or scopes, new sensitive fields, removed rate limits, re-opened request bodies, breaking changes, and the semantic-version bump the change needs | 10 |
| **Agents** | An MCP `tools/list` result, or OpenAI / Anthropic tool arrays; plus LLM endpoints in the spec | Invisible Unicode in tool text, descriptions that address the model, tools that move money or delete data without approval, parameters that take commands, URLs, file paths, user ids or secrets, look-alike tool names; prompts without limits, client-set system prompts, free model choice, personal data sent to the model, unescaped model output; an 8-point safeguards checklist | 29 |
| **CI** | Nothing: it writes the workflow | A GitHub Actions workflow that fails pull requests at the severity you choose and sends SARIF to code scanning | |

Every finding carries the exact operation, header, claim or tool it came from, the text that matched, why it matters, the fix, and the standard it maps to (OWASP API Security Top 10 2023 or OWASP LLM guidance). The full list with severities and standards is in **[docs/RULES.md](docs/RULES.md)**.

## Screenshots

| | |
|---|---|
| ![The check-up: findings beside the open finding, with fix code](docs/screenshots/10-app-finding.jpeg) | ![Agent tool review with the instruction hidden in a tool description](docs/screenshots/11-app-agents.jpeg) |
| **The check-up.** Grade, severity filters, the findings list, and the open finding with its fix in FastAPI and a Given-When-Then test. | **Agents desk.** A tool description that addresses the model, with the OWASP LLM risk it maps to. |
| ![CI desk with the generated GitHub Actions workflow](docs/screenshots/12-app-ci.jpeg) | ![Landing page: every finding comes with its fix](docs/screenshots/02-findings-and-fixes.jpeg) |
| **CI desk.** The workflow, the terminal command and every export, one click each. | **The product page**, showing the real output of the engine on the bundled sample. |

<details>
<summary>More: the landing page and phones</summary>

![Hero](docs/screenshots/01-hero.jpeg)
![Five checks](docs/screenshots/03-checks.jpeg)
![Agents](docs/screenshots/04-agents.jpeg)
![CI](docs/screenshots/05-ci.jpeg)
![Sources](docs/screenshots/06-sources.jpeg)
![Questions](docs/screenshots/07-questions.jpeg)
![Close and footer](docs/screenshots/08-close.jpeg)

![The check-up on a tablet, with the finding sliding over the list](docs/screenshots/15-tablet-detail.jpeg)

<p>
<img src="docs/screenshots/20-mobile-home.jpeg" width="32%" alt="Home on a phone">
<img src="docs/screenshots/21-mobile-findings.jpeg" width="32%" alt="Findings on a phone">
<img src="docs/screenshots/22-mobile-fix.jpeg" width="32%" alt="A fix on a phone">
</p>
</details>

## Quick start

### In the browser

Open **[patchlane.pages.dev/app](https://patchlane.pages.dev/app/)**, paste or drop your spec, and read the findings as you type. Pick your framework once (Express, FastAPI, Django REST Framework, Laravel or Spring Boot) and every fix appears in it. `J` and `K` walk the list. Export a Markdown report, SARIF, JSON or Gherkin security specs from the **Export** menu.

Want to see it first? The [sample report](https://patchlane.pages.dev/app/?sample=1) loads Larkspur, a made-up lending API written with problems on purpose.

### CLI

Node 18 or newer. No install needed:

```bash
npx --yes github:abuhuraira99/patchlane check openapi.yaml --fail-on high
```

Or take the single-file bundle (no dependencies):

```bash
curl -fsSLO https://patchlane.pages.dev/patchlane.mjs
node patchlane.mjs check openapi.yaml \
  --previous openapi-last-release.yaml \
  --response response.txt --origin https://unknown.example --authenticated \
  --jwt token.jwt --tools tools.json \
  --framework fastapi \
  --report report.md --sarif patchlane.sarif --json report.json --gherkin security.feature
```

| Exit code | Meaning |
|---|---|
| `0` | No finding at or above `--fail-on` (default `high`) |
| `1` | At least one finding at or above `--fail-on` |
| `2` | Bad input: a missing file, a spec that does not parse, a wrong option |

Run `patchlane --help` for every option, and see [`examples/`](examples) for inputs to try.

### GitHub Action

```yaml
name: API security check
on:
  pull_request:
    paths: ['openapi.yaml']
permissions:
  contents: read
  security-events: write
jobs:
  patchlane:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Get the spec from the base branch
        run: git show "origin/${{ github.base_ref }}:openapi.yaml" > previous-spec.yaml || true
      - uses: abuhuraira99/patchlane@v1
        with:
          spec: openapi.yaml
          previous: previous-spec.yaml   # optional: adds the release check
          tools: mcp-tools.json          # optional: reviews your agent's tools
          fail-on: high
          sarif: patchlane.sarif
          report: patchlane-report.md    # also added to the job summary
          framework: express             # fix code in the report
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: patchlane.sarif, category: patchlane }
```

Findings appear as annotations on the pull request, on the line of the spec they come from, and in the repository's **Security → Code scanning** tab. The CI desk in the app writes this file for you with your paths and threshold.

## Outputs

| Format | For | Notes |
|---|---|---|
| **Markdown report** | Hand-over to a client, a ticket, the job summary | Grade, counts, documentation score, release summary, every finding with fix code in your framework |
| **SARIF 2.1.0** | GitHub code scanning and any SARIF viewer | Stable rule ids, `security-severity` scores, line numbers in the spec, partial fingerprints so alerts survive edits |
| **Gherkin** | Cucumber, Behave, SpecFlow, Karate | One `Feature`, a `Rule` per area, a Given-When-Then scenario per finding that proves the control: "bob gets 404 for alice's order" |
| **JSON** | Your own tooling | The whole report |
| **Workflow YAML** | `.github/workflows/` | Generated by the CI desk |

## How it works

```mermaid
flowchart LR
  subgraph Inputs
    A[OpenAPI / Swagger<br>JSON or YAML]
    B[HTTP response]
    C[JWT]
    D[Previous release]
    E[MCP / OpenAI /<br>Anthropic tools]
  end
  subgraph Engine["Engine (pure TypeScript, no network)"]
    P[Parsers<br>safe YAML, $ref, cycles]
    K[Checks<br>API · server · token ·<br>release · agents]
    R[Report<br>grade, severity, docs score]
    X[Exports<br>Markdown · SARIF ·<br>Gherkin · JSON]
    F[Fix library<br>19 families × 5 frameworks]
  end
  A & D --> P
  E --> P
  B & C --> K
  P --> K --> R --> X
  F --> X
  R --> W[Web app]
  R --> L[CLI]
  R --> G[GitHub Action]
```

The engine in [`src/engine`](src/engine) is one dependency-free library (plus `js-yaml`) that runs unchanged in the browser and in Node. The web app, the CLI and the Action are three thin shells around it, so a finding has the same id, wording and severity everywhere.

```mermaid
flowchart TD
  PR[Pull request changes openapi.yaml] --> CK[actions/checkout]
  CK --> BASE[Spec from the base branch]
  BASE --> PL[Patchlane Action]
  PL -->|finding at or above fail-on| FAIL[Check fails]
  PL -->|below| PASS[Check passes]
  PL --> SARIF[patchlane.sarif] --> CS[Code scanning alerts on the right lines]
  PL --> SUM[Markdown in the job summary]
```

### Grading

Each finding costs points by severity (critical 24, high 10, medium 4, low 1). Repeats of one rule cost less each time, because the same gap on twenty endpoints is one habit to fix. The score is `100 × e^(−penalty/90)`, so it stays meaningful across the range, and any critical finding caps the grade at D.

## Privacy and security model

Patchlane is a security tool, so it holds itself to the standard it checks:

- **Nothing leaves the browser.** The site is static files on Cloudflare Pages with no backend. All parsing and checks run in the tab. The CLI and the Action make no network calls.
- **No tracking.** No analytics, cookies, pixels or third-party scripts. Fonts are self-hosted.
- **Safe rendering.** Every string from your input reaches the DOM through `textContent`, never `innerHTML`. A tool named `<img src=x onerror=alert(1)>` renders as text (this is tested).
- **Safe parsing.** YAML loads with the JSON schema only (no custom tags), inputs over 5 MB are refused, `$ref` cycles and YAML alias bombs are bounded, and response bodies are scanned up to 20 KB so a crafted input cannot freeze the tab.
- **Strict headers.** A hash-based Content-Security-Policy (no `unsafe-inline` scripts), HSTS, `nosniff`, `frame-ancestors 'none'`, COOP, CORP and a locked-down Permissions-Policy, written at build time by [`scripts/postbuild.mjs`](scripts/postbuild.mjs).

Run Patchlane's own server check on its live site and it grades itself **A (100/100)**:

```bash
curl -si https://patchlane.pages.dev/ > response.txt
node patchlane.mjs check --response response.txt
# Grade A (100/100) · 1 finding: 1 info
```

Found a problem? See [SECURITY.md](SECURITY.md).

## Who uses it, and for what

| Who | When | What they get |
|---|---|---|
| **A product team without a security engineer** | Before a release, or before a customer's security questionnaire arrives | A ranked list of what to fix first, with code they can paste, and a CI gate so fixed problems stay fixed |
| **A freelancer or agency** | When handing an API over to a client | A Markdown or JSON report to attach to the delivery, and Gherkin tests the client's team can run |
| **A security reviewer or pen-tester** | At the start of an engagement | A fast, explainable first pass over the spec, a captured response, a token and the agent's tools, so manual time goes to what a static review cannot see |
| **A team shipping an AI agent or MCP server** | Before the agent gets real tools | A review of every tool definition: hidden characters, model-directed text, actions without approval, and the parameters that hand the model too much power |
| **A platform or DevSecOps engineer** | In every pull request | SARIF in code scanning, annotations on the spec line, and a build that fails at the severity they choose |

## Where Patchlane fits

Commercial API security platforms cover design review, runtime testing and traffic monitoring, and they are priced and sold for larger companies. Patchlane covers the first of those, **the review of what an API declares**, and makes it free, open source and private:

- **Free and MIT-licensed.** No account, no seat limit, no usage cap.
- **Private by construction.** Specs, tokens and responses are read in the browser tab or on your own CI runner; there is no server to send them to.
- **Fixes, not only findings.** Every finding that code can fix comes with the fix in your framework and a test that proves it.
- **APIs and AI agents in one place.** The same review covers the tool definitions an agent will call your API through.

It does not replace testing the running service: it tells you what to confirm there, and the Gherkin specs are how you confirm it.

## Development

```bash
git clone https://github.com/abuhuraira99/patchlane.git
cd patchlane
npm ci
npm run dev        # landing at /, check-up at /app/, rules at /rules/
npm test           # 472 tests
npm run build      # typecheck, build the site, bundle the CLI, write security headers
```

```
patchlane/
├── src/engine/          the library: parse, checks, agent review, report, exports, fixes, fixtures
├── src/app/             the check-up (vanilla TypeScript, no framework)
├── src/rules/           the rules catalogue page
├── cli/                 patchlane.ts and the committed single-file bundle the Action runs
├── tests/               vitest: coverage, parsing, checks, report and fuzzing, exports, CLI, fixes, regressions
├── examples/            the Larkspur sample inputs
├── scripts/             postbuild (headers, pruning, CLI copy), rules-doc
├── public/              fonts, design-kit runtime, page CSS, share image
├── action.yml           the composite GitHub Action
├── docs/                RULES.md, screenshots
├── DESIGN.md            the design system: tokens, components, rules
└── PRODUCT.md           who it is for and what it promises
```

| Test file | Tests | What it proves |
|---|---|---|
| `coverage.test.ts` | 124 | Every rule id in the engine is produced by a fixture, and nothing else is |
| `checks.test.ts` | 96 | Each check fires on what it should and stays quiet otherwise |
| `fixes.test.ts` | 94 | All 95 fix snippets exist with the right language; every mapped rule has one |
| `report.test.ts` | 59 | Grading, gating and 1,800 fuzzed inputs that must never throw |
| `parse.test.ts` | 51 | OpenAPI 3.x, Swagger 2.0, `$ref` cycles, YAML safety, tool formats, error messages |
| `exports.test.ts` | 24 | Valid SARIF, line placement, Markdown, Gherkin structure, workflow YAML |
| `cli.test.ts` | 14 | The real CLI bundle: exit codes, files written, GitHub annotations and summaries |
| `regressions.test.ts` | 10 | Every bug found while building stays fixed |

Adding a rule takes four steps: the check, a fixture that triggers it, an optional fix-family mapping, and an optional Gherkin template. [CONTRIBUTING.md](CONTRIBUTING.md) walks through them.

### Design

The design system is documented in **[DESIGN.md](DESIGN.md)** (tokens, components, states and the rules behind them). The interface uses one system end to end: a lunar-grey ground with a single bronze accent, Instrument Sans for text and DM Mono for code, ids and evidence, and sharp corners. Severity always appears as a label with its colour, never as colour alone. The pages work by keyboard, respect reduced motion, and pass from 320 px phones to wide desktops. Measured on the landing page: largest contentful paint 192 ms (CPU-only Chrome), layout shift 0, no long tasks; Lighthouse Best Practices 100 and SEO 100.

## Limits, plainly

- A spec, a response or a token shows what an API **declares**, not everything it **does**. Patchlane cannot prove the server enforces ownership or limits; each finding says what to confirm on the running service, and the Gherkin specs are how you prove it.
- Detection of model-directed text in tool descriptions is pattern-based. It catches the common forms; it is a reviewer's aid, not a guarantee.
- Fix snippets are starting points for common setups. Read them before you ship them.

## License

[MIT](LICENSE) © 2026 Abu Huraira. Instrument Sans and DM Mono are under the SIL Open Font License. Product names and logos are trademarks of their owners.

The rules stand on the work of the [OWASP API Security Project](https://owasp.org/API-Security/) and the [OWASP GenAI Security Project](https://genai.owasp.org/).
