Original prompt: Using the TypeSafe skill, explore the project and find opportunities for using intelligent judgement to stand in for complex parsing or other fragile code. Continue the full report repairs with a Jev-routed subagent choosing the model and reasoning effort for each task.

# Current repair checkpoint

The Jev routing report is local at `.agents/jev-opportunity-review/ROUTING_REPORT.md`. This branch contains work in progress on deterministic command parsing, event matching, transcript provenance, legacy command compilation, bilingual review, and an opt-in contextual intent boundary. The browser game still runs offline by default.

Verification at checkpoint `296ad19`: `npm test` passed 63 tests, including the 199-turn walkthrough; Python discovery passed 15 tests. The later fixes were independently reviewed and rechecked.

The initial review findings have been addressed locally after checkpoint `296ad19`:

- Direct English object commands, filename prompts, and `i`/`l`/`z` work in the legacy CLI. Model commands still require a reliable scene vocabulary, which the CLI cannot currently supply; this remains a deliberate integration stop.
- `The Wabe` is recognized; `Arborvitaes` remains explicitly ambiguous without more evidence. Parsed descriptions preserve CRLF source bytes and have content-based frame IDs.
- The bilingual extractor now reads directly concatenated literals and single-line bilingual pairs. Same-owner identical text is grouped under one ID with all occurrences. Dynamic combinations and interpolated templates remain out of scope.
- The contextual intent scaffold is opt-in and has adversarial unit tests. Independent review found and verified fixes for clarification turns, alias shadowing, and unsupported mutable state containers. It must not be enabled in the static browser without a safe external key boundary and an explicit product decision.

Browser playtest: the skill Playwright client loaded the offline game without console errors, and a separate browser interaction went from Palace Gate to Flower Walk and successfully executed `take the ball`. The screenshot was visually inspected. No live provider call occurred.

Independent final review found no blocking issue in the local repairs. Final checks: `npm test` 67/67, Python discovery 24/24, `npm run verify` passed; the original 199-turn walkthrough remains green. The Jev bilingual request passed a local dry run without a live API call. Remaining integration limits: no live selector semantic evaluation and no reliable dfrotz scene vocabulary for complex Chinese commands.
