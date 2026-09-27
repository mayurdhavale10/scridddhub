-- More official sources beyond MMRDA (PIPELINE_PLAN.md step 3). Idempotent.
-- Apply after infrastructure_sources.sql, the same way.
--
-- Checked 2026-09-27 with the app's User-Agent. Registered only where robots.txt allows it and the
-- page is readable HTML without a bot challenge.
--
-- MSRDC   robots.txt "User-agent: *" with no Disallow. Pages are ASP.NET WebForms (whole body in
--         one <form>) — readable since fetch.HTMLToText stopped skipping <form>. Project list -> category sub-lists
--         (ProjectSubListView.aspx?ID=) -> projects (ProjectListDetails.aspx?ID=&MainId=); the
--         pipeline follows both levels (llm.linkRules["msrdc.in"]).
-- NHSRCL  robots.txt 404 (nothing disallowed). Mumbai–Ahmedabad high-speed rail: overview and
--         the station list (BKC, Thane, Virar, Boisar in MMR).
-- MSETCL  robots.txt 404. Investment plan page — DISABLED: the HTML is only a Marathi title and
--         menus (440 chars); the plan itself is a PDF, which pipeline v1 can't read.
--
-- Not registered, and why:
--   CIDCO      pages default to Marathi (non-Latin names are skipped); its English pages are
--              found per area by the on-demand search instead.
--   MIDC       investor information and a GIS portal; no per-estate pages. Existing named
--              industrial areas come from OpenStreetMap (Jobs & growth group).
--   MJP        no project pages on its site (schemes are on an external dashboard).
--   MMRCL      home page is a 4 KB bot-challenge shell.
--   NHAI       home page is a 4.5 KB JavaScript app with no readable content.
--   NMMC, MRVC menus rendered by JavaScript; no project links in the HTML.
--   KDMC, TMC  only citizen-service portals (CitizenHome.html).

INSERT INTO infrastructure_sources (agency, url, kind, enabled, robots_status, project_hint) VALUES
    ('MSRDC', 'https://msrdc.in/site/common/ProjectListView.aspx', 'project_index', true, 'allowed', ''),
    ('NHSRCL', 'https://nhsrcl.in/project-overview.aspx', 'project_page', true, 'allowed', 'Mumbai Ahmedabad High Speed Rail'),
    ('NHSRCL', 'https://nhsrcl.in/bullet-train-stations.aspx', 'project_page', true, 'allowed', 'Mumbai Ahmedabad High Speed Rail'),
    ('MSETCL', 'https://www.mahatransco.in/information/details/Investment_Plan', 'project_page', false, 'allowed', '')
ON CONFLICT (url) DO UPDATE SET
    agency = EXCLUDED.agency, kind = EXCLUDED.kind, enabled = EXCLUDED.enabled,
    robots_status = EXCLUDED.robots_status, project_hint = EXCLUDED.project_hint, updated_at = now();
