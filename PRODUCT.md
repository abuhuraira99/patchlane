# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three audiences, weighted equally (confirmed 2026-11-16):

- **Small product teams without a security hire.** A developer or tech lead at a 2 to 30 person company who ships an API and wants to know, before a customer or an auditor asks, what in it is risky and how to fix it in the framework they already use.
- **Freelancers and agencies** who build APIs for clients and want a clean, defensible security report to hand over with the work.
- **Security reviewers** (AppSec engineers, pen-testers, auditors) who want a fast, explainable first pass over a spec, a server response, a token or a tool list before the manual review starts.

## Product Purpose

Patchlane is a security check-up for APIs and the AI agents that call them. You paste or drop what you already have (an OpenAPI or Swagger spec, a raw HTTP response, a JWT, two versions of a spec, an MCP `tools/list` result) and get findings ranked by severity, each with the public standard it maps to, why it matters, and fix code for Express, FastAPI, Django REST Framework, Laravel or Spring Boot. The same engine runs as a CLI and a GitHub Action, so the check-up becomes a release gate.

Success: a team fixes a real authorization, exposure or configuration problem before it ships, and keeps it fixed because CI blocks the regression.

## Positioning

- **Nothing leaves the browser.** The engine is a pure TypeScript library with no network calls; specs, tokens and headers are analysed locally. A spec can describe an unreleased product, so this matters.
- **Fixes, not just findings.** Every finding family carries working fix code in five frameworks.
- **One engine, three places:** the web app, the CLI, and a GitHub Action that writes SARIF to code scanning.
- **APIs and agents together:** the same check-up reviews the API and the tool definitions an AI agent will call it through.

## Operating Context

- Inputs: OpenAPI 3.0/3.1 and Swagger 2.0 (JSON or YAML), raw HTTP response text (from curl -i or browser devtools), JWTs, MCP tools/list results, OpenAI and Anthropic tool arrays.
- Outputs: findings list, grade and documentation score, Markdown report, JSON, SARIF 2.1.0, Gherkin (Given-When-Then) security specs, a GitHub Actions workflow.
- Used during design review, before a release, in CI, and when handing an API to a client or an AI agent.

## Capabilities and Constraints

- Static analysis only: Patchlane never sends traffic to the user's API. Findings say what the artifact shows and what to verify on the running service.
- Defensive scope only: findings and fixes. No attack tooling, payload generation or exploit chains.
- Deployed on Cloudflare (static assets); CLI requires Node 18+.
- No accounts, no sign-up, no tracking. No pricing, trial or subscription text anywhere (owner instruction).

## Brand Commitments

- Name: **Patchlane** (searched 2026-11-15, no conflicting product; see names.json).
- Voice: plain, exact, calm. Says what was found, where, and what to do. No fear selling.
- Every rule cites its source: the OWASP API Security Top 10 (2023), OWASP LLM guidance, and the APIsec University course that taught it.

## Evidence on Hand

- The engine and its rules (src/engine), the 13 APIsec University courses the rules come from (../certificates/linkedin-entries.md).
- No customers, testimonials, logos, usage numbers or benchmarks exist. Do not invent any.

## Product Principles

1. Show the evidence: every finding names the exact operation, header, claim or tool, and quotes what matched.
2. Every finding ends in a fix the reader can paste.
3. Private by construction, not by promise.
4. Honest about limits: a spec cannot prove a server is safe, and the product says so where it matters.
5. Fits the workflow a team already has: browser, terminal, CI.

## Accessibility & Inclusion

WCAG 2.2 AA: full keyboard use of the analyzer, visible focus, readable contrast in every severity colour, reduced-motion respected, works from 320px wide.
