-- Canonical Maharashtra administrative geography (docs/adr/0006, services/estimatedparcelvalue).
-- Source: the real, public "Common Village Master" API run by Maharashtra's own Department of
-- Land Records (http://115.124.105.220/API/...), NOT scraped from any commercial site — this is
-- the government's own published district/taluka/village directory with official codes,
-- confirmed live (45 districts, 358 talukas, 44,918 villages — matches the state's own published
-- figures). See services/estimatedparcelvalue/pipeline/raw_data/ for the raw JSON snapshots this
-- was seeded from.
--
-- Reference/master data, same category as ready_reckoner_rates and approval_playbooks —
-- deliberately not wrapped in ADR-0002's audit trail (not a business entity a user edits).
--
-- Real-world discovery, worth recording: the same village that this API spells "Kakadpada" was
-- spelled "Kakadapada" on the e-ASR portal and "Khadakpada" in this app's own earlier free-text
-- entry — exactly the entity-resolution problem this table exists to fix, by giving every real
-- place one stable government code instead of competing free-text strings.
CREATE TABLE mh_districts (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_local TEXT
);

CREATE TABLE mh_talukas (
    district_code TEXT NOT NULL REFERENCES mh_districts(code),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_local TEXT,
    PRIMARY KEY (district_code, code)
);

CREATE TABLE mh_villages (
    district_code TEXT NOT NULL,
    taluka_code TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_local TEXT,
    PRIMARY KEY (district_code, taluka_code, code),
    FOREIGN KEY (district_code, taluka_code) REFERENCES mh_talukas(district_code, code)
);

CREATE INDEX idx_mh_villages_name ON mh_villages (name);
