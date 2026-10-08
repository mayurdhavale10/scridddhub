-- Inputs for the indicative FSI band (UDCPR 2020, Table 6-G): which kind of planning authority
-- the parcel falls under, and the width of the road it takes access from.
ALTER TABLE due_diligence_reports
    ADD COLUMN planning_authority text CHECK (planning_authority IN
        ('municipal_corporation', 'other', 'regional_plan_no_pa', 'mumbai', 'cidco_naina')),
    ADD COLUMN road_width_m numeric(5, 1) CHECK (road_width_m > 0);
