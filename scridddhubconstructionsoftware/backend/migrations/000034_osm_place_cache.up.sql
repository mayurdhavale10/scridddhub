-- Existing places near a location (schools, hospitals, substations, landfills, sewage plants,
-- power lines) from OpenStreetMap via the Overpass API. One row per ~1 km grid cell and query
-- group; places hold every match within the group's radius of the cell centre plus the cell's
-- half-diagonal, and the request path filters them by true distance from the property.
-- Refreshed when older than 30 days. Data © OpenStreetMap contributors (ODbL).
CREATE TABLE osm_place_cache (
    cell        TEXT        NOT NULL,
    query_group TEXT        NOT NULL CHECK (query_group IN ('social', 'utilities', 'negative')),
    places      JSONB       NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cell, query_group)
);
