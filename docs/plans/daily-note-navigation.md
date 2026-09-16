# Daily Note Navigation: engineering plan

Review date: 2026-09-16. Branch: `kbitz/daily-note-navigation`.
Source: approved `docs/designs/daily-note-navigation.md`.
Planning complete for the user's instruction to commit the baseline and implement on 2026-09-16. No plugin code or vault data had been changed at this baseline.

## Scope challenge and existing capabilities

Keep the approved scope: replace only the center breadcrumb of recognized daily notes with previous, clickable `YYYY-MM-DD`, and next. Strictly existing notes; core Daily Notes settings define recognition. Desktop first; preserve ordinary history and other header controls.

User-requested addition on 2026-09-16: expose missing actions through Obsidian's command palette and built-in customizable hotkeys. Reuse existing core previous/next command entries; add date-picker and existing-today commands. No separate shortcut settings UI.

The repository has only the approved design and wireframe. There is no application, framework, test runner, dependency lockfile, or existing implementation to reuse. Use four TypeScript modules plus CSS, with ordinary build and test files. One required Obsidian Plugin subclass is enough; the other modules expose functions and explicit state/disposers. No UI framework, general plugin platform, database, network service, or separate settings screen.

What already exists:

| Capability | Reuse decision |
| --- | --- |
| Obsidian vault tree, file objects, events, per-pane file opening | Reuse public APIs; never use a command that creates a note. |
| Core Daily Notes folder and format | Read the enabled plugin's current options through one guarded compatibility function. No duplicate folder setting. |
| Bundled Moment | Reuse for strict configured-format parsing and calendar arithmetic. Keep internal date keys timezone-independent. |
| Core previous/next commands | Keep the existing palette/hotkey entries; do not duplicate or override them. Header arrows still use direct leaf navigation because the core commands select a pane globally. |
| Command palette and Settings → Hotkeys | Register missing actions with public `Plugin.addCommand`; Obsidian handles their palette entries and user-assigned shortcuts. No default key assignments. |
| Daily-notes-interface library | Do not add: its settings helper prefers Periodic Notes and its parser uses the basename, while this design requires core settings and full relative paths. |
| Native date input | Cannot express an arbitrary set of existing dates with min/max/step alone. Use a small calendar. |
| Native HTML dialog | Use its modal/focus behavior for the anchored calendar, with a transparent backdrop and theme styling. Verify in the real app. |

This is a complete small plugin, not a framework. The file count includes mandatory Obsidian packaging and meaningful tests; there is no architectural scope reduction to propose.

## Evidence and compatibility boundary

Read-only Obsidian CLI probes on 2026-09-16 found app version **1.13.7**, installer **1.12.7**, and the Dracula Official theme. The active Markdown view contains this header:

```text
.view-header
  .view-header-left             existing history controls
  .view-header-title-container  existing breadcrumb
    .view-header-title-parent
    .view-header-title
  .view-actions                existing view actions
```

The title container is already a centered flex item. Core Daily Notes exposes an enabled instance with `options.folder` and `options.format`; an omitted format uses `YYYY-MM-DD`. Its iterator parses the full relative path. Its previous/next handlers use global pane selection. Reading these objects and functions changed no files or UI.

The header markup and core settings accessor are internal integration points, not a stable public breadcrumb API. Limit knowledge of these shapes to the coordinator's settings guard and `header.ts`. Do not patch prototypes or call internal daily-note creation/navigation methods. Initially declare `minAppVersion: 1.13.7` and `isDesktopOnly: true`; older-version support can be claimed only after testing. Runtime structural guards remain necessary on newer versions.

These probes establish the available structure, not completed integration testing. Mounting, restoration, pop-out behavior, dialog focus, and theme rendering still require verification after implementation.

## Architecture and data flow

