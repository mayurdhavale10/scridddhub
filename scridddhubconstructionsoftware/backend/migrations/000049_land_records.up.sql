-- A parcel's confirmed 7/12 (record of rights). The AI drafts it from a photo; a person checks
-- every field and confirms before it's saved here, so every row is person-confirmed.
CREATE TABLE land_records (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    land_parcel_id uuid NOT NULL UNIQUE REFERENCES land_parcels(id) ON DELETE CASCADE,
    data           jsonb NOT NULL,
    read_by        text,
    confirmed_by   text NOT NULL,
    confirmed_at   timestamptz NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
