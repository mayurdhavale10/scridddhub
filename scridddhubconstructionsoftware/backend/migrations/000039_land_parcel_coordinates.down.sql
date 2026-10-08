ALTER TABLE land_parcels
    DROP CONSTRAINT IF EXISTS land_parcels_coordinates_together,
    DROP COLUMN IF EXISTS location_set_at,
    DROP COLUMN IF EXISTS location_source,
    DROP COLUMN IF EXISTS longitude,
    DROP COLUMN IF EXISTS latitude;
