ALTER TABLE land_parcels
    DROP CONSTRAINT IF EXISTS land_parcels_closed_price_positive,
    DROP COLUMN IF EXISTS district,
    DROP COLUMN IF EXISTS taluka,
    DROP COLUMN IF EXISTS village,
    DROP COLUMN IF EXISTS closed_price_rupees,
    DROP COLUMN IF EXISTS closed_at;
