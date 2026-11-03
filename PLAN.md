**TypeDash implementation plan**

Status: phases 1–5 complete; awaiting approval to start phase 6. Prepared November 2, 2026; phases 1–5 completed November 3, 2026.

Build TypeDash, a standalone application that reproduces Monkeytype's core typing experience: a quiet interface, immediate character feedback, accurate timing, smooth caret movement, and useful results. The typing engine, test modes, results, local progress, themes, settings, and interaction polish are complete. Deliverables and validation are recorded in the phase handoffs under `docs/`, most recently [docs/phase-5.md](./docs/phase-5.md). Performance and release validation remain.

Use `TypeDash` as the display name and `typedash` as the package name and project identifier.

Monkeytype's official [feature overview](https://github.com/monkeytypegame/monkeytype#readme) establishes the reference experience. The scope and engineering decisions below are proposals for this project, rather than a promise of complete feature parity.

**1. First-release scope**

| Area | First release | Follow-up |
| --- | --- | --- |
| Test modes | Time: 15, 30, 60, 120 seconds. Words: 10, 25, 50, 100 words. Default: 30 seconds. | Quote, custom text, zen, custom durations and counts. |
| Text generation | Bundled English word list, punctuation and number toggles, no immediate repeated word. | More languages and larger word lists; content provenance recorded for every dataset. |
| Typing | Character states, missing and extra letters, backspace, word submission, focus overlay, smooth caret, restart. | Configurable difficulty, stop-on-error, practice missed words, pace caret. |
| Results | WPM, raw WPM, accuracy, elapsed time, character breakdown, speed graph, retry and new test. | Consistency, sharing, detailed practice analysis. |
| Preferences | Dark and light themes, font size, caret animation, live stats visibility, reduced motion. | Custom themes, sounds, additional caret styles and command palette. |
| Progress | Latest 100 completed results and personal bests per comparable configuration, stored locally. | Local history filters and progress analysis. |

Product constraint for every release: no login, signup, accounts, authentication, profiles, or cloud sync. Keep progress personal and local; public leaderboards are outside the scope. The application runs as a static site without an application backend.

Speed is a release requirement: the page should become usable quickly, typing feedback should appear immediately, and restarting should not require a page reload or network request. Validate the budgets below against the production build.

**2. Technical foundation**

