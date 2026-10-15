-- A parcel can span several survey numbers (Varap: 42/3 and 42/4/2), each with its own 7/12.
-- land_records was one row per parcel; it becomes one row per parcel and survey number.
-- survey_key is the survey number reduced to digits and hissa letters, as domain.SurveyKey does
-- ("45/2/अ" → "452A"), so "42/4/2" and "४२/४/२" are the same row.
ALTER TABLE land_records ADD COLUMN survey_key text;

UPDATE land_records
SET survey_key = regexp_replace(
    upper(translate(data->>'survey_number', '०१२३४५६७८९अबकडइ', '0123456789ABCDE')),
    '[^0-9A-Z]', '', 'g');

ALTER TABLE land_records ALTER COLUMN survey_key SET NOT NULL;
ALTER TABLE land_records DROP CONSTRAINT land_records_land_parcel_id_key;
ALTER TABLE land_records ADD CONSTRAINT land_records_parcel_survey_key UNIQUE (land_parcel_id, survey_key);
