DELETE FROM osm_place_cache WHERE query_group IN ('connectivity', 'amenities', 'protected');
ALTER TABLE osm_place_cache DROP CONSTRAINT osm_place_cache_query_group_check;
ALTER TABLE osm_place_cache ADD CONSTRAINT osm_place_cache_query_group_check
    CHECK (query_group IN ('social', 'jobs', 'utilities', 'negative'));

UPDATE infrastructure_projects SET kind = 'other'
WHERE kind IN ('rail_station', 'metro_station', 'expressway_exit', 'park', 'mall', 'mangrove', 'forest',
               'protected_area', 'cemetery', 'quarry');
ALTER TABLE infrastructure_projects DROP CONSTRAINT infrastructure_projects_kind_check;
ALTER TABLE infrastructure_projects ADD CONSTRAINT infrastructure_projects_kind_check CHECK (kind IN (
    'metro', 'suburban_rail', 'high_speed_rail', 'highway', 'road', 'bridge', 'flyover', 'airport', 'bus_depot', 'jetty',
    'school', 'college', 'hospital',
    'it_park', 'sez', 'industrial_estate', 'logistics_park', 'data_centre', 'growth_centre', 'new_town',
    'water_supply', 'sewage_treatment', 'power_substation',
    'dp_reservation', 'tod_zone', 'crz_zone', 'eco_sensitive_zone',
    'landfill', 'high_tension_line', 'polluting_industry', 'flood_zone',
    'other'
));
