# Daily Note Navigation

Small TypeScript Obsidian desktop plugin. The approved scope and test requirements are in `docs/plans/daily-note-navigation.md` and `docs/plans/daily-note-navigation-tests.md`. Preserve these planning records; status belongs in `PROGRESS.md`.

- Run shell commands separately, without `&&`, `||`, or command separators. Use absolute paths or a tool's working-directory argument; never prefix commands with `cd`.
- Conductor owns branches/worktrees. Work in the supplied feature workspace.
- Navigation must never create, edit, rename, or delete notes. Core Daily notes folder/format are authoritative. Display dates as `YYYY-MM-DD`.
- Keep undocumented settings access in `readDailySettings` and header selectors in `src/header.ts`. Use public Obsidian APIs elsewhere.
- Production imports Moment from Obsidian. `moment` is a pinned test-only dependency; `tests/obsidian.ts` is a test-only API stub.
- Use `npm run typecheck`, `npm run lint`, `npm test`, and `npm run package`. The official Obsidian lint rules apply to production source; documented test-only Moment exceptions are deliberate.
- Native tests use only `~/scratch/obsidian-dnn/DNN Fixture`. Never aim fixture mutation or reload scripts at a personal vault. Keep installable packages and screenshots outside this ephemeral workspace.
- `VERSION` is the release source; synchronize manifest/package/lockfile and app compatibility mapping. Obsidian tags are exactly `x.y.z`, without `v`. Implementation alone does not authorize release bumps, commits, publication, or main-branch changes.
- Do not add co-authorship trailers. A distribution license remains a user decision before publication.
