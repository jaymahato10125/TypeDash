**TypeDash behavior contract — scoring version 1**

Phase 1 defined the contract. Phase 2 implements it in the framework-independent engine. Follow the phase approval workflow in `PLAN.md`.

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

**Metrics**

`minutes = elapsedMs / 60000`. WPM uses five-character units: `creditedUnits / 5 / minutes`. Credit only exact submitted words plus their successful separating spaces. At a timed cutoff, credit the complete retained active word or its prefix only when all retained letters match the target and there are no extra letters.

Raw WPM is `retainedUnits / 5 / minutes`: retained letters and submitted nonterminal separators, including incorrect and extra input, excluding deleted input. Accuracy is `correctInsertionAttempts / totalInsertionAttempts * 100`; deletion cannot erase a mistake. Prefix characters matched at insertion time count as correct attempts even if that word later becomes incorrect.

Character counts are positional: correct, incorrect, extra, and missed. Count retained separators according to the submission rule. Missed characters are the untyped suffixes of submitted words, never the untouched future prompt or the unsubmitted suffix at timeout. Thus character counts and attempt accuracy describe different things.

Before positive elapsed time, display no speed. Use zero for empty-attempt accuracy internally and display an unset value until insertion. Do not save empty or zero-duration results. Preserve full precision internally and round only displayed metrics. Initial fixtures in `tests/fixtures/scoring.ts` supply independent hand calculations; tests validate their arithmetic and replay the traces against the actual reducer. No results are persisted before the local-progress phase.

The interface currently exposes only the approved 30-second English configuration. The engine also verifies final-word completion using internal fixtures, ahead of exposing word-mode controls in phase 3. The generator can extend a timed prompt at the end of its initial buffer so even a very fast run can finish its full duration.

English words in `src/data/english.ts` are independently assembled for TypeDash. A stable indexed hash maps a seed and word offset to a word. Alternating disjoint pools prevent adjacent repeats, and independently generated batches preserve the same prefix. This is a reproducible practice generator, not a cryptographic or competitive challenge source.

The rendered prompt mounts at most 64 words near the active position. Previously completed word totals are cached; metrics only combine those totals with the active word, so individual keypresses do not rescan the complete run. Input handles Unicode code points, with English-only targets; full grapheme and multilingual behavior remains outside the first-release language scope.

**Covered Phase 2 edge traces**

First-key start; ignored leading Space; multiple inserts from composition; early submission; repeated Space; wrong and extra letters; correction preserving attempt errors; backtracking to an incorrect word; blocked crossing of correct words; word deletion; exact-deadline input; delayed UI tick; idle timeout; correct and incorrect unfinished prefixes; final-word completion; post-finish input; restart cleanup; and deterministic same-seed generation.
