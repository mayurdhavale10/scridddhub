-- Land records fetched once and reused (docs/design/land-records-acquisition.md).
-- record_requests: lookups waiting for a person to type the captcha on the official site; the app
-- fills everything else. record_cache: the page text and the reading of each fetched record,
-- keyed by the LAND (district + taluka + village + survey key), not by any one parcel or report.

CREATE TABLE record_requests (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind          text NOT NULL DEFAULT '7_12' CHECK (kind IN ('7_12')),
    district      text NOT NULL,
    taluka        text NOT NULL,
    village       text NOT NULL,
    survey_number text NOT NULL,
    survey_key    text NOT NULL,             -- domain.SurveyKey, e.g. '452A'
    status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'fetched', 'not_found', 'skipped')),
    note          text NOT NULL DEFAULT '',
    land_parcel_id uuid REFERENCES land_parcels(id) ON DELETE SET NULL,
    requested_by  text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX record_requests_land ON record_requests (kind, lower(district), lower(taluka), lower(village), survey_key);
CREATE INDEX record_requests_queue ON record_requests (status, lower(district), lower(taluka), created_at);

CREATE TABLE record_cache (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind          text NOT NULL DEFAULT '7_12' CHECK (kind IN ('7_12')),
    district      text NOT NULL,
    taluka        text NOT NULL,
    village       text NOT NULL,
    survey_number text NOT NULL,
    survey_key    text NOT NULL,
    raw_text      text NOT NULL,             -- the page's text as fetched
    parsed        jsonb NOT NULL,            -- domain.SevenTwelve as read (a draft until a person confirms it on a parcel)
    read_by       text NOT NULL,
    source_url    text NOT NULL,
    fetched_by    text NOT NULL,
    fetched_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX record_cache_land ON record_cache (kind, lower(district), lower(taluka), lower(village), survey_key);
