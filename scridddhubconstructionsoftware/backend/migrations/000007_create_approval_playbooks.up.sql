-- Reference data, not user-generated — seeded here from the Maharashtra sequence in the
-- wireframe's Screen 7 mockup. NOT independently verified against real RERA/municipal
-- regulations yet — this is prototype content, and per project standing rules must be checked
-- against a real domain expert or official source before this is treated as legally reliable for
-- an actual developer. Flagging here so this doesn't quietly get treated as verified later.
CREATE TABLE approval_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state TEXT NOT NULL,
    sequence_order SMALLINT NOT NULL,
    approval_name TEXT NOT NULL,
    description TEXT,
    -- One of: '' (always required), 'near_airport', 'coastal_site', 'significant_tree_cover',
    -- 'uses_groundwater' — matches usecase.SiteCharacteristics field names. Required only when
    -- the named characteristic is true for the parcel.
    applicability_condition TEXT NOT NULL DEFAULT '',
    UNIQUE (state, sequence_order)
);

INSERT INTO approval_playbooks (state, sequence_order, approval_name, description, applicability_condition) VALUES
    ('Maharashtra', 1, 'Land Use / Zoning Clearance', NULL, ''),
    ('Maharashtra', 2, 'Environmental NOC', NULL, ''),
    ('Maharashtra', 3, 'Layout / Plan Sanction', NULL, ''),
    ('Maharashtra', 4, 'Airport Authority Clearance', NULL, 'near_airport'),
    ('Maharashtra', 5, 'CRZ Clearance', NULL, 'coastal_site'),
    ('Maharashtra', 6, 'Tree Felling NOC', NULL, 'significant_tree_cover'),
    ('Maharashtra', 7, 'Groundwater Extraction NOC', NULL, 'uses_groundwater'),
    ('Maharashtra', 8, 'Commencement Certificate', 'permission to start construction', ''),
    ('Maharashtra', 9, 'BOCW Registration', 'Building & Other Construction Workers Act - mandatory, 10+ workers', ''),
    ('Maharashtra', 10, 'RERA Project Registration', NULL, ''),
    ('Maharashtra', 11, 'Fire NOC', NULL, ''),
    ('Maharashtra', 12, 'Water Supply Connection NOC', NULL, ''),
    ('Maharashtra', 13, 'Electricity Connection NOC', NULL, ''),
    ('Maharashtra', 14, 'Sewage / Drainage NOC', NULL, ''),
    ('Maharashtra', 15, 'Completion Certificate', 'construction finished - not the same as Commencement', ''),
    ('Maharashtra', 16, 'Occupancy Certificate', 'required before possession', '');
