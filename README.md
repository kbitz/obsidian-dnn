# Daily Note Navigation

Browse existing daily notes directly from the note header:

```text
‹    2026-09-16    ›
```

The arrows skip gaps. Click the date to choose an existing note from a calendar, with month selection and direct year entry. Missing dates cannot be opened or created. Ordinary notes keep their normal breadcrumbs.

## Requirements

- Desktop Obsidian 1.13.7 or later (`isDesktopOnly`). Currently tested on macOS; Windows and Linux are not yet verified.
- Plugin ID and folder name: `daily-note-navigation`.
- Enable the core **Daily notes** plugin and configure its folder and date format. No separate folder setting is needed.
- Use a format that identifies a complete date with a four-digit year. Calendar dates (`YYYY-MM-DD`), ordinal dates (`YYYY-DDD`), ISO week dates (`GGGG-[W]WW-E`), date subfolders, bracketed literals, and localized date formats without a time are supported. Displayed dates always use ASCII `YYYY-MM-DD`.

The header follows Obsidian's note-header visibility setting. Unsupported formats, unavailable core settings, or incompatible header markup leave the ordinary header available. If more than one file maps to the same day, that day is skipped for navigation and the ordinary breadcrumb stays.

## Using the navigator

Open a daily note, then use either arrow or click its date. The previous/next arrows skip missing days and disable at the earliest and latest existing notes. Choose a month and enter a four-digit year; commit the year with Enter or by leaving the field. Only years represented in your notes are available. Today opens today's note only if it already exists. Escape, Close, or clicking outside dismisses the picker.

Keyboard: arrow keys move through the grid, Home/End reach week boundaries, Page Up/Down change month, and Shift+Page Up/Down change year. Enter or Space selects an existing date. Tab stays inside the picker. Missing dates can receive focus and announce their unavailable state.

Navigation opens in the pane whose header you used, including pinned panes. It participates in Obsidian's normal history. Multiple panes and pop-out windows have independent headers.

## Commands and hotkeys

While an eligible daily note is active, the plugin adds:

- **Daily Note Navigation: Open date picker** — requires a visible note header.
- **Daily Note Navigation: Open today's existing daily note** — available only if today's note exists.

Assign shortcuts in **Settings → Hotkeys**. The plugin provides no default bindings. Core **Daily notes: Open previous daily note** and **Open next daily note** already exist and remain unchanged; they retain Obsidian's own pane-selection behavior. Core **Open today's daily note** can create notes, unlike this plugin's existing-only action.

## Local installation

Run each command from the repository directory:

```sh
npm ci
npm run package
```

Copy `main.js`, `manifest.json`, and `styles.css` from `dist/daily-note-navigation/` to `<vault>/<config-dir>/plugins/daily-note-navigation/`, then enable the plugin in Community plugins. The usual configuration directory is `.obsidian`; use your vault's actual directory if customized.

For a prepared local vault, the helper copies only those plugin files:

```sh
npm run install:local -- "/absolute/path/to/vault" ".obsidian"
```

Reload this plugin after replacing its files. Disabling it removes its controls and restores the original breadcrumb.

## Development and verification

Use Node 22.12+ with a Vitest-supported release (22.12+, 24, or 26+). The lockfile pins tooling and test dependencies. `npm run dev` watches the TypeScript sources; `npm run build` typechecks and creates the production bundle. Runtime Moment comes from Obsidian; the pinned test dependency matches the tested host.

```sh
npm run typecheck
npm run lint
npm test
npm run package
npm run fixture
```

The fixture command creates `~/scratch/obsidian-dnn/DNN Fixture` and refuses to overwrite an existing directory. Open that folder as a vault in Obsidian, install the package there, and trust the fixture's locally built plugin. With Obsidian's CLI installed, run:

```sh
node scripts/native-smoke.mjs
node scripts/native-scenarios.mjs
node scripts/measure.mjs
```

The native tests target only that named fixture. Smoke checks exercise real keyboard/pane behavior and require unchanged Markdown paths and hashes. The scenarios test temporarily changes fixture settings and files, restores them, and checks the restored hashes. The fixture includes today's note; refresh that test data if testing on a later date. The measurement script times a synthetic 10,000-note history. Evidence is saved outside the ephemeral workspace under `~/scratch/obsidian-dnn/`.

Project status is in [PROGRESS.md](PROGRESS.md); architecture and acceptance criteria are in the [engineering plan](docs/plans/daily-note-navigation.md) and [test plan](docs/plans/daily-note-navigation-tests.md).

## Privacy and compatibility

The plugin runs offline. It indexes file paths under the configured Daily notes folder and opens existing files; it does not read note bodies for indexing, modify notes, create notes, send network requests, collect telemetry, access external files, or update itself. Development scripts and tests are not included in the installed plugin.

Reading core Daily notes settings and replacing the header use undocumented integration points. Both are isolated and guarded; future Obsidian changes may require an update. Plugin styles are scoped and use the active theme's variables.

## License

[MIT](LICENSE)

## Distribution

Installable via [BRAT](https://github.com/TfTHacker/obsidian42-brat): in Obsidian, add `kbitz/obsidian-dnn` as a beta plugin. The repo is public, so no token is needed. BRAT then keeps the plugin updated automatically from this repo's [releases](https://github.com/kbitz/obsidian-dnn/releases), which a tag push builds and publishes via `.github/workflows/release.yml`.

Not (yet) submitted to Obsidian's community plugin directory — that's a separate decision; see the [publication checklist](docs/plans/obsidian-plugin-guidelines.md) if that changes. Release versions and tags must match `VERSION` as plain `x.y.z`, without a `v` prefix. Keep `package.json`, `manifest.json`, the lockfile, and `versions.json` consistent when releasing; generated bundles belong in release assets, not git.
