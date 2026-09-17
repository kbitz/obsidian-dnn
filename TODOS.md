# TODOS

## Infrastructure

### Release/distribution pipeline for the Obsidian plugin

**What:** Add a GitHub Actions workflow that builds `main.js`/`manifest.json`/`styles.css` and attaches them to a GitHub Release on tag push.

**Why:** There's currently no way for anyone to install this plugin from a release — the daily-note-navigation PR is the first to add the actual buildable artifact (package.json, esbuild config, manifest.json).

**Context:** No `.github/workflows/` directory exists yet. Building the workflow is separate from deciding *whether/how* to publish — CLAUDE.md reserves the distribution-license decision for the user before publication; this item is just the build/release automation, not that decision.

**Effort:** S
**Priority:** P2
**Depends on:** Distribution license decision (see CLAUDE.md)

## Completed
