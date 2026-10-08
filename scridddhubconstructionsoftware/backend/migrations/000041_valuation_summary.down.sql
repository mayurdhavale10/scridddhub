ALTER TABLE feasibility_assessments
    DROP COLUMN IF EXISTS assessed_at,
    DROP COLUMN IF EXISTS model,
    DROP COLUMN IF EXISTS reasoning,
    DROP COLUMN IF EXISTS basis,
    DROP COLUMN IF EXISTS method,
    DROP COLUMN IF EXISTS future_high_rupees,
    DROP COLUMN IF EXISTS future_low_rupees,
    DROP COLUMN IF EXISTS current_high_rupees,
    DROP COLUMN IF EXISTS current_low_rupees;
