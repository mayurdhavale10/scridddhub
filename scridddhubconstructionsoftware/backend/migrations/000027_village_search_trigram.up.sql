-- Fuzzy village-name search (docs/adr/0006 follow-up). Real users type colloquial spellings
-- (e.g. "Khadakpada") that differ from the government's canonical spelling (e.g. "Kakadpada") —
-- a plain prefix match misses these entirely. pg_trgm's similarity() lets us rank close spellings
-- instead of requiring an exact prefix.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_mh_villages_name_trgm ON mh_villages USING gin (name gin_trgm_ops);
