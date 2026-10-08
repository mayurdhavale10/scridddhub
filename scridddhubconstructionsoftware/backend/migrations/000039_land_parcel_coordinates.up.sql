-- Where the parcel actually is (docs/design/parcel-location-first-principles.md, layer 1).
-- Land in India has no street address, so free-text geocoding is a guess (Godrej Hill, Khadakpada
-- resolved to Khadakpada's centre, 1–2 km off). The person adding the parcel knows where it is:
-- they drop a pin, use GPS on site, or paste a Google Maps link.
ALTER TABLE land_parcels
    ADD COLUMN latitude DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION,
    -- How the coordinates were obtained, most to least precise.
    ADD COLUMN location_source TEXT CHECK (location_source IN ('pin', 'gps', 'maps_link', 'village', 'text')),
    ADD COLUMN location_set_at TIMESTAMPTZ,
    ADD CONSTRAINT land_parcels_coordinates_together CHECK (
        (latitude IS NULL AND longitude IS NULL AND location_source IS NULL)
        OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND location_source IS NOT NULL)
    );
