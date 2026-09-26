ALTER TABLE land_parcels DROP CONSTRAINT land_parcels_stage_check;
ALTER TABLE land_parcels ADD CONSTRAINT land_parcels_stage_check
    CHECK (stage IN ('sourced', 'screened', 'dd'));
