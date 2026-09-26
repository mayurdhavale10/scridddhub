-- Shared, manually verified infrastructure reference list (migration 000028).
-- Apply: docker exec -i scridddhubconstructionsoftware-postgres-1 psql -U scridddhub -d scridddhub < backend/seeds/infrastructure_projects.sql
-- Idempotent: re-running updates existing rows by name.
--
-- Rule for this file: every fact must be on the source_url page itself. Press-only figures (e.g.
-- opening dates MMRDA doesn't publish) go in `description`, labelled as press, never in
-- expected_completion. Re-verify against the source and update verified_at/verified_by when you do.
--
-- 2026-09-26: both rows checked by Claude (AI) against MMRDA's own project pages (page data
-- "updated as on 31st August 2026"). verified_by records this internally (not shown in the UI);
-- the owner should re-check and replace it.

BEGIN;

INSERT INTO infrastructure_projects
    (name, kind, status, expected_completion, description, source_name, source_url, verified_at, verified_by)
VALUES
    ('Metro Line 12 (Kalyan–Taloja)', 'metro', 'under_construction', NULL,
     '23.57 km fully elevated, 19 stations via Kalyan, Dombivli MIDC, Kalyan Growth Centre, Wadavli, Turbhe, Pisarve, Taloja and Amandoot; interchange with Metro Line 5 at Kalyan. MMRDA progress as of 31 Aug 2026: piling 37%, U-girder erection 19%. MMRDA publishes no completion date; press reports late 2027 to mid 2028.',
     'MMRDA — Metro Line 12 project page',
     'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-12/overview',
     '2026-09-26T12:00:00+05:30', 'manual seed — Claude session 2026-09-26, awaiting owner review'),
    ('Metro Line 5 (Thane–Bhiwandi–Kalyan)', 'metro', 'under_construction', NULL,
     '24.9 km elevated, 15 stations from Balkum Naka via Bhiwandi to Kalyan Station and Kalyan APMC; interchange with Metro Line 4 and Metro Line 12. MMRDA progress as of 31 Aug 2026: listed civil works 100% complete, not yet operational. MMRDA publishes no opening date; press reports the Thane–Bhiwandi phase for Dec 2026 and the Kalyan stretch later.',
     'MMRDA — Metro Line 5 project page',
     'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-5/overview',
     '2026-09-26T12:00:00+05:30', 'manual seed — Claude session 2026-09-26, awaiting owner review')
ON CONFLICT (name) DO UPDATE SET
    kind = EXCLUDED.kind,
    status = EXCLUDED.status,
    expected_completion = EXCLUDED.expected_completion,
    description = EXCLUDED.description,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    verified_at = EXCLUDED.verified_at,
    verified_by = EXCLUDED.verified_by,
    updated_at = now();

-- Pipeline identity (migration 000030): agency + canonical_key must equal what
-- infrapipeline.CanonicalKey produces, so the pipeline updates these rows instead of duplicating them.
-- locked_fields: the hand-written descriptions carry curated notes (press dates, labelled as
-- press) that the pipeline must not overwrite.
UPDATE infrastructure_projects SET agency = 'MMRDA', canonical_key = 'mmrda:metro line 12', locked_fields = '{description}'
WHERE name = 'Metro Line 12 (Kalyan–Taloja)';
UPDATE infrastructure_projects SET agency = 'MMRDA', canonical_key = 'mmrda:metro line 5', locked_fields = '{description}'
WHERE name = 'Metro Line 5 (Thane–Bhiwandi–Kalyan)';

-- Areas served. Taluka names must match mh_talukas exactly. Only talukas whose stations are
-- clearly named on the source page are listed.
DELETE FROM infrastructure_project_areas
WHERE project_id IN (SELECT id FROM infrastructure_projects
                     WHERE name IN ('Metro Line 12 (Kalyan–Taloja)', 'Metro Line 5 (Thane–Bhiwandi–Kalyan)'));

INSERT INTO infrastructure_project_areas (project_id, district, taluka, note)
SELECT id, 'Thane', 'Kalyan', 'Kalyan, Dombivli MIDC and Kalyan Growth Centre stretch'
FROM infrastructure_projects WHERE name = 'Metro Line 12 (Kalyan–Taloja)'
UNION ALL
SELECT id, 'Raigad', 'Panvel', 'Pisarve, Taloja and Amandoot stretch'
FROM infrastructure_projects WHERE name = 'Metro Line 12 (Kalyan–Taloja)'
UNION ALL
SELECT id, 'Thane', 'Kalyan', 'Lal Chowki, Kalyan Station and Kalyan APMC stations'
FROM infrastructure_projects WHERE name = 'Metro Line 5 (Thane–Bhiwandi–Kalyan)'
UNION ALL
SELECT id, 'Thane', 'Bhiwandi', 'Dhamankar Naka, Bhiwandi and Temghar stretch'
FROM infrastructure_projects WHERE name = 'Metro Line 5 (Thane–Bhiwandi–Kalyan)'
UNION ALL
SELECT id, 'Thane', 'Thane', 'Balkum Naka station'
FROM infrastructure_projects WHERE name = 'Metro Line 5 (Thane–Bhiwandi–Kalyan)';

-- Located stations (migration 000029). Metro Line 5: all 17 station Placemarks from MMRDA's own
-- published KML, https://mmrda.maharashtra.gov.in/sites/default/files/2025-03/metro_line-5.kml
-- (downloaded 2026-09-26; labels cleaned of "(M) Station"). coord_source = official_file.
-- Metro Line 12: MMRDA publishes no station geodata, so it has no points and falls back to
-- taluka matching until stations are placed from a map (coord_source = manual).
DELETE FROM infrastructure_project_points
WHERE project_id = (SELECT id FROM infrastructure_projects WHERE name = 'Metro Line 5 (Thane–Bhiwandi–Kalyan)');

INSERT INTO infrastructure_project_points (project_id, label, kind, latitude, longitude, coord_source)
SELECT p.id, s.label, 'station', s.lat, s.lng, 'official_file'
FROM infrastructure_projects p,
(VALUES
    ('Kapurbawdi', 19.218042, 72.980643),
    ('Balkum Naka', 19.220853, 72.988592),
    ('Kasheli', 19.239844, 73.016358),
    ('Kalhar', 19.251814, 73.019526),
    ('Purna', 19.264678, 73.032815),
    ('Anjurphata', 19.274433, 73.042806),
    ('Dhamankar Naka', 19.287582, 73.054086),
    ('Bhiwandi', 19.293304, 73.059736),
    ('Gopal Nagar', 19.294454, 73.064573),
    ('Temghar', 19.281687, 73.074129),
    ('Rajnouli Village', 19.268677, 73.084077),
    ('Gove Gaon MIDC', 19.261601, 73.090116),
    ('Kon Gaon', 19.248077, 73.106445),
    ('Durgadi Fort', 19.246482, 73.122811),
    ('Sahajanand Chowk', 19.244614, 73.128399),
    ('Kalyan', 19.238883, 73.127673),
    ('APMC Kalyan', 19.235337, 73.122788)
) AS s(label, lat, lng)
WHERE p.name = 'Metro Line 5 (Thane–Bhiwandi–Kalyan)';

COMMIT;
