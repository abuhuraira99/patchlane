# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-16

### Added
- Engine with 100 checks: OWASP API Security Top 10 (2023) review of OpenAPI 3.x and Swagger 2.0, authentication schemes, documentation score, inventory, server response headers (CORS, cookies, HSTS, CSP, disclosure), JWT review, release diff with semantic-version advice, LLM endpoint checks, AI agent tool-definition review (MCP, OpenAI, Anthropic) and an agent safeguards checklist.
- Fix code for 19 fix families in Express, FastAPI, Django REST Framework, Laravel and Spring Boot.
- Exports: Markdown report, SARIF 2.1.0, JSON, Gherkin security specs, GitHub Actions workflow.
- Web app (runs fully in the browser), CLI (`patchlane check`) and composite GitHub Action (`abuhuraira99/patchlane@v1`).
- Rules catalogue at `/rules/`.
