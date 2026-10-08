UPDATE legal_checks SET ownership_risk = 'medium' WHERE ownership_risk = 'not_checked';
UPDATE legal_checks SET litigation_risk = 'medium' WHERE litigation_risk = 'not_checked';
UPDATE legal_checks SET encumbrance_risk = 'medium' WHERE encumbrance_risk = 'not_checked';
UPDATE legal_checks SET regulatory_risk = 'medium' WHERE regulatory_risk = 'not_checked';

ALTER TABLE legal_checks
    DROP CONSTRAINT legal_checks_ownership_risk_check,
    DROP CONSTRAINT legal_checks_litigation_risk_check,
    DROP CONSTRAINT legal_checks_encumbrance_risk_check,
    DROP CONSTRAINT legal_checks_regulatory_risk_check;

ALTER TABLE legal_checks
    ADD CONSTRAINT legal_checks_ownership_risk_check
        CHECK (ownership_risk IN ('low', 'medium', 'high')),
    ADD CONSTRAINT legal_checks_litigation_risk_check
        CHECK (litigation_risk IN ('low', 'medium', 'high')),
    ADD CONSTRAINT legal_checks_encumbrance_risk_check
        CHECK (encumbrance_risk IN ('low', 'medium', 'high')),
    ADD CONSTRAINT legal_checks_regulatory_risk_check
        CHECK (regulatory_risk IN ('low', 'medium', 'high'));
