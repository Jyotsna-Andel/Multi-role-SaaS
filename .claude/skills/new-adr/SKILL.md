---
name: new-adr
description: Create the next Architecture Decision Record in docs/adr/ (Nygard format), update the ADR index, and mark any superseded ADR. Use when a significant or hard-to-reverse decision is made — auth, tenancy, data integrity, caching, dependencies, cross-app structure — or when asked to record/document a decision.
---

# Record an architecture decision

Read `docs/adr/README.md` (when to write one, statuses) and `docs/adr/0000-template.md` first.

1. **Number** — next free 4-digit number after the highest `docs/adr/NNNN-*.md`. File name: `NNNN-kebab-case-title.md`, title in imperative form ("Use X for Y").
2. **Fill the template** with today's absolute date, status `Accepted` (or `Proposed` if the user hasn't agreed yet), deciders, and related goal IDs from `docs/CONTEXT.md` §3.
   - *Context*: the forces and constraints, neutral, no solution.
   - *Decision*: "We will…", key mechanics, links to the actual code (relative paths from `docs/adr/`).
   - *Consequences*: positive **and** negative/costs **and** follow-ups — be honest about trade-offs.
   - *Alternatives*: at least two real options with why-not.
   - Verify every number or mechanism you state against the code (grep for it).
3. **Superseding** — if this replaces an earlier ADR, set the old one's status line only: `Superseded by [ADR-NNNN](NNNN-….md)`. Never rewrite an accepted ADR's body.
4. **Index** — add a row to the table in `docs/adr/README.md`; update the old row's status if superseded.
5. **Tracker** — add/update the one-line row in the Decisions table of `docs/PROGRESS.md`.
6. **Rules** — if the decision creates a rule every future change must follow, add it to `CLAUDE.md` (Architecture rules / Do / Don't).
7. Check links: every relative link in the new ADR must resolve to an existing file.
8. Tell the user the ADR number, the one-line decision, and the main trade-off.
