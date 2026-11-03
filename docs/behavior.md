**TypeDash behavior contract — scoring version 1**

Phases 1–3 established the engine and test controls. Phase 4 adds timeline sampling and browser-local progress. Follow the phase approval workflow in `PLAN.md`.

**Reference observations**

Reference: [Monkeytype](https://monkeytype.com/) and its [statistics documentation](https://dev.monkeytype.com/about). Observations were made in a fresh browser session on November 3, 2026 (India time), with the default English content and normal editing behavior. Observing behavior does not import the upstream implementation or assets.

| Trace | Observed reference behavior | TypeDash decision |
| --- | --- | --- |
| Early Space | With target `hand`, typing `h` and Space marks `hand` as an erroneous submitted word and advances to the next word. The typed `h` remains marked correct. | Allow nonempty early submission, mark untyped target characters missed, and count the premature separator as an incorrect attempt. |
| Backtracking | With target `down`, after submitting `d`, then inserting and deleting a wrong character in the next word, another Backspace can return to `down` and erase its retained character. | Crossing into a previous incorrect word deletes its final retained character; exact previously submitted words remain locked. Empty-word and word-deletion cases are covered by the engine tests. |
| Final word | A 10-word test completed after typing the exact generated text ending in `system`, without a trailing Space. Result visibility updated after the transition. | Finish word mode immediately when the final word exactly matches; otherwise allow nonempty final submission with Space. |
| Partial-word timeout | With target `change`, typing `ch` and then stopping for the 15-second test led to results without further input: 100% accuracy, `2/0/0/0` characters, and displayed WPM/raw rounded to 2. | Finalize on an idle deadline. Credit the correct active prefix, do not count the unfinished suffix as missed, and keep duration independent of UI refresh timing. |

Timeout behavior and detailed scoring should follow the explicit TypeDash rules below. The prototype intentionally omits upstream accounts, advertisements, leaderboards, AFK invalidation, and competitive result validation. Sample character totals and rounding are not a claim of numerical parity with every upstream setting.

**Input rules**

- Start only on the first accepted printable insertion. Wrong characters still start the clock. Ignore leading/repeated empty spaces, modifier keys, navigation, and empty backspace before starting.
- Read elapsed time from injected monotonic timestamps. A timestamp of `0` is a valid start; `null` means not started.
- Before any input mutation, finalize a time test whose deadline has arrived. At exactly the deadline, accept no further insertion or deletion. Use configured duration for final scoring even when the UI timer runs late.
- `INSERT` may contain several characters from one committed composition event. Process them in order, preserving the same event timestamp. Raw composing keystrokes are not insertions. English content is the initial scope.
- Reject test-input paste and drop. Keep browser shortcuts and normal Tab navigation available.
- Space submits a nonempty active word. It is a correct attempt only when the input exactly matches the target; otherwise it is an incorrect attempt. Count the retained separator in raw speed and positional character totals, with the same correct/incorrect classification.
- Backspace edits the active buffer. From an empty active word, it can cross to a prior incorrect word, remove its submitted separator, and delete its last retained character. It does not erase prior input-attempt history. It cannot cross a correctly submitted word. Ctrl/Option/Command + Backspace clears the active word; when that word is empty it crosses into one prior incorrect word and clears that buffer. Deleting an extra character removes its raw and positional units while retaining its original failed attempt.
- A time test continues after any correctly typed word. A word test completes on the exact last character of a correct final word, or when a nonempty final word is submitted with Space. A terminal Space is an insertion attempt but is not retained as a trailing separator, so it cannot inflate final raw or WPM units.
- Focus loss and dialogs do not pause time. Restart discards the active run and returns to `ready`; same-text retry reuses the seed. Abandoned runs are not completed results.
- A focus overlay blurs the prompt when the input loses focus or its window becomes inactive. Clicking the overlay or tabbing into the textarea restores input. Recovery checks the deadline before accepting more input; an expired timed test shows results. The overlay warns that an active test continues running.

**Modes and settings**

- Time presets are 15, 30, 60, and 120 seconds; the first-visit selection is 30 seconds. Word presets are 10, 25, 50, and 100 words; the first word-mode selection is 25. The selected configuration and each mode's latest length are saved locally and restored after reload.
- An actual mode, length, or modifier change discards the current run, creates a new seed, and clears counters, deadlines, input composition, and pending focus restoration. Clicking an already-selected mode or length leaves the run intact. Focus remains on the chosen setting so keyboard users can continue configuring it.
- Restart and New test create new text with the current configuration. Retry same text retains both the seed and the full configuration, including modifiers. Timed prompt extension uses those same modifier settings.
- Word mode has no time limit and shows submitted words out of its selected count. Its elapsed duration includes idle and unfocused time. It now samples idle time once per second for the graph; only timed tests have a completion deadline.
- Results show the completed run's mode, length, and modifiers. Word-test elapsed time uses one decimal place so short tests do not misleadingly display a whole zero seconds.

**Metrics**

`minutes = elapsedMs / 60000`. WPM uses five-character units: `creditedUnits / 5 / minutes`. Credit only exact submitted words plus their successful separating spaces. At a timed cutoff, credit the complete retained active word or its prefix only when all retained letters match the target and there are no extra letters.

Raw WPM is `retainedUnits / 5 / minutes`: retained letters and submitted nonterminal separators, including incorrect and extra input, excluding deleted input. Accuracy is `correctInsertionAttempts / totalInsertionAttempts * 100`; deletion cannot erase a mistake. Prefix characters matched at insertion time count as correct attempts even if that word later becomes incorrect.

Character counts are positional: correct, incorrect, extra, and missed. Count retained separators according to the submission rule. Missed characters are the untyped suffixes of submitted words, never the untouched future prompt or the unsubmitted suffix at timeout. Thus character counts and attempt accuracy describe different things.

Before positive elapsed time, display no speed. Use zero for empty-attempt accuracy internally and display an unset value until insertion. Do not save abandoned, empty, or zero-duration results. Preserve full precision for final scores and personal-best comparisons. Initial fixtures in `tests/fixtures/scoring.ts` supply independent hand calculations; tests validate their arithmetic and replay the traces against the actual reducer.

**Timeline and result inspection**

- Begin with a zero-speed point at elapsed time zero. Sample one-second boundaries and the final partial interval. Flush earlier boundaries before applying an input event, then apply an exact-boundary or final sample afterward, so delayed ticks do not backdate newly typed characters. If a tick and input share a timestamp, replace the boundary snapshot with the final state at that timestamp.
- Plot cumulative credited WPM and interval raw speed. Interval raw uses nonnegative retained-character gain since the previous sample; deletion can reduce that gain to zero. Overall raw WPM remains a whole-test average, so the final graph interval can be zero while the result's overall raw speed is positive.
- Graph error counts use incorrect insertion attempts, including errors later corrected. They are independent of the final positional character counts.
- Keep at most 300 timeline points. For word tests longer than roughly five minutes, increase the interval by powers of two and compact existing points. Compacted intervals recompute raw speed and errors from cumulative counters. A long delayed callback fills at most the bounded sample set, rather than iterating every missing second.
- Final metrics retain full precision. Persisted graph speeds are rounded to three decimals for compact storage; this does not affect scoring or best-score comparisons. History details use the stored graph without creating another result.
- The SVG graph supports pointer inspection and a keyboard slider with announced values. Error markers and dashed raw lines distinguish series beyond color. The graph measures its container so axis labels remain readable on narrow screens.

**Local progress and storage**

- Give every production run a new UUID at start/restart. A same-text retry reuses its seed and configuration but gets a new run ID and a retry label. Completion creates a snapshot with its ID, wall-clock completion timestamp, seed, configuration, scoring version, metrics, and timeline; monotonic time remains authoritative for speed.
- Queue completion once per run ID. The repository owns pending work across result-view unmounts, serializes after the first result paint, and flushes pending work before page exit. Duplicate effects cannot add another record or change the original completion receipt.
- Load preferences at startup. Load history on first inspection or completion. Preference writes depend on configuration changes, not keystrokes. Keep history, personal-best summaries, and their schema version in one atomic local-storage value; merge already-persisted data before a new completion write.
- Keep the latest 100 results in descending completion order. Preserve personal-best summaries separately when old result rows are pruned. Their full graphs leave history with their result rows; the best summaries remain available.
- Compare full-precision WPM only within matching mode, length, language, word-list version, punctuation, numbers, scoring version, and fresh/retry category. An exact WPM tie prefers higher accuracy; an equal score does not replace the existing best. Fresh-test bests and retry bests have visibly separate groups.
- `typedash.preferences` and `typedash.progress` introduce schema version 1; earlier phases did not persist a legacy format. Validate configs, metrics, ordered finite graph values, endpoints, IDs, and metadata. Recover malformed preferences with defaults, salvage valid history rows, and reconstruct bests from valid retained history when possible. Unknown newer envelopes stay untouched and changes remain in memory.
- If reading or writing browser storage fails, keep the app usable in memory and show a concise notice. A result says "Kept for this visit" instead of claiming it was saved. Clearing browser data removes local progress; no account, API, or backend is involved.

The interface exposes all eight presets and four punctuation/number combinations. The generator extends a timed prompt at the end of its initial buffer so even a very fast run can finish its full duration. The preset and option matrix is exercised in `tests/unit/modes.test.ts`, including long prompts that cross several generated batches.

English words in `src/data/english.ts` are independently assembled for TypeDash. A stable indexed hash maps a seed and word offset to a word. Alternating disjoint pools prevent adjacent repeats, and independently generated batches preserve the same prefix. This is a reproducible practice generator, not a cryptographic or competitive challenge source.

With punctuation enabled, each six-token group starts with a capital, has a comma after its third token, and ends with a seeded period, question mark, or exclamation mark. Capitalization and punctuation are part of the exact target. With numbers enabled, a seeded position in each seven-token group is replaced by a number from 10 through 9999. Applying these rules at absolute word offsets makes retries and extended batches deterministic; even a ten-word prompt includes the enabled modifiers. Both options can be combined.

The rendered prompt mounts at most 64 words near the active position. Previously completed word totals are cached; metrics only combine those totals with the active word, so individual keypresses do not rescan the complete run. Input handles Unicode code points, with English-only targets; full grapheme and multilingual behavior remains outside the first-release language scope.

**Covered engine edge traces**

First-key start; ignored leading Space; multiple inserts from composition; early submission; repeated Space; wrong and extra letters; correction preserving attempt errors; backtracking to an incorrect word; blocked crossing of correct words; word deletion; exact-deadline input; delayed UI tick; idle timeout; correct and incorrect unfinished prefixes; final-word completion; post-finish input; restart cleanup; and deterministic same-seed generation.
