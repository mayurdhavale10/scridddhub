-- Set only after a real reachability check against source_url succeeds (see
-- LandParcelUsecase.VerifySource) — never set on creation, never guessed.
ALTER TABLE land_parcels ADD COLUMN source_verified_at TIMESTAMPTZ;
