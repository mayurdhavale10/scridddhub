DELETE FROM infrastructure_official_domains WHERE domain IN ('midcindia.org', 'mahatransco.in');
DELETE FROM osm_place_cache WHERE query_group = 'jobs';
ALTER TABLE osm_place_cache DROP CONSTRAINT osm_place_cache_query_group_check;
ALTER TABLE osm_place_cache ADD CONSTRAINT osm_place_cache_query_group_check
    CHECK (query_group IN ('social', 'utilities', 'negative'));
