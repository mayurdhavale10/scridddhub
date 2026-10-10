-- A parcel's confirmed mutation register (Ferfar, village form 6): the ownership chain. Read
-- from photos by the AI as a draft; a person checks every entry and confirms before it's saved.
CREATE TABLE land_mutations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    land_parcel_id uuid NOT NULL UNIQUE REFERENCES land_parcels(id) ON DELETE CASCADE,
    data           jsonb NOT NULL,
    read_by        text,
    confirmed_by   text NOT NULL,
    confirmed_at   timestamptz NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
