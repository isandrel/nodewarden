---
name: pwa-cache-triage
description: Diagnose stale, offline, double-load, wrong-shell, or protocol-page failures in progressive web applications. Use when service workers, browser caches, CDN caches, SPA fallbacks, hashed assets, connector pages, or deployment versions may disagree.
---

# PWA Cache Triage

Separate server deployment state, CDN behavior, browser navigation, service-worker routing, and cached assets before changing code or infrastructure.

## Workflow

Progress:

- [ ] Step 1: Reproduce and capture layers → Read [references/01-reproduce.md](references/01-reproduce.md)
- [ ] Step 2: Isolate cache ownership → Read [references/02-isolate.md](references/02-isolate.md)
- [ ] Step 3: Apply the smallest recovery → Read [references/03-remediate.md](references/03-remediate.md)

## Configuration

Read [config.toml](config.toml). Configure app-shell routes, protocol pages, never-cache paths, service-worker scope, direct-origin URL, and CDN URL. Leave deployment-specific values empty in committed files.

## Rules

- Compare direct origin and public domain before editing application code.
- Count actual navigations separately from speculative prefetch and client-side routing.
- Do not serve the SPA shell for exact protocol or callback pages.
- Preserve API, authentication, and private data from cache.
- Never delete production storage to resolve a frontend cache symptom.
