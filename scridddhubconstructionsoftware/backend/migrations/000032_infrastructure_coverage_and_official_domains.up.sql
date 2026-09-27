-- Step C (on-demand fallback) + Step D (scheduled runs): services/plannedinfrastructure/PIPELINE_PLAN.md.

-- Which areas have been searched for infrastructure, so an area with nothing nearby isn't
-- searched again on every visit ("searched, nothing found" is itself an answer). An area is a
-- ~5 km grid cell (lat/lng rounded to 0.05°), keyed like "19.25,73.15".
CREATE TABLE infrastructure_coverage (
    cell TEXT PRIMARY KEY,
    place_name TEXT NOT NULL,           -- the resolved place that first triggered it
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'searching', 'searched', 'failed')),
    requested_count INT NOT NULL DEFAULT 1,
    first_requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_searched_at TIMESTAMPTZ,
    sources_found INT NOT NULL DEFAULT 0,
    projects_found INT NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX idx_infrastructure_coverage_queue ON infrastructure_coverage (status, last_requested_at);

-- Allowlist for discovery: a searched-for URL is only registered as a source if its host is one
-- of these (exact host or a subdomain of it). Search finds candidates; only official pages are
-- ever fetched and verified.
CREATE TABLE infrastructure_official_domains (
    domain TEXT PRIMARY KEY,            -- e.g. 'mmrda.maharashtra.gov.in', or 'gov.in' for any subdomain
    agency TEXT NOT NULL,               -- label used for sources found on it
    note TEXT NOT NULL DEFAULT ''
);

INSERT INTO infrastructure_official_domains (domain, agency, note) VALUES
    ('mmrda.maharashtra.gov.in', 'MMRDA', 'Mumbai Metropolitan Region Development Authority'),
    ('cidco.maharashtra.gov.in', 'CIDCO', 'City and Industrial Development Corporation'),
    ('msrdc.in', 'MSRDC', 'Maharashtra State Road Development Corporation'),
    ('mmrcl.com', 'MMRCL', 'Mumbai Metro Rail Corporation (Metro Line 3)'),
    ('nhsrcl.in', 'NHSRCL', 'National High Speed Rail Corporation'),
    ('mrvc.indianrailways.gov.in', 'MRVC', 'Mumbai Railway Vikas Corporation'),
    ('nhai.gov.in', 'NHAI', 'National Highways Authority of India'),
    ('mcgm.gov.in', 'BMC', 'Brihanmumbai Municipal Corporation'),
    ('gov.in', 'Government of India / Maharashtra', 'any other *.gov.in government site'),
    ('nic.in', 'Government (NIC)', 'government sites hosted by the National Informatics Centre')
ON CONFLICT (domain) DO NOTHING;
