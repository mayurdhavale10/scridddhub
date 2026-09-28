-- More layers (2026-09-28): existing stations, expressway exits and airports; parks and malls;
-- cemeteries, crematoria and quarries; mangroves, forest land and protected areas.
-- The kinds are shared with planned projects (domain.InfraKindCategory), so the CHECK grows too.
ALTER TABLE infrastructure_projects DROP CONSTRAINT infrastructure_projects_kind_check;
ALTER TABLE infrastructure_projects ADD CONSTRAINT infrastructure_projects_kind_check CHECK (kind IN (
    -- connectivity
    'metro', 'suburban_rail', 'high_speed_rail', 'highway', 'road', 'bridge', 'flyover', 'airport', 'bus_depot', 'jetty',
    'rail_station', 'metro_station', 'expressway_exit',
    -- social
    'school', 'college', 'hospital', 'park', 'mall',
    -- jobs
    'it_park', 'sez', 'industrial_estate', 'logistics_park', 'data_centre', 'growth_centre', 'new_town',
    -- utilities
    'water_supply', 'sewage_treatment', 'power_substation',
    -- planning
    'dp_reservation', 'tod_zone', 'crz_zone', 'eco_sensitive_zone', 'mangrove', 'forest', 'protected_area',
    -- negative
    'landfill', 'high_tension_line', 'polluting_industry', 'flood_zone', 'cemetery', 'quarry',
    'other'
));

ALTER TABLE osm_place_cache DROP CONSTRAINT osm_place_cache_query_group_check;
ALTER TABLE osm_place_cache ADD CONSTRAINT osm_place_cache_query_group_check CHECK (query_group IN (
    'connectivity', 'social', 'amenities', 'jobs', 'utilities', 'negative', 'protected'
));

-- The negative query now also finds cemeteries, crematoria and quarries: drop cached answers so
-- they're fetched again.
DELETE FROM osm_place_cache WHERE query_group = 'negative';
