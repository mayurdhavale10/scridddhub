DROP INDEX IF EXISTS idx_mh_villages_name_trgm;
-- Not dropping the pg_trgm extension itself — other objects may come to depend on it, and
-- extensions aren't scoped to this one feature.