| Proposed module | Responsibility |
| --- | --- |
| `src/main.ts` | Plugin lifecycle, guarded core-settings read, event coalescing, index ownership, pane reconciliation, command registration, and one existing-file navigation function. |
| `src/daily-notes.ts` | Pure settings validation, full-path date recognition, sorted index construction, predecessor/successor lookup, and month cell data. |
| `src/header.ts` | Idempotent per-pane mount/update/dispose; owns internal header selectors, narrowly scoped observers, and restoration. |
| `src/calendar.ts` | Anchored native dialog, month/year controls, grid rendering, keyboard handling, and a single close/dispose path. |
| `styles.css` | Plugin-prefixed rules using Obsidian theme variables. |

```text
core settings -- validate/snapshot --+       vault create/delete/rename
                                    |                 |
                             configuration key        v
                                    +----------> dirty index
                                                    |
                       folder subtree -> strict date recognition
                                                    |
                              path map + date map + sorted dates
                                                    |
workspace/layout events -> reconcile loaded Markdown panes
                            | ineligible       | eligible
                            v                  v
                      restore breadcrumb    header controls
                                               |
                  previous / next / chosen date / existing today
                                               |
                     refresh settings -> revalidate target + pane
                                               |
                             originating leaf.openFile(existing TFile)
```

### Recognition contract

- Normalize the configured folder using Obsidian path semantics. Empty means vault root. Missing or wrong-type folder means unavailable, not permission to scan another folder.
- Only Markdown files beneath that folder qualify. Check directory boundaries, so `Daily` never matches `Daily Archive`. Strip only the final `.md` suffix, then parse the entire relative path strictly against the configured format.
- Require a complete date, not just Moment's `isValid()`: a live probe parsed `09-16` with `MM-DD` as the current year's date. Validate date-bearing tokens after handling literals, escapes, and localized format expansion. Support complete calendar dates with four-digit year, year plus day-of-year, and complete ISO week dates; reject formats missing the year/day or containing time-of-day identity. Test each supported family explicitly. Do not infer missing parts from today's date.
- Require formatting the parsed date back to the same relative path. This rejects conflicting date-derived folders and noncanonical matches. Invalid/leap-day failures are not daily notes.
- Create ASCII `YYYY-MM-DD` keys from year/month/day values, not UTC timestamps or locale-translated digits. Sort keys chronologically. Use the app's current Moment locale for parsing names and week layout; include locale in configuration invalidation.
- If more than one path resolves to a day, mark that day ambiguous and exclude it from navigation rather than silently choosing a file. Preserve ordinary breadcrumbs on ambiguous files and emit one explanatory notice for the ambiguity state.

### Settings, events, and index lifetime

Snapshot `{enabled, folder, format, locale}`. Re-read on reconciliation and before every navigation/picker action. If it differs, invalidate the index and remove stale bindings before the action continues. An unavailable or disabled core plugin preserves normal headers and produces a deduplicated notice, never a guessed default folder. Absent folder/format options in an otherwise valid core instance have their documented defaults.

After layout readiness, build an in-memory index from the configured folder subtree. Keep a path map, a date map, sorted date keys, and the recognized year range. No note-body reads or persisted index. File/folder create, delete, and rename events invalidate it; coalesce bursts and rebuild once. Ordinary content edits do not rebuild it. Workspace file-open, active-leaf-change, layout-change, window-open/close, and CSS changes trigger cheap pane reconciliation; these do not rebuild an unchanged index.

Skip deferred views instead of forcing background tabs to load. When a tab becomes loaded, reconcile it. Every binding belongs to a specific leaf, view, document, and current file; a mismatch disposes it. Use the owning document/window for DOM nodes, dialogs, observers, and animation frames.

### Header ownership and cleanup

Locate the title container inside each eligible view. Insert the plugin control group into that container. Scope hiding rules to the exact known breadcrumb children while the group's owning marker is present; do not clear, replace, or store old breadcrumb text. Obsidian remains responsible for updating its own nodes.

Check the new controls are connected before hiding the breadcrumb. If the expected shape is missing or replaced, remove only plugin nodes/markers and leave the normal header available. Add a small observer on the title/header structure where necessary, ignoring plugin-owned mutations; schedule at most one idempotent reconciliation per animation frame. No whole-document subtree observer or recurring polling loop. A lost mount must remove its hiding marker before returning.

