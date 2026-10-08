-- A legal check now starts as a checklist for any parcel (POST /land-parcels/{id}/legal-check),
-- before anyone has judged the risks. 'not_checked' is that honest starting state; a check can't
-- be cleared while any risk is still not_checked (enforced in domain.LegalCheck.Validate).
ALTER TABLE legal_checks
    DROP CONSTRAINT legal_checks_ownership_risk_check,
    DROP CONSTRAINT legal_checks_litigation_risk_check,
    DROP CONSTRAINT legal_checks_encumbrance_risk_check,
    DROP CONSTRAINT legal_checks_regulatory_risk_check;

ALTER TABLE legal_checks
    ADD CONSTRAINT legal_checks_ownership_risk_check
        CHECK (ownership_risk IN ('not_checked', 'low', 'medium', 'high')),
    ADD CONSTRAINT legal_checks_litigation_risk_check
        CHECK (litigation_risk IN ('not_checked', 'low', 'medium', 'high')),
    ADD CONSTRAINT legal_checks_encumbrance_risk_check
        CHECK (encumbrance_risk IN ('not_checked', 'low', 'medium', 'high')),
    ADD CONSTRAINT legal_checks_regulatory_risk_check
        CHECK (regulatory_risk IN ('not_checked', 'low', 'medium', 'high'));
