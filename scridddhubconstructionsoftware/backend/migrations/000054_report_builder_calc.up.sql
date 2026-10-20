-- The builder's view of the land (residual land value) on a due-diligence report: the inputs our
-- team enters, with their sources (domain.BuilderCalcInputs). The result is worked out when the
-- report is composed, never stored, so it always matches the inputs.
ALTER TABLE due_diligence_reports ADD COLUMN builder_calc jsonb;