- Use React, strict TypeScript, and Vite for a static single-page app. Vite provides an official [React and TypeScript template](https://vite.dev/guide/).
- Use CSS variables for theme tokens and CSS modules for component styling. Bundle a licensed monospace font locally to keep text measurements stable.
- Keep the typing engine in framework-independent TypeScript. Use a reducer for test transitions and a small React adapter for input, timing, focus, and rendering; React documents this pattern in its [reducer guide](https://react.dev/learn/extracting-state-logic-into-a-reducer).
- Use native browser input events and a real, focusable textarea positioned with the typing area. Render the prompt separately. Avoid `contenteditable`, which adds browser-dependent editing behavior.
- Use versioned local storage for preferences and the bounded result history. Keep storage validation, migrations, and error recovery in a small local repository module.
- Render the initial speed chart as an SVG with axes, hover values, and an accessible text summary. The small dataset does not require a charting library.
- Use [Vitest](https://vitest.dev/guide/) for engine and scoring tests, and [Playwright](https://playwright.dev/docs/intro) for real-browser flows across Chromium, Firefox, and WebKit.
- At setup, choose compatible stable dependency versions, check their Node requirements, and commit one lockfile. Use npm and expose `dev`, `build`, `lint`, `typecheck`, `test`, and `test:e2e` scripts.

Performance requirements:

- Keep initial JavaScript at or below 100 KB gzip and total initial assets at or below 200 KB compressed, including the default font and English word list. Load history and detailed charts on demand; prefetch result code after the typing screen is ready.
- Process input immediately, without debounce or network calls. Update only the active word, caret, and affected counters; avoid rerendering the whole application or rescanning the complete prompt on every keypress.
- Update scoring incrementally and refresh displayed aggregate stats at most 10 times per second. Keep input correctness and deadline checks independent of the display refresh rate.
- Keep only nearby prompt lines mounted. Cache character positions and invalidate measurements after wrapping, font readiness, or resizing; batch layout reads before writes to prevent repeated synchronous layout work.
- Keep storage writes, history serialization, and chart rendering outside input handling. Show the result summary first, then perform persistence and secondary rendering. Keep caret animations short and interruptible so they never delay character feedback.
- Deploy the static build on Vercel, with hashed assets cached and HTML able to pick up new releases. Bundle the default word list and font locally; starting or restarting a test must work with no additional fetches after initial readiness.

Proposed layout:

```text
src/
  app/                    application shell and view navigation
  components/             shared buttons, dialogs and accessible controls
  features/
    typing/
      engine/             state, actions, input rules, clock, metrics, generator
      components/         toolbar, prompt, caret, live stats, focus overlay
      hooks/              React input and timing adapters
    results/              result summary, speed chart and retry controls
    settings/             preference controls and theme selection
    history/              result list and personal bests
  data/                   word lists and content attribution
  lib/storage/            schema validation, migrations and repositories
  styles/                 font assets, reset, tokens and themes
tests/
  fixtures/               deterministic input traces and scoring expectations
  e2e/                    browser flows and visual checks
```

**3. Typing behavior and engine contract**

Model test status explicitly: `ready → running → finished`. Restart, configuration changes, and new tests return to `ready`. Focus and dialog visibility are separate UI state; losing focus does not pause an active test.

- Store a snapshot of the configuration, generated text and seed, word index, typed word buffers, input-attempt counters, timestamps, and timeline samples for each test.
- Normalize DOM events into engine actions such as `INSERT`, `DELETE_BACKWARD`, `DELETE_WORD_BACKWARD`, `SUBMIT_WORD`, `TICK`, and `RESTART`. Pass time into the engine so tests do not depend on actual waiting.
- Start on the first accepted printable character, including an incorrect character. Modifier keys, empty backspace, focus, and leading spaces do not start a test.
- Compare input with the active target word. Show pending, correct, incorrect, extra, and missed characters. Space submits a nonempty word; early submission marks the remaining target characters as missed. Ignore repeated spaces on an empty word.
- Support backspace within the current word and returning to a previous incorrect word. Correct submitted words stay locked in the initial release. Word deletion shortcuts must have the same scoring semantics as repeated deletion.
- Finish word mode when the final word is submitted, or as soon as its full text matches the target. Finish time mode at its deadline even if the user stops typing. Ignore further input after completion.
- Use `performance.now()` and an absolute deadline. UI ticks only refresh the display; they must not decrement the authoritative clock. Finalize expired tests before accepting another input event.
- Keep generating a bounded look-ahead buffer in timed mode. Retain logical word history while rendering only nearby lines, so fast typists cannot exhaust the prompt or create unbounded DOM work.
- Blur the prompt when focus leaves the input and show a click-to-focus message. The clock continues; opening a dialog during a test does not create a free pause.
- Restart clears the old clock, input buffer, samples, and counters. "Retry same text" reuses the seed; "New test" generates a new seed. Abandoned tests do not enter completed history.
- Handle composition events once per committed insertion. Do not interpret composing keystrokes as separate text. English is the first-release content scope; additional language support requires grapheme-aware fixtures.
- Reject paste and drop in the test input; allow ordinary editing in settings and future custom-text forms. Disable autocorrect, spellcheck, and automatic capitalization for test input.
- Use native Tab navigation. Provide a focused restart button reachable with Tab and activated with Enter; scope shortcuts to the test area and preserve browser shortcuts.

In phase 1, compare short input traces against Monkeytype for early spaces, backtracking, final-word completion, and timeout during a partial word. Record intended matches and any deliberate differences before implementing the engine.

**4. Scoring contract**

Monkeytype describes WPM using correctly typed words, raw speed including incorrect words, and accuracy using input attempts in its [official development site's statistics documentation](https://dev.monkeytype.com/about). Use these definitions as the starting point, then freeze exact edge cases in fixtures.

For this project's initial contract:

- `elapsedMinutes = elapsedMilliseconds / 60000`. For a timed test, use the configured duration when the deadline expires, regardless of when the browser next paints.
- `WPM = creditedCharacterUnits / 5 / elapsedMinutes`. Credit exact completed words and their separating spaces. At a timed cutoff, credit the active word's typed prefix only if every typed character matches and there are no extra characters; record this rule explicitly in compatibility fixtures.
- `raw WPM = retainedTypedCharacterUnits / 5 / elapsedMinutes`. Include retained incorrect and extra characters and submitted separators. Exclude deleted characters and untyped target text.
- `accuracy = correctInsertionAttempts / allInsertionAttempts × 100`. Count accepted spaces as insertion attempts and early separators as incorrect attempts. Deletion does not remove earlier errors from this calculation. Ignore navigation, modifier keys, and rejected input.
- Compute final correct, incorrect, extra, and missed counts from the final word buffers. In time mode, do not count untouched future words or the untyped suffix of the unfinished active word as missed. These positional counts are separate from the accuracy counters.
- Retain full precision internally and round only for display. Show no speed before positive elapsed time; never emit `NaN` or infinity. Do not persist zero-duration or empty results.
- Sample at one-second boundaries, plus the final partial interval. Plot cumulative WPM and interval raw speed with error markers. Keep final raw WPM as a whole-test average and label chart tooltips so the distinction is clear.

Example fixture: target `cat dog`, elapsed 30 seconds, final input `cat dog` gives 2.8 WPM and 2.8 raw WPM. If the user first inserts `x` instead of `d`, deletes it, and then finishes correctly, accuracy is 7/8 = 87.5%; final speed and character counts remain the same.

Consistency is deferred until its sampling and mapping rules have their own specification; do not add an approximate metric under the same label.

**5. Interface and persistence**

Build the main screen around a centered, width-limited layout: compact wordmark and navigation, a mode toolbar, a small language indicator, roughly three visible prompt lines, a restart control, and keyboard hints. Use a dark gray background, muted pending text, bright completed text, a yellow accent, and red error feedback for the default theme. Treat the [upstream default configuration](https://raw.githubusercontent.com/monkeytypegame/monkeytype/master/frontend/src/ts/constants/default-config.ts) as a reference; the clone's defaults remain explicitly defined here.

- During typing, fade secondary controls and keep the active line visible. Position the caret from measured character bounds and update after font loading, wrapping, resizing, and scrolling. Animate with transforms and respect reduced-motion preferences.
- Replace the prompt with the result summary and speed chart after completion. Include test configuration, character counts, personal-best status, retry, and new-test controls.
- Provide working settings and history views. Do not add navigation controls for features that have not been implemented.
- Use a distinct TypeDash wordmark and track font, icon, and dataset attribution as assets are introduced.
- Ensure keyboard access, visible focus, labeled icon buttons, focus restoration from dialogs, and error cues that do not depend on color alone. Announce start and completion to assistive technology; do not announce every keystroke or timer tick.
- Support narrow screens down to 360 px without horizontal page overflow. Let the toolbar wrap and handle mobile viewport changes; validate software-keyboard input on actual mobile browsers before claiming mobile typing parity.

Persist `Preferences` with a schema version and defaults. Persist each `TestResult` with an ID, creation timestamp, configuration snapshot, seed, duration, final metrics, timeline, and scoring version. Use one idempotent completion operation so repeated renders cannot save duplicate results.

Key personal bests by mode, duration or word count, language and word-list version, punctuation, numbers, and scoring version. A best score survives pruning the latest-100 history. Keep same-text retries labeled separately from fresh-test bests. Recover from malformed or unavailable storage by falling back to defaults and in-memory operation; show a concise message when saving is unavailable.

**6. Phased implementation and approval workflow**

The user requires approval before starting every phase. Planning updates do not authorize implementation. Ask before phase 1 and wait for explicit approval; approval applies only to the named phase. After completing a phase, finish its checks and fixes, report the deliverables and validation results, update its status here, and ask before starting the next phase. Do not advance automatically. If scope materially changes, explain the change before seeking approval for the affected phase.

| Phase | Deliverables | Completion gate | Status |
| --- | --- | --- | --- |
| 1. Foundation and UI shell | Scaffold React/TypeScript/Vite, npm scripts, linting and test tooling. Add TypeDash branding, theme tokens, a locally bundled monospace font, and a responsive test-screen shell. Define engine types, reference behavior traces, scoring fixtures, and an initial bundle-size baseline. | Development server and production build work; lint and type checks pass; the shell is reviewable at narrow and wide widths; behavior decisions and performance budgets are documented. Typing functionality belongs to phase 2. | Complete; see docs/phase-1.md |
| 2. Core typing experience | Implement deterministic English text generation, character feedback, word submission, backspace, absolute timing, a basic result summary, and restart for a 30-second test. Connect the engine to the input and prompt. | A user can start, complete, inspect accurate scores, and repeat a test; hand-calculated scoring and deadline fixtures pass; one browser flow verifies the complete interaction. | Complete; see docs/phase-2.md |
| 3. Test modes and controls | Add 15/30/60/120-second tests, 10/25/50/100-word tests, punctuation, numbers, timed prompt extension, same-text retry, focus handling, and restart cleanup. | Every preset completes correctly; configuration changes reset safely; long tests do not exhaust the prompt; focus recovery and repeated restarts work. | Complete; see docs/phase-3.md |
| 4. Results and local progress | Add timeline sampling, the SVG speed chart, character breakdown, settings persistence, the latest-100 result history, and personal bests per compatible configuration. | Results save once and survive reload; bests compare compatible tests; malformed or blocked storage recovers gracefully; persistence stays outside input handling. | Complete; see docs/phase-4.md |
| 5. Themes and interaction polish | Finish light/dark themes, font-size and live-stat controls, caret and line scrolling, settings/history views, keyboard navigation, reduced motion, and narrow layouts. | Ready, typing, blurred, results, settings, and history states pass visual and keyboard review; first-release preference controls work; no login or account UI is present. | Complete; see docs/phase-5.md |
| 6. Performance and Vercel readiness | Profile and optimize loading, typing, and restarts against the budgets. Run cross-browser flows and production-build smoke tests, configure Vercel deployment, and document setup and release steps. Perform available mobile checks and record actual-device verification separately. | Automated release checks and performance budgets pass; the production build is ready for Vercel; any remaining real-device checks or deployment access requirements are clearly recorded. Publishing requires explicit authorization. | Not started; requires approval |

Implement phases sequentially, with a functioning end-to-end test in phase 2 before expanding settings or secondary pages. Fix issues within the approved phase before declaring it complete. Keep future releases in section 8 outside these six phases unless the user expands scope. Target Vercel deployment while keeping the static output portable.

**7. Verification and release criteria**

- Engine tests cover first-key start, exact deadline, an idle finish, early spaces, wrong and extra letters, corrected errors, backtracking, final-word completion, prompt extension, same-seed retry, and rejected input. Verify metrics with independent, hand-calculated fixtures.
- Clock tests inject timestamps to cover delayed ticks, background-tab throttling, and input arriving after the deadline. Verify restart and unmount remove callbacks and event listeners.
- Browser flows cover complete time and word tests, configuration changes, focus loss and recovery, dialog keyboard behavior, repeated restarts, preferences after reload, duplicate-save prevention, and corrupted or blocked storage.
- Capture deterministic visual states at 360 px, 768 px, and 1440 px, including multiline errors and long extra input. Verify caret placement after resize and font readiness. Run the core flows in Chromium, Firefox, and WebKit.
- Profile a sustained fast-typing trace on a recorded 60 Hz reference desktop. Require input processing at or below 4 ms and input-to-visible-feedback at or below 32 ms at the 95th percentile. The handler measurement alone does not establish visible-feedback latency; verify that separately with browser traces. Listener count and rendered prompt size must remain bounded across long tests and repeated restarts.
- Require restart-to-ready at or below 100 ms at the 95th percentile on the same reference machine, including after the history reaches its 100-result cap. Verify no fetch is needed to begin the next test.
- On a cold-cache production preview, target largest contentful paint at or below 1.5 seconds and a usable typing input within 2 seconds. Use a documented Fast 4G network profile and 4x CPU slowdown, record the browser and hardware, and take the median of five runs. Check the compressed asset budgets on every production build.
- Pass lint, TypeScript checks, engine tests, browser tests, and the production build. Smoke-test the built app, not only the development server.
- A new visitor can immediately complete and repeat a test; see explained scores; retain settings and recent results after reload; and operate all first-release features with the keyboard.
- The interface contains no login, signup, or account controls. All typing, settings, history, and personal-best features work without authentication or an application backend.

**8. Follow-up releases**

1. Add quote and custom modes with validated text normalization and source attribution; add missed-word practice and more language datasets.
2. Add advanced preferences, command palette, sounds, and consistency after defining their behavior and accessibility requirements.
3. Add local history filters and progress analysis while preserving the browser-only storage model.

The user approved phase 5 with "implement next phase" after the phase 4 handoff. Phase 5 is complete. Ask for explicit approval before starting phase 6; release work and publishing are not authorized yet.
