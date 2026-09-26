-- docs/domain-model.md abbreviated the pipeline as sourced|screened|dd, but the real Stitch
-- screen (5 — Parcel Detail & Feasibility) has a "Move to Negotiating" action, revealing a
-- 4th stage the original migration missed. Fixing at the source rather than working around it.
ALTER TABLE land_parcels DROP CONSTRAINT land_parcels_stage_check;
ALTER TABLE land_parcels ADD CONSTRAINT land_parcels_stage_check
    CHECK (stage IN ('sourced', 'screened', 'dd', 'negotiating'));
