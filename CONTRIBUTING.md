# Contributing

Thanks for helping make API checks better.

## Setup

```bash
git clone https://github.com/abuhuraira99/patchlane.git
cd patchlane
npm ci
npm run dev        # http://localhost:5173 (landing), /app/ (check-up), /rules/
npm test           # vitest: engine, exports, CLI, fixes, fuzzing
npm run build      # typecheck, site build, CLI bundle, security headers
```

## Adding a rule

1. Add the check to the right module in `src/engine/` (`api-checks.ts`, `server-checks.ts`, `jwt.ts`, `diff.ts`, `agent.ts`). Give it a stable id (`AREA-SHORT-NAME`), a severity, a title that states the problem, `detail` (why it matters), `fix` (what to do) and `refs` (the standard and the course it comes from, from `refs.ts`).
2. Add an input to `src/engine/fixtures.ts` that triggers it. `tests/coverage.test.ts` fails until every rule id is produced by a fixture.
3. If code can fix it, map the rule to a fix family in `src/engine/fixes.ts` (`fixKeyForRule`).
4. If a test can prove the fix, add a Given-When-Then template in `src/engine/exports.ts` (`scenario`).
5. Rebuild the CLI bundle (`npm run build:cli`) and commit `cli/dist/patchlane.mjs`: the GitHub Action runs it.

## Style

- TypeScript strict, no runtime dependencies beyond `js-yaml`.
- Findings say what was found, where, and what to do. No fear wording.
- Defensive scope only: Patchlane reviews artefacts. It never sends traffic to an API and never generates attack payloads.
