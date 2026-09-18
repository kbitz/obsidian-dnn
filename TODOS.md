# TODOS

## Completed

### Release/distribution pipeline for the Obsidian plugin

**What:** Add a GitHub Actions workflow that builds `main.js`/`manifest.json`/`styles.css` and attaches them to a GitHub Release on tag push.

**Why:** There's currently no way for anyone to install this plugin from a release — the daily-note-navigation PR is the first to add the actual buildable artifact (package.json, esbuild config, manifest.json).

**Context:** Shipped as `.github/workflows/release.yml` (PR #2), alongside an MIT license (matching `obsidian-crypt`) so BRAT can track this repo's releases for auto-update. The repo is now public.

**Effort:** S
**Priority:** P2
**Completed:** v0.1.0 (2026-09-18)
