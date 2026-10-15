-- Back to one 7/12 per parcel: keeps the most recently confirmed one for each parcel.
DELETE FROM land_records a
USING land_records b
WHERE a.land_parcel_id = b.land_parcel_id AND a.confirmed_at < b.confirmed_at;

ALTER TABLE land_records DROP CONSTRAINT land_records_parcel_survey_key;
ALTER TABLE land_records ADD CONSTRAINT land_records_land_parcel_id_key UNIQUE (land_parcel_id);
ALTER TABLE land_records DROP COLUMN survey_key;
