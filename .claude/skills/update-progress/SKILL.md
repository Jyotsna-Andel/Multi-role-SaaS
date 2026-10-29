---
name: update-progress
description: Update docs/PROGRESS.md at the end of a unit of work — requirement status, new decisions with their reasons, and known limitations. Use after finishing a feature, fix or session, or when asked where the project stands.
---

# Update the progress tracker

File: `docs/PROGRESS.md`. Keep it factual and short; it is read by humans and by future Claude sessions.

1. Set **Last updated** to today's date (absolute, YYYY-MM-DD).
2. **Requirement status** — flip ⏳ → ✅ only when verified (typecheck/build passed and `npm run demo` is 0 failed, or the specific check was run). Put the evidence in the row (e.g. "✅ 46/46 passing"). Add rows for new features with their code location.
3. **Decisions** — for every significant choice made in this session, run `/new-adr` (don't write decisions into PROGRESS.md). Then add a one-line row for it to the **Decisions** summary table, linking the ADR. If an ADR was superseded, update its row.
4. **Known limitations / next ideas** — remove items that were completed; add shortcuts taken or follow-ups discovered.
5. If a new rule or gotcha emerged that every future session must know, also add it to the Do / Don't / Gotchas sections of `CLAUDE.md`.
6. Tell the user in 2–3 lines what changed in the tracker.
