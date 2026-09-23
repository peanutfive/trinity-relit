# Current repair checkpoint

The Jev routing report is local at `.agents/jev-opportunity-review/ROUTING_REPORT.md`. This branch contains work in progress on deterministic command parsing, event matching, transcript provenance, legacy command compilation, bilingual review, and an opt-in contextual intent boundary. The browser game still runs offline by default.

Verification at this checkpoint: `npm test` passes 63 tests, including the 199-turn walkthrough; `python3 -m unittest discover -s tests -p 'test_*.py'` passes 15 tests. These passing tests do not close the review findings below.

Open review findings before treating these tools as complete:

- The legacy CLI has no reliable scene vocabulary wired into its main loop, so ordinary object commands are rejected. Save/restore filename prompts and `i`/`l`/`z` shortcuts also need compatibility handling.
- The transcript title map omits `The Wabe`; duplicate room names such as `Arborvitaes` need context-aware attribution, and CRLF byte spans need a verified representation.
- The bilingual extractor misses paired text split across adjacent JavaScript literals or single line breaks. Duplicate content IDs need room/event provenance so inserted copies cannot change earlier identities.
- The contextual intent scaffold is opt-in and has adversarial unit tests, but its final independent review and browser playtest are pending. It must not be enabled in the static browser without a safe external key boundary and an explicit product decision.

Next: fix the review findings, rerun structural and gameplay checks, then review the contextual intent boundary independently.
