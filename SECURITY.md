# Security policy

Patchlane is a security tool, so its own security matters.

## Design

- **No data leaves the browser.** The web app has no backend. Every check runs client-side; the site is static files on Cloudflare Pages.
- **No `innerHTML` with user input.** Every string from a pasted spec, response, token or tool list is rendered through `textContent` or attributes.
- **Safe parsing.** YAML is parsed with the JSON schema only (no custom tags, no functions). Inputs over 5 MB are refused. `$ref` cycles are bounded.
- **Strict headers.** The site ships a hash-based Content-Security-Policy (no `unsafe-inline` scripts), HSTS, `nosniff`, `frame-ancestors 'none'`, COOP and a locked-down Permissions-Policy. See `scripts/postbuild.mjs`.
- **No network calls** from the CLI or the GitHub Action.

## Supported versions

The latest release on `main` and the `v1` tag of the GitHub Action receive fixes.

## Reporting a vulnerability

Please open a [private security advisory](https://github.com/abuhuraira99/patchlane/security/advisories/new) rather than a public issue. Include steps to reproduce and the input that triggers the problem (with any real secrets removed). You will get an answer within a few days.
