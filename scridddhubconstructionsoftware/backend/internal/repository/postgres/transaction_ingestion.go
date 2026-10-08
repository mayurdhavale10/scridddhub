package postgres

import (
	"context"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/transactionpipeline"
)

func (r *RegisteredTransactionRepository) SaveTransactionSource(ctx context.Context, s transactionpipeline.SourceRecord) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `INSERT INTO transaction_source_records(source,source_reference,source_url,fetched_at,content_hash,raw_text,file_path)
 VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source,source_reference,content_hash)
 DO UPDATE SET source_reference=EXCLUDED.source_reference RETURNING id`, s.Source, s.Reference, s.URL, s.FetchedAt, s.Hash, s.RawText, s.FilePath).Scan(&id)
	return id, err
}

func (r *RegisteredTransactionRepository) SaveRegisteredTransaction(ctx context.Context, t domain.RegisteredTransaction) error {
	_, err := r.pool.Exec(ctx, `INSERT INTO registered_transactions(
 registration_date,document_no,office_code,office_name,district_code,taluka_code,village_code,survey_no,property_type,deed_type,
 area_acres,sale_price_rupees,government_value_rupees,latitude,longitude,location_method,comparable,exclusion_reason,reviewed_by,source,source_record_id)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
 ON CONFLICT(document_no,office_code,registration_year) DO UPDATE SET
 registration_date=EXCLUDED.registration_date,office_name=EXCLUDED.office_name,district_code=EXCLUDED.district_code,
 taluka_code=EXCLUDED.taluka_code,village_code=EXCLUDED.village_code,survey_no=EXCLUDED.survey_no,
 property_type=EXCLUDED.property_type,deed_type=EXCLUDED.deed_type,area_acres=EXCLUDED.area_acres,sale_price_rupees=EXCLUDED.sale_price_rupees,
 government_value_rupees=EXCLUDED.government_value_rupees,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
 location_method=EXCLUDED.location_method,comparable=EXCLUDED.comparable,exclusion_reason=EXCLUDED.exclusion_reason,
 reviewed_by=EXCLUDED.reviewed_by,source=EXCLUDED.source,source_record_id=EXCLUDED.source_record_id,updated_at=now()`,
		t.RegistrationDate.Format("2006-01-02"), t.DocumentNo, t.OfficeCode, t.OfficeName, t.DistrictCode, t.TalukaCode, t.VillageCode, t.SurveyNo, t.PropertyType, t.DeedType,
		t.AreaAcres, t.SalePriceRupees, t.GovernmentValueRupees, t.Latitude, t.Longitude, t.LocationMethod, t.Comparable, t.ExclusionReason, t.ReviewedBy, t.Source, t.SourceRecordID)
	return err
}
