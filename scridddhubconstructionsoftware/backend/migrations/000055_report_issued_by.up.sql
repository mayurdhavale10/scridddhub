-- Who issued a report on ScridddHub's side (required for a Quick Screen, which has no advocate;
-- recorded as the preparer on a Full report). The advocate's own sign-off stays in advocate_name.
ALTER TABLE due_diligence_reports ADD COLUMN issued_by text;
