-- Official source registry for the planned-infrastructure pipeline (migration 000030/000031,
-- PIPELINE_PLAN.md task T3.1). Idempotent.
-- Apply: docker exec -i scridddhubconstructionsoftware-postgres-1 psql -U scridddhub -d scridddhub < backend/seeds/infrastructure_sources.sql
--
-- Rules: official agency domains only; robots.txt checked per domain; blocked/disallowed sources
-- are listed with enabled = false rather than worked around.
--
-- MMRDA — checked 2026-09-27
--   robots.txt (https://mmrda.maharashtra.gov.in/robots.txt): "User-agent: *" disallows only
--   /core/, /profiles/, /admin/, /search/, /user/*, /node/add/, /comment/reply/, README files —
--   project pages under /en/projects/ are allowed.
--   Project pages taken from the site's own projects menu (transport + infrastructure). Deliberately
--   NOT registered: the /en/projects index (its menu links every MMRDA project, incl. non-transport
--   ones like e-waste and landscaping), studies (Comprehensive Transport Study, UMMTA), the
--   training institute, the memorial, C&D waste, and the Marathi duplicates of English pages.
-- Other agencies (MMRCL, CIDCO, MSRDC, NHAI, BMC, MRVC, NHSRCL): not yet researched — next step.

INSERT INTO infrastructure_sources (agency, url, kind, enabled, robots_status, project_hint) VALUES
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-1/overview', 'project_page', true, 'allowed', 'Metro Line 1'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-2A/overview', 'project_page', true, 'allowed', 'Metro Line 2A'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-2b/overview', 'project_page', true, 'allowed', 'Metro Line 2B'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-4/overview', 'project_page', true, 'allowed', 'Metro Line 4'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-4-A/metro-line-4', 'project_page', true, 'allowed', 'Metro Line 4A'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-5/overview', 'project_page', true, 'allowed', 'Metro Line 5'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-6/overview', 'project_page', true, 'allowed', 'Metro Line 6'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-7/overview', 'project_page', true, 'allowed', 'Metro Line 7'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-9/overview', 'project_page', true, 'allowed', 'Metro Line 9'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-12/overview', 'project_page', true, 'allowed', 'Metro Line 12'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/mumbai-monorail/overview', 'project_page', true, 'allowed', 'Mumbai Monorail'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/mumbai-trans-harbour-link/overview', 'project_page', true, 'allowed', 'Mumbai Trans Harbour Link'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/mumbai-trans-harbor-link%E2%80%93metro-link/overview', 'project_page', true, 'allowed', 'MTHL Metro Link'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/transport/mumbai-urban-transport-project-ii/overview', 'project_page', true, 'allowed', 'MUTP II'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/infrastructure/sahar-elevated-road/overview', 'project_page', true, 'allowed', 'Sahar Elevated Road'),
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/en/projects/infrastructure/background', 'project_page', true, 'allowed', 'Orange Gate Marine Drive Tunnel'),
    -- Official geodata: MMRDA's own Metro Line 5 KML (17 station placemarks).
    ('MMRDA', 'https://mmrda.maharashtra.gov.in/sites/default/files/2025-03/metro_line-5.kml', 'geodata', true, 'allowed', 'Metro Line 5')
ON CONFLICT (url) DO UPDATE SET
    agency = EXCLUDED.agency, kind = EXCLUDED.kind, enabled = EXCLUDED.enabled,
    robots_status = EXCLUDED.robots_status, project_hint = EXCLUDED.project_hint, updated_at = now();
