# 0002. Audit trail is enforced at the middleware/repository layer, not per-handler

## Context

The wireframed product (Screen 8.11) commits to an audit trail that "cannot be disabled" — every
edit to escrow balances, certification drafts, payment records, and possession-date estimates
must be logged: who, what field, old value, new value, timestamp. This maps to a real, current
legal requirement (MCA Companies (Accounts) Rules, Rule 3(1) proviso, effective 1 April 2023),
not just a product nicety.

If audit logging is something each handler is supposed to remember to call, it will eventually
be forgotten on some new endpoint, and the guarantee becomes false without anyone noticing until
an audit or a dispute exposes the gap.

## Decision

Audit logging is enforced centrally, not opt-in per handler:

1. Every write to a domain entity goes through the `repository` layer — no handler or usecase
   writes to the database directly.
2. The repository layer's write methods wrap every mutation in the same transaction as an
   `AuditLogEntry` insert. A repository write that doesn't produce an audit entry is a bug in the
   repository implementation, not a missing call site.
3. The database role the application connects as has no `UPDATE`/`DELETE` grant on the
   `audit_log` table — only `INSERT`. This makes "cannot be disabled" true at the infrastructure
   level, not just true because the application code currently behaves.

## Consequences

- New entities require their repository to implement the shared "write + audit" pattern before
  they can be considered done — this becomes a checklist item in code review, not optional
  polish.
- Slightly more ceremony to add a new mutable entity. Accepted, because the alternative is an
  audit trail that quietly has gaps.
- Read paths are unaffected — this only applies to writes.
