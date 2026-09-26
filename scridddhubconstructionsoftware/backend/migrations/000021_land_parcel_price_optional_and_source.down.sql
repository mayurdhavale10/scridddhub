ALTER TABLE land_parcels DROP COLUMN source;
ALTER TABLE land_parcels ALTER COLUMN area_acres SET NOT NULL;
ALTER TABLE land_parcels ALTER COLUMN cost_rupees SET NOT NULL;
