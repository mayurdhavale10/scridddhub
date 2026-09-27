-- Existing named industrial areas (MIDC estates, large plants) from OpenStreetMap feed the
-- "Jobs & growth" group.
ALTER TABLE osm_place_cache DROP CONSTRAINT osm_place_cache_query_group_check;
ALTER TABLE osm_place_cache ADD CONSTRAINT osm_place_cache_query_group_check
    CHECK (query_group IN ('social', 'jobs', 'utilities', 'negative'));

-- Official agencies outside gov.in / nic.in that the on-demand area search may use
-- (checked 2026-09-27). MIDC's current site is midc.maharashtra.gov.in (covered by gov.in); its
-- older midcindia.org still hosts pages.
INSERT INTO infrastructure_official_domains (domain, agency, note) VALUES
    ('midcindia.org', 'MIDC', 'Maharashtra Industrial Development Corporation (older domain)'),
    ('mahatransco.in', 'MSETCL', 'Maharashtra State Electricity Transmission Co. — substations, lines')
ON CONFLICT (domain) DO NOTHING;
