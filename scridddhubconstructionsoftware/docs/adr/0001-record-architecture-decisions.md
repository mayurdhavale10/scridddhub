# 0001. Record architecture decisions

## Context

As this system grows, decisions get made about structure, tooling, and trade-offs. Without a
record, new contributors (including future-us) re-litigate settled questions or, worse, don't
know a question was ever settled.

## Decision

We will use Architecture Decision Records, one per significant decision, numbered sequentially
in `docs/adr/`. Each ADR is short — context, decision, consequences — and fits on one page.

A decision is "significant" if reversing it later would mean real rework: choice of language,
database, auth strategy, how a cross-cutting rule (like the audit trail) gets enforced. Routine
implementation choices don't need an ADR.

## Consequences

- Every ADR after this one follows the same three-section format.
- ADRs are immutable once accepted — a changed decision gets a new ADR that supersedes the old
  one, not an edit to history.
