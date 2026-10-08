-- The geocoder's type for each match ("suburb", "village", "building", "road"...). The locator
-- uses it to reject buildings that merely share a name: "Sabarmati, Maharashtra" matched a
-- building called Sabarmati in Anushakti Nagar and put a Gujarat station inside Mumbai
-- (2026-09-29).
ALTER TABLE geocode_cache ADD COLUMN place_type TEXT;

-- The locator's cached answers have no type yet; drop them so they're fetched again with one.
-- Only locator keys ("<name>, maharashtra"); parcel-location lookups are left alone.
DELETE FROM geocode_cache WHERE query LIKE '%, maharashtra';
