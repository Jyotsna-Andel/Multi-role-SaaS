# ADR-0011: Plain CSS with design tokens, no UI framework

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G7 · [CONTEXT.md](../CONTEXT.md) §1 (architecture over features)

## Context

The UI needs to look clean and work in light/dark mode and on mobile, but the brief does not assess visual
design. Every dependency and build step adds setup and review surface.

## Decision

One stylesheet, [globals.css](../../apps/web/src/app/globals.css): color/radius/shadow **tokens** as CSS
variables on `:root`, redefined under `prefers-color-scheme: dark`, plus a small set of utility classes
(`.card`, `.btn`, `.badge-*`, `.table-wrap`…). No Tailwind, CSS-in-JS or component library.

## Consequences

**Positive** — zero config; tiny bundle; theme changes in one place; reviewers read standard CSS.
**Negative** — no ready-made accessible components (modal focus trapping is basic); styling scales poorly if the UI grows a lot.
**Follow-ups** — adopt Tailwind or a component library (e.g. Radix/shadcn) if the UI becomes a focus; supersede this ADR then.

## Alternatives considered

| Option | Why not |
|---|---|
| Tailwind CSS | Extra config; class-heavy markup distracts reviewers from the architecture |
| Component library (MUI, shadcn) | Heavier dependencies; unnecessary for ~6 screens |
