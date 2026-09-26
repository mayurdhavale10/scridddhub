-- Screen 4.2 (Add Parcel, Estimate Flow) needs to save a parcel with no price at all — someone
-- just scouting a location, not entering a real deal. cost_rupees was NOT NULL from the original
-- migration; that assumption no longer holds.
ALTER TABLE land_parcels ALTER COLUMN cost_rupees DROP NOT NULL;

-- Same flow marks area as optional too (may not be known yet at the scouting stage). Enforced at
-- the domain layer: area is still required whenever cost_rupees is set (a priced deal needs an
-- area to make sense of that price elsewhere in the app).
ALTER TABLE land_parcels ALTER COLUMN area_acres DROP NOT NULL;

-- Source: where the builder found out about this parcel (broker, online listing, referral, a
-- field survey, etc.) — provenance metadata, not something that drives business logic, so a free
-- text column is enough rather than a CHECK-constrained enum.
ALTER TABLE land_parcels ADD COLUMN source TEXT;
