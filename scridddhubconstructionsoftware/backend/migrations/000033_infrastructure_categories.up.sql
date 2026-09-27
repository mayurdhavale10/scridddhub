-- Planned infrastructure is more than transport (owner decision 2026-09-27): every project belongs
-- to one of six groups, and the allowed kinds cover all of them.
--   connectivity — metro, rail, roads, bridges, airports, bus depots, jetties
--   social       — schools, colleges, hospitals
--   jobs         — IT parks, SEZs, industrial estates, logistics parks, data centres, growth centres, new towns
--   utilities    — water supply, sewage treatment, power substations
--   planning     — rules on the land itself: DP reservations, TOD zones, CRZ / eco-sensitive zones
--   negative     — landfills, high-tension lines, polluting industry, flood zones
ALTER TABLE infrastructure_projects
    ADD COLUMN category TEXT NOT NULL DEFAULT 'connectivity'
        CHECK (category IN ('connectivity', 'social', 'jobs', 'utilities', 'planning', 'negative'));

ALTER TABLE infrastructure_projects DROP CONSTRAINT infrastructure_projects_kind_check;
ALTER TABLE infrastructure_projects ADD CONSTRAINT infrastructure_projects_kind_check CHECK (kind IN (
    -- connectivity
    'metro', 'suburban_rail', 'high_speed_rail', 'highway', 'road', 'bridge', 'flyover', 'airport', 'bus_depot', 'jetty',
    -- social
    'school', 'college', 'hospital',
    -- jobs
    'it_park', 'sez', 'industrial_estate', 'logistics_park', 'data_centre', 'growth_centre', 'new_town',
    -- utilities
    'water_supply', 'sewage_treatment', 'power_substation',
    -- planning
    'dp_reservation', 'tod_zone', 'crz_zone', 'eco_sensitive_zone',
    -- negative
    'landfill', 'high_tension_line', 'polluting_industry', 'flood_zone',
    'other'
));

CREATE INDEX idx_infrastructure_projects_category ON infrastructure_projects (category);
