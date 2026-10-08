-- Shared government reference data, not user-entered or pooled private deals.
CREATE TABLE transaction_source_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    source_reference TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
    raw_text TEXT,
    file_path TEXT,
    CHECK (raw_text IS NOT NULL OR file_path IS NOT NULL),
    UNIQUE (source, source_reference, content_hash)
);

CREATE TABLE registered_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_date DATE NOT NULL,
    document_no TEXT NOT NULL CHECK (btrim(document_no) <> ''),
    office_code TEXT NOT NULL CHECK (btrim(office_code) <> ''),
    office_name TEXT NOT NULL,
    registration_year INT GENERATED ALWAYS AS (extract(year FROM registration_date)::int) STORED,
    district_code TEXT NOT NULL,
    taluka_code TEXT NOT NULL,
    village_code TEXT NOT NULL,
    survey_no TEXT NOT NULL,
    property_type TEXT NOT NULL CHECK (property_type IN ('land','plot','flat','shop')),
    deed_type TEXT NOT NULL CHECK (deed_type IN ('sale','gift','partition','release','other')),
    area_acres NUMERIC NOT NULL CHECK (area_acres > 0 AND area_acres < 10000000),
    sale_price_rupees BIGINT NOT NULL CHECK (sale_price_rupees > 0),
    government_value_rupees BIGINT CHECK (government_value_rupees >= 0),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_method TEXT NOT NULL CHECK (location_method IN ('pin','survey_centre','village_centre','unknown')),
    comparable BOOLEAN NOT NULL DEFAULT false,
    exclusion_reason TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT NOT NULL CHECK (btrim(reviewed_by) <> ''),
    source TEXT NOT NULL,
    source_record_id UUID NOT NULL REFERENCES transaction_source_records(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (district_code,taluka_code,village_code) REFERENCES mh_villages(district_code,taluka_code,code),
    CHECK ((latitude IS NULL AND longitude IS NULL AND location_method = 'unknown') OR
           (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND location_method <> 'unknown')),
    UNIQUE (document_no,office_code,registration_year)
);
CREATE INDEX registered_transactions_dates ON registered_transactions(registration_date);
CREATE INDEX registered_transactions_village ON registered_transactions(district_code,taluka_code,village_code,registration_date);
CREATE INDEX registered_transactions_coords ON registered_transactions(latitude,longitude) WHERE comparable AND deed_type='sale' AND property_type IN ('land','plot');

-- A cache miss is not evidence of zero sales. Persist search outcomes independently.
CREATE TABLE transaction_search_coverage (
    search_key TEXT PRIMARY KEY,
    query JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('searching','searched','partial','failed','access_required')),
    message TEXT NOT NULL DEFAULT '',
    searched_at TIMESTAMPTZ,
    lease_until TIMESTAMPTZ,
    retry_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
