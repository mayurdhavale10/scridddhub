-- The actual listing/portal link backing up Source — makes it a checkable fact instead of just a
-- label (e.g. the 99acres/MagicBricks URL, or a DP portal reservation reference). Optional: not
-- every source (a broker phone call, a field survey) has a link.
ALTER TABLE land_parcels ADD COLUMN source_url TEXT;