Leaving a daily note, replacing a view, closing a window, disabling the core dependency, or unloading this plugin closes its calendar, disconnects observers/listeners, cancels scheduled callbacks, removes its nodes, and restores the original presentation. Keep a single disposer per binding; registration and disposal must balance under repeated navigation and reloads. A hidden tab header remains hidden.

### Navigation and asynchronous behavior

One function handles all note-opening actions. Capture direction/date intent, the originating leaf, and its binding generation. Refresh settings and rebuild a dirty index before resolving that intent; cancel if the originating configuration or current pane changed. Resolve the resulting indexed path to a current TFile and confirm it is still recognized. Open it directly in that leaf. Never use link resolution, core “open today,” `create`, `modify`, `rename`, or template functions.

Disable that binding's navigation while an open is pending to prevent overlapping operations. Do not queue repeated clicks against stale state. Clear pending state on success or error only if the binding generation still matches. A detached/replaced pane cancels work that has not started. After awaiting open, reconcile current reality rather than writing the captured date back into a stale header. A missing target refreshes state with “Daily note is no longer available”; an open failure gives a brief notice and leaves the current note usable. An explicit header action on a pinned leaf still targets that same leaf; pin state stays unchanged.

### Calendar and accessibility

Render only one month, at most 42 day cells, inside a native `dialog` created in the originating window. Anchor it beneath the date button and clamp/flip placement within the viewport. Use a transparent backdrop; pointer-down/up outside its rectangle dismisses it. Enter/Space on the date opens it, Escape closes it. Close it if its pane is removed, navigated away, settings change, or the window closes. One open picker per document; opening another dismisses the prior one.

Use a labelled calendar grid and roving focus. Arrow keys move by one day/week; Home/End move to week edges; PageUp/PageDown change month; year modifiers change year. Missing dates remain discoverable with `aria-disabled` and cannot activate by click, Enter, Space, or Today. Only one grid cell is in the Tab sequence; Tab/Shift-Tab stays within the modal controls. Focus initially uses the current note. Keep the current note's selection, today's marker, and keyboard focus distinct; every cell has an accessible full-date label and missing-note status. Announce month/year changes politely.

Month and year controls are separately labelled. Commit a valid year on Enter or blur, bounded by recognized years; invalid/partial input leaves the displayed month intact with an inline message. Month controls cannot move beyond that range. All month/day/year arithmetic uses calendar operations, with leap-day clamping. An empty month remains browsable and says “No daily notes this month.”

Close through one cleanup function. On Escape/cancel, return focus to the originating date if it still exists. On note selection, restore focus to its updated date after navigation. If the pane has gone away, leave focus with the newly active view. The native dialog's actual focus behavior must be checked in Obsidian, not claimed from a DOM test double.

### Command palette and configurable hotkeys

