---
name: client-protocol-compatibility
description: Review server or web changes against external client protocol expectations. Use when changing synchronization payloads, authentication flows, connectors, deep links, CORS, origin checks, callback schemas, unknown-field handling, or compatibility with multiple official and third-party clients.
---

# Client Protocol Compatibility

Preserve protocol behavior across independently released clients. Compare against primary client sources and captured fixtures rather than UI assumptions.

## Workflow

Progress:

- [ ] Step 1: Inventory clients and protocol surfaces → Read [references/01-inventory.md](references/01-inventory.md)
- [ ] Step 2: Compare requests, responses, and trust boundaries → Read [references/02-compare.md](references/02-compare.md)
- [ ] Step 3: Build a compatibility matrix → Read [references/03-verify.md](references/03-verify.md)

## Configuration

Read [config.toml](config.toml). Add canonical source locations, local protocol paths, supported clients, and required negative cases. Keep private captures outside the skill and repository.

## Rules

- Preserve unknown client fields unless they are invalid or server-owned.
- Validate callback destinations, message origins, referrers, and deep-link schemes independently.
- Compare exact field names, casing, encodings, status codes, headers, and fallback behavior.
- Test old and current client variants when the protocol is versioned or transitional.
- Never copy tokens, credentials, vault contents, or private traffic captures into fixtures.
