# Example inputs

Larkspur is a made-up lending API, written with problems on purpose so every desk of Patchlane has something to find. Nothing here describes a real company.

| File | Checked with |
|---|---|
| `larkspur-openapi.yaml` | `patchlane check examples/larkspur-openapi.yaml` |
| `larkspur-openapi-2.3.0.yaml` | `--previous examples/larkspur-openapi-2.3.0.yaml` (release diff) |
| `response.txt` | `--response examples/response.txt --origin https://unknown.example --authenticated` |
| `token.jwt` | `--jwt examples/token.jwt` |
| `tools.json` | `--tools examples/tools.json` |

All at once:

```bash
node cli/dist/patchlane.mjs check examples/larkspur-openapi.yaml \
  --previous examples/larkspur-openapi-2.3.0.yaml \
  --response examples/response.txt --origin https://unknown.example --authenticated \
  --jwt examples/token.jwt --tools examples/tools.json \
  --framework fastapi --report report.md --sarif patchlane.sarif --gherkin security.feature
```
