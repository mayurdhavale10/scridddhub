-- The survey/gat number (with hissa, e.g. "45/2A") identifies the land on the 7/12. With
-- district, taluka and village it's what every land record lookup needs, so ordering a
-- Due-Diligence Report requires all four (services/duediligencereport/README.md).
ALTER TABLE land_parcels ADD COLUMN survey_number text;
