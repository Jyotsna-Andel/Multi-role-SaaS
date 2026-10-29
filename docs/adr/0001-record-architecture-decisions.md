# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** [CONTEXT.md](../CONTEXT.md) §6 (reviewer, future maintainers)

## Context

This is an assessed project: the reviewer evaluates not just *what* was built but *why*. Decisions about
auth, tenancy and consistency are easy to make implicitly and hard to reconstruct later. Future sessions
(human or AI assistant) also need to know which odd-looking choices are deliberate.

## Decision

We will record significant decisions as numbered ADRs in `docs/adr/` using the Nygard format
(Context / Decision / Consequences / Alternatives). Accepted ADRs are not edited except for their status
line; changes are made by a superseding ADR. The index lives in [README.md](README.md).
[PROGRESS.md](../PROGRESS.md) tracks status and links to ADRs instead of duplicating them.

## Consequences

**Positive** — reviewers can trace each requirement to its reasoning; decisions survive context loss.
**Negative** — small writing overhead per decision.
**Follow-ups** — `/new-adr` skill and a CLAUDE.md rule so new decisions get recorded.

## Alternatives considered

| Option | Why not |
|---|---|
| Decision table inside PROGRESS.md | No room for context/consequences; history gets overwritten |
| Code comments only | Scattered; cross-cutting decisions have no single home |
