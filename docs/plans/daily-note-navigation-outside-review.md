# Independent engineering review

Provider: Claude Code. Completed 2026-09-16. Model usage reported claude-opus-5[1m] and claude-haiku-4-5-20251001.

This reviews the draft engineering plan, not plugin code. Recommendations remain pending individual user decisions. The runtime factory injection and removal of the bare Moment external were independently clarified in the draft before this response arrived; the remaining test alias and version-parity points still apply.

## Verbatim response

**Findings:** none are P1. Issues 1–4 must be fixed before implementation; issue 5 is an optional simplification.

1. **[P2] Build and tests don't say how Moment and `obsidian` resolve.** *Section: Testing; Packaging; "Bundled Moment" row.*
   - `obsidian` ships only types, so any module importing it fails under Vitest.
   - A dev-dependency Moment of a different version can pass strict-parse tests that Obsidian's copy fails.
   - **Remedy:**
     - Runtime code imports `moment` from `obsidian`.
     - `daily-notes.ts` receives Moment as a parameter and imports nothing from `obsidian`.
     - Alias `obsidian` to a small stub in the Vitest config.
     - Pin the dev `moment` to the version the app reports, using one more read-only `moment.version` probe.
     - Don't assume a bare `moment` external resolves in Obsidian's plugin loader until that's checked.

2. **[P2] Calendar keys aren't isolated from Obsidian's keymap.** *Section: Calendar and accessibility.*
   - Key events inside a native `dialog` still bubble to Obsidian's global hotkey handling.
   - User hotkeys, such as navigate back, can act on the underlying pane while the picker is open.
   - Escape handling may compete with the dialog's `cancel` event.
   - **Remedy:** push a `Scope` onto `app.keymap` while the picker is open and pop it in the single cleanup path. Stop propagation for keys the grid handles, and exempt the year input from grid bindings.

3. **[P2] Behavior after a detected change is unclear.** *Section: Settings, events, and index lifetime; Navigation.*
   - "Invalidate… before the action continues" plus "resolve the exact indexed path" lets previous/next open a target computed from the old snapshot or pre-rebuild index.
   - **Remedy:**
     - Pass intent (direction relative to the current file, or a date key), not a path.
     - Force a synchronous rebuild if the index is dirty, then recompute the target.
     - Abort and reconcile if the snapshot changed or the current file is no longer recognized.
     - Register vault create/delete/rename listeners inside `onLayoutReady`, because vault load emits `create` for every existing file.

4. **[P2] Real-app checks are scheduled before the setup they need.** *Section: Implementation sequence.*
   - Steps 3–4 require real header and dialog verification, but the fixture vault and install flow don't arrive until step 5.
   - **Remedy:** in step 1, create the durable fixture vault and a package → install → reload command. At the start of step 4, test `showModal` in Obsidian (main and pop-out windows) before building the grid. Cover the transparent backdrop, anchored placement, and Escape/Tab.

5. **[P3, optional] Recognition is over-built.** *Section: Recognition contract.*
   - **Duplicate-day ambiguity can't happen.** The canonical round-trip check means each date formats to exactly one path. Drop the ambiguity state, notice, and tests, and keep an assertion.
   - **Test the format's behavior instead of parsing its tokens.** Replace the handling of literals, escapes, and localized expansion with sample checks:
     - 00:00 and 23:59 of the same day must format identically.
     - Every day of a leap year and a non-leap year must format distinctly.
     - Those same dates shifted by 100 and 400 years must also stay distinct.
   - These checks reject `MM-DD`, `YY`, yearless weekday formats, and time-bearing formats without a hand-written Moment token parser.

Recommendation: revise the plan before implementation because issues 1–4 are cheap to fix now but would otherwise break the step-1 test setup, block the real-app checks in steps 3–4, and let stale state drive pane navigation.