Read-only inspection of the installed app confirmed these core commands: `daily-notes:goto-prev` (Open previous daily note), `daily-notes:goto-next` (Open next daily note), and `daily-notes` (Open today's daily note). Previous/next locate neighboring existing notes; the Today command can create a missing note. Preserve these commands and their current shortcuts. Core previous/next keep Obsidian's own pane-selection and recognition behavior; they are not our header implementation.

Register the following additions once in `onload()` using public `Plugin.addCommand`, with stable unprefixed IDs and sentence-case names. Obsidian adds the plugin prefix and exposes them in Settings → Hotkeys. Omit default hotkeys and do not read/write the user's hotkey configuration.

| Local ID | Command name | Behavior and availability |
| --- | --- | --- |
| `open-date-picker` | Open date picker | Invoke the same picker as the date button in the active recognized daily-note pane. Available when its header control is mounted and visible, and no navigation is pending. If its picker is already open, focus it instead of duplicating it. |
| `open-existing-today` | Open today's existing daily note | Invoke the same existing-only Today action in the active recognized daily-note pane, only when today's indexed file exists and no navigation is pending. Never delegate to core Today. |

These commands mirror the existing header/calendar actions; opening the picker from unrelated notes is outside this addition. Use `checkCallback` rather than editor-only callbacks so reading mode works. Availability checks must not open files, change focus, show notices, or mutate the DOM. At execution, resolve the active `MarkdownView`, capture its leaf/binding, and recheck eligibility through the same action guards used by the buttons. An unavailable or deleted target never creates a note. Do not scan the private command registry in production; the live registry probe was only review evidence.

Obsidian owns app-level command shortcuts through its Hotkeys settings. The calendar's ordinary arrow/Tab/Escape behavior is widget accessibility and focus handling. Review correction after the user's challenge: E2/D3 did not establish a concrete keyboard conflict and should not have been an approval gate. Retain the existing real-app keyboard acceptance checks; do not prescribe an extra keymap scope before implementation evidence calls for one. Document built-in previous/next versus plugin additions, and link users to Settings → Hotkeys.

## Review findings and test coverage

Architecture and code quality: no change to the approved interaction is required. The integration risks already called out by the design now have concrete boundaries and verification requirements. Code does not exist yet, so these are planned behaviors, not observed regressions.

Testing: no existing runner or test suite. D2 option A approved a Vitest harness with a DOM environment and a minimal test-only `obsidian` alias/stub for the APIs exercised by the tests. Inject the Moment factory into pure date helpers; pin the test-only dependency to Moment 2.30.1, matching the inspected app. Runtime code imports Moment from Obsidian. Keep the stub and dev dependencies out of the production bundle. Real Obsidian checks remain required where mocks would hide API/DOM/focus failures; the stub is not evidence of app compatibility.

```text
[PLANNED, NOT RUN] SETTINGS / RECOGNITION -- tests/daily-notes.test.ts
  enabled / disabled / missing internal shape / default options
  folder boundary / vault root / nested formats / changed settings
  valid / invalid / leap day / yearless / literal and localized tokens
  complete ordinal + ISO-week dates / conflicting path / duplicate day
  empty / singleton / gap / boundaries / locale / timezone and DST

[PLANNED, NOT RUN] HEADER / NAVIGATION -- tests/header.test.ts
  daily -> ordinary -> daily / two panes / pinned leaf / deferred view
  mount / duplicate reconciliation / lost DOM / hidden header
  rename / delete / settings change / open rejection / rapid clicks
  detached or changed pane / unload / scheduled callbacks / observer loops

[PLANNED, NOT RUN] CALENDAR -- tests/calendar.test.ts
  current month / missing days / current day / Today absent / empty month
  direct year / invalid year / month + leap boundaries / 42-cell bound
  keyboard grid / labels / disabled activation / close / listener cleanup

[PLANNED, NOT RUN] COMMANDS -- tests/commands.test.ts
  stable IDs / two additions only / no default hotkeys / unload registration
  checking has no action side effects / execution revalidates current pane
  source + reading modes / ordinary note / hidden header / pending navigation
  picker opens once / existing Today / missing or deleted Today never creates

[->E2E, NOT RUN] REAL OBSIDIAN in a separate fixture vault
  install -> enable -> actual header -> existing-note navigation -> history
  Dracula + default theme / source + preview / narrow pane / pop-out
  native dialog + actual Tab/Escape behavior / pinned and two-pane navigation
  palette entries + user-assigned shortcuts / core previous-next unchanged
  settings change / deleted target / repeated disable-enable / clean restoration
  snapshot vault files before/after navigation: no content or file changes
```

All five groups are requirements for implementation. No tests have passed yet. Add branch-level assertions alongside the feature, not existence-only tests. The fixture vault and lasting screenshots/package outputs live outside the ephemeral workspace; test code and fixtures intended for version control live in the repository.

## Failure-mode review

| Path | Failure | Required handling and user outcome | Planned verification |
| --- | --- | --- | --- |
| Settings adapter | Core disabled or internal shape changed | Normal breadcrumb, one clear notice, no guessing | Unit + real-app dependency toggle |
| Recognition | Missing year accepted by Moment | Reject ambiguous format; explain once | Unit fixtures demonstrated by live probe |
| Index refresh | Folder rename or settings change | Invalidate snapshot and remove stale bindings | Unit + fixture-vault change |
| Navigation | Target deleted, pane detached, or promise rejects | No writes; cancel/notice; reconcile actual state | Integration with controlled promises + real app |
| Header | Obsidian rebuilds title nodes | Idempotent mount or restore native display | DOM mutation tests + reload/mode switch |
| Pop-out | Wrong document or closed window | Per-window DOM ownership and disposal | Real pop-out E2E |
| Calendar | Missing-date action from keyboard | Guard all activation paths; keep dialog usable | DOM interaction tests |
| Dialog | Keyboard focus escapes or return target vanishes | Native modal plus explicit valid focus destination | Actual app keyboard test |
| Cleanup | Queued callbacks remount after unload | Disposed flag, generation checks, cancelled callbacks | DOM tests + repeated enable/disable |
| Performance | Sync event storm creates repeated scans | Coalesced dirty index + cheap reconciliation | Instrumented burst test |

No failure path is intentionally silent with neither handling nor a planned test. Unsupported header shape may quietly leave native navigation intact; repeated activation failures should yield one concise compatibility notice, not a notification storm.

## Performance review

The active vault contains 3,269 Markdown files; no note contents were read. A read-only probe filtered and strictly parsed 433 daily notes in about 3 ms on this machine; this is a feasibility observation, not a benchmark of the unbuilt plugin. Native `dialog.showModal` is available. Traverse only the configured folder (the whole vault only when that is the configured folder). Rebuilding costs O(F + D log D), where F is files below that folder and D is recognized dates; retained storage is O(D + P), with P mounted panes. Navigation lookup uses sorted-date positions/maps. Rendering is bounded by one month and mounted panes, not vault size.

Measure a synthetic 10,000-note history and a create/rename burst during implementation. Require one rebuild per coalesced burst, no rebuild for content edits, no duplicate controls, and no continuing work after unload. Record actual timings on the test machine; investigate any visible pause before claiming the UI is responsive. Start synchronous with the bounded tree scan; add chunking only if measurement shows a main-thread stall. No worker, persistent cache, or speculative cache layers.

## Packaging and project conventions

Initial plugin ID: `daily-note-navigation`; display name: Daily Note Navigation. Build TypeScript to CommonJS `main.js` with esbuild, externalizing Obsidian. Supply Obsidian's exported Moment factory to the pure date helpers; tests supply their dev dependency. Do not bundle a second date library. Package `main.js`, `manifest.json`, and `styles.css`. Use npm with a lockfile and commands for dev, lint, typecheck, test, build, and a local package. Public publishing/CI release automation stays deferred as approved.

The user approved the standard versioning/docs approach (D1, option A). Use VERSION as the release source and synchronize package/manifest `x.y.z` values during build/versioning; keep any commit metadata out of manifest.version. PROGRESS.md owns project status, ROADMAP.md owns execution tasks, and TODOS.md is the inbox. Design and engineering records retain rationale rather than duplicating project status. Set up these conventions during initial implementation scaffolding; this review only records the approved choice.

At the user's additional request, reviewed official Obsidian policies, submission requirements, coding guidance, and lint rules; see [the compliance record](obsidian-plugin-guidelines.md). Implement its requirements alongside the feature: official `eslint-plugin-obsidianmd` recommended checks; root README and manifest; production build and bundle inspection; theme-aware scoped styles, safe DOM construction, lifecycle cleanup, and compatibility tests. A license must be selected before public distribution; this review does not choose one. No actual implementation has been certified.

Obsidian-specific exception to the approved generic versioning convention: release tags are exactly `x.y.z`, with no `v` prefix or build metadata, so they match manifest.version. Maintain `versions.json` for app compatibility; keep generated bundles out of source control and package them as release assets. The native dialog does not violate the inspected forbidden-elements lint rule. Use dynamic CSS custom properties for calculated placement and keep static styling in `styles.css`.

## NOT in scope

- Note creation, editing, templates, and backfills: navigation must stay read-only.
- Separate folder/date-format settings: reuse core Daily Notes configuration.
- Periodic Notes-only support and mobile: defer additional providers/platforms.
- Previews, full-text search, custom shortcut settings UI, and sidebar views: not part of the approved header navigator. Use Obsidian's standard Hotkeys settings for registered commands.
- Support claims for untested older Obsidian versions: start with the installed version.
- Community submission, public releases, and CI publishing: validate local installation first.

## Implementation sequence

1. Scaffold the small plugin and test/build tooling using the approved standard versioning/docs conventions. Keep app compatibility casts explicit and local. Prepare the durable fixture vault and repeatable local package/install/reload procedure before the first real-app check.
2. Implement settings normalization, recognition, index construction, and chronological navigation with behavior tests.
3. Implement idempotent per-pane header mounting, direct file opening, and cleanup. Verify the real header before expanding UI work.
4. Implement the calendar using the shared index and navigation function. Add the two missing commands through public command registration; test palette/hotkey invocation alongside grid/keyboard behavior and actual dialog checks.
5. Run the complete acceptance checks in the prepared durable fixture vault, then run the user's old-note retrieval and missing-day examples. Document tested versions and install/reload commands.

Sequential implementation is recommended: these small modules share one integration contract, and separate workspaces would add coordination without a useful independent delivery lane. Conductor owns branch/workspace lifecycle.

## References

- [Approved design](../designs/daily-note-navigation.md), especially lines 19–25, 33–45, and 59–63.
- [Obsidian API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts): public file/pane/lifecycle APIs and deferred views.
- [Obsidian CLI](https://obsidian.md/help/cli): read-only eval probes and later developer verification tools.
- [Obsidian manifest](https://docs.obsidian.md/Reference/Manifest): required fields and x.y.z version format.
- [Obsidian load-time guidance](https://docs.obsidian.md/plugins/guides/load-time): defer initialization until layout readiness.
- [Daily Notes interface settings](https://github.com/liamcain/obsidian-daily-notes-interface/blob/master/src/settings.ts) and [parser](https://github.com/liamcain/obsidian-daily-notes-interface/blob/master/src/parse.ts): evaluated but not reused.
- [Native date input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date): min/max/step constraints.
- [WAI date-picker pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/): keyboard and focus reference, not a shipped component.
- [Vitest guide](https://vitest.dev/guide/): planned TypeScript test tooling.
- [Obsidian command registration](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Commands.md) and [Hotkeys](https://obsidian.md/help/hotkeys): standard command-palette and configurable-shortcut integration.
- [Core Daily Notes behavior](https://obsidian.md/help/plugins/daily-notes): core Today can create a missing note, so the existing-only command is distinct.

## Review disposition and implementation authorization

The completed Claude Code review is preserved in `daily-note-navigation-outside-review.md`. It originally produced four P2 remedies and one optional P3 simplification. E1 was approved as D2 option A. E2's speculative approval gate was withdrawn after the user's challenge. The subsequent user instruction to commit the planning baseline and implement authorizes routine execution choices within the approved scope: E3's target revalidation and E4's prerequisite ordering implement existing requirements; E5's optional replacement algorithm is not adopted. These are not recorded as additional A/B answers. There are no outstanding product or scope decisions blocking implementation.

| ID | Finding | Assessment / proposed remedy |
| --- | --- | --- |
| E1 | Test environment did not specify Obsidian module substitution or Moment version parity | Approved D2 A. Minimal test-only Obsidian stub and Moment 2.30.1 dev dependency, alongside runtime factory injection and required real-app checks. |
| E2 | Possible interaction between calendar keyboard events and the app keymap | Withdrawn as a decision gate after the user's challenge. No plugin exists and no conflict was demonstrated. Command shortcuts use Obsidian's settings; ordinary calendar focus/event behavior is verified during implementation. No added scope requirement is adopted. |
| E3 | Target identity across a dirty index/settings change was underspecified | Execution detail under the user's implement instruction: carry direction/date intent, refresh dirty state before resolving a target, and cancel an action whose originating configuration or pane changed. Register file listeners after layout readiness. This enforces the approved revalidation outcome. |
| E4 | Real-app checks appeared before fixture-vault installation was scheduled | Prerequisite ordering corrected under the user's implement instruction: prepare the fixture vault and installation procedure before header/calendar checks. |
| E5 | Optional recognition simplification | Keep the approved explicit format validation and defensive ambiguity handling. Do not substitute sampled-date heuristics. No added scope. |

## Implementation Tasks

- [ ] **T1 — Scaffold and local tooling.** Create the TypeScript build, official lint configuration, runtime-faithful test harness, version/doc conventions, and durable test-vault install procedure. Source: packaging, E1, E4, guidelines audit. Verify clean install, typecheck, lint, tests, production packaging.
- [ ] **T2 — Settings, recognition, and index.** Implement the guarded core-settings adapter, complete-date validation, canonical full-path recognition, chronological index, and coalesced invalidation. Source: recognition and performance review. Verify date families, folder boundaries, invalid settings, gaps, locale, and event bursts.
- [ ] **T3 — Header and navigation.** Mount per-pane controls, restore native headers, and open only current existing files in the originating leaf with pending/generation guards. Source: compatibility/failure review and E3. Verify two panes, pinned/deferred views, replaced DOM, stale/deleted targets, and unload.
- [ ] **T4 — Calendar.** Implement the anchored one-month picker, month/year navigation, existing-only selection, accessible focus/keyboard behavior, and disposal. Source: approved UI and keyboard acceptance criteria. Verify leap dates, missing days, year input, native dialog, main/pop-out windows, and themes.
- [ ] **T5 — Commands.** Add the picker and existing-today entries through Obsidian command registration without default bindings; preserve core previous/next. Source: user's palette/hotkey addition. Verify availability, execution revalidation, reading mode, and assigned shortcuts.
- [ ] **T6 — Acceptance and handoff.** Run targeted automated and real-app tests, inspect production assets, measure the synthetic history, document limitations, and reconcile all implementation criteria. Source: acceptance plan and guidelines audit. Carry any human-only retrieval verification explicitly into the implementation handoff.

Sequential implementation, no parallelization opportunity. Add compact inline flow comments at the settings/index/action coordinator and per-pane cleanup boundaries. No additional TODO scope is proposed. Ordinary implementation choices follow the approved outcomes; any behavior reduction requires a user decision.

Review completion: scope preserved with user-added command integration; architecture, code quality, tests, performance, reuse, exclusions, data-flow diagram, and failure handling reviewed. Five outside findings assessed; zero critical unhandled gaps and zero unresolved scope decisions. Outside coverage applies to the original plan; the user-added compliance/command sections received local review. Actual implementation and verification remain to be done.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| CEO Review | Not invoked | Scope and strategy | 0 | Not run | Not needed to resolve this bounded navigator |
| Outside Review | Claude Code via plan-eng-review | Independent plan challenge | 1 | Completed | Five original findings dispositioned; later user additions locally reviewed |
| Eng Review | /plan-eng-review | Architecture, code quality, tests, performance | 1 | Complete for implementation | Scope preserved; routine execution details resolved by implement authorization |
| Design Review | Not invoked | Detailed UI review | 0 | Not run | Approved office-hours wireframe exists |
| DX Review | Not invoked | Developer experience | 0 | Not run | Build/test setup described in draft |

OUTSIDE COVERAGE: Claude Code completed the original plan-review phase. Full output and provider-reported model usage are retained. The later user-requested guideline audit and command/hotkey addition have been reviewed locally but not by that outside pass. No implementation review or tests have run.

VERDICT: Planning baseline ready to commit and implement under the user's explicit instruction. This is not an implementation or release verification.

NO UNRESOLVED DECISIONS
