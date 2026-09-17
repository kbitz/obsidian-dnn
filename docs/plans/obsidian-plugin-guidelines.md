# Obsidian plugin guidelines review

Reviewed 2026-09-16 for Daily Note Navigation, at the user's request. This evaluates the proposed design: no plugin source, build, or manifest exists yet. No implementation compliance checks have passed. Community submission remains out of scope.

## Assessment

The intended offline, existing-note navigator is compatible with the reviewed policies in principle. The two undocumented integrations—core Daily Notes options and the center header markup—remain compatibility risks, not evidence of a policy violation. The reviewed guidelines do not establish a blanket ban on these integrations or guarantee their acceptance. Keep the approved small adapters, structural guards, and native-header fallback; document the dependency and tested app versions. Prefer public APIs everywhere else. See the [official guidelines source](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md).

## Requirements for implementation

| Area | Required behavior / evidence |
| --- | --- |
| Policy | Runtime has no network, telemetry, ads, account requirements, self-updater, or filesystem access outside the vault. README explains local path indexing, core Daily Notes dependency, and existing-note-only navigation. |
| Licensing | Choose a license before public distribution; add root LICENSE and consistent package metadata. Review any reused code's attribution requirements. No license grant has been selected by this review. |
| Manifest | Use `daily-note-navigation`, display name `Daily Note Navigation`, author, `x.y.z` version, tested minimum app version, and `isDesktopOnly: true`. Folder name matches ID. No placeholder author or funding URL. |
| Description | Proposed text: “Browse existing daily notes from the note header with previous and next navigation and a date picker.” |
| Code | Use injected `this.app`, public Vault path lookups, normalized configured paths, and runtime type guards. Avoid global app, unsafe HTML strings, sample code, and routine console logging. No note-writing APIs are needed. |
| Cleanup | Register app events through lifecycle helpers. Dispose pane/dialog listeners, observers, scheduled callbacks, and bindings when their owner closes or unloads; restore breadcrumbs without detaching leaves. |
| UI | Use sentence case, text-safe DOM construction, plugin-scoped CSS and Obsidian theme variables. Hide only the owned breadcrumb children under the plugin marker. No global style overrides or default app hotkeys. |
| Commands | User requested native palette/Hotkeys integration. Use `Plugin.addCommand`, stable local IDs without a plugin prefix, and conditional callbacks that recheck execution. Add only the missing picker and existing-today actions; preserve core previous/next and user-assigned shortcuts. |

Policy and license requirements come from [Developer policies](https://docs.obsidian.md/community-directory/developer-policies). Manifest fields and identifier rules come from [Manifest](https://docs.obsidian.md/Reference/Manifest); description and minimum-version requirements come from [Submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins). Code/UI guidance comes from the [official guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md); cleanup follows [plugin lifecycle guidance](https://docs.obsidian.md/plugins/guides/lifecycle-management).

Command registration follows the official [Commands guide](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Commands.md); user bindings live in [Settings → Hotkeys](https://obsidian.md/help/hotkeys).

## Validation and packaging

- Add `eslint-plugin-obsidianmd` using its recommended type-aware configuration and an `npm run lint` check. Inspect warnings as well as errors; do not broadly suppress rules to obtain a pass. Include manifest/license validation when those files exist. This is the official [local review tooling](https://github.com/obsidianmd/eslint-plugin).
- Keep static styling in `styles.css`, which Obsidian loads. Supply calculated picker coordinates through dynamic CSS custom properties. The official rules prohibit injected style/link elements, not native dialogs, and distinguish static from calculated styles: [element rule](https://github.com/obsidianmd/eslint-plugin/blob/master/lib/rules/noForbiddenElements.ts), [style rule](https://github.com/obsidianmd/eslint-plugin/blob/master/lib/rules/noStaticStylesAssignment.ts).
- Maintain the npm lockfile. `npm run build` must produce the actual production plugin reproducibly; tests/mocks stay in `tests/`, helpers in `scripts/`. Inspect the resulting bundle for accidental test stubs, duplicate Moment, and development code. The directory scanner prioritizes the `build` script: [review FAQ](https://docs.obsidian.md/community-directory/faq).
- VERSION remains the local release source. Synchronize `package.json` and `manifest.json` to plain `x.y.z`. Obsidian release tags must be **`x.y.z`, without `v`**, overriding the standard project's tag prefix for this plugin. Release attachments are individual `main.js`, `manifest.json`, and `styles.css` files. Keep generated bundles out of source control; produce them during packaging. See [submission instructions](https://docs.obsidian.md/plugins/releasing/submit-plugin) and [official self-review checklist](https://docs.obsidian.md/oo/plugin).
- Maintain root `versions.json` for plugin-version/minimum-app compatibility, updating it when the required app version changes. See [Versions](https://docs.obsidian.md/Reference/Versions).

## Before any future submission

Complete implementation lint/typecheck/tests/build and real-app acceptance checks, including unload restoration, pop-out keyboard/focus behavior, theme styling, unchanged note files, and unsupported-internal-shape fallback. Record tested versions/platforms; do not infer cross-platform support from a macOS run.

Choose the license; complete README and attribution; recheck name/ID uniqueness and current policies; verify a matching GitHub release and assets. On this review date, the official registry had no exact match for the proposed name/ID, but this reserves nothing. The current submission flow uses the [Obsidian Community directory](https://docs.obsidian.md/plugins/releasing/submit-plugin). No account connection, release publication, or submission was performed or authorized here.
