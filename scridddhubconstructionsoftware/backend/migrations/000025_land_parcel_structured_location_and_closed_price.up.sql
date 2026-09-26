-- Prerequisites for a future real pricing model (docs/adr/0005), not the model itself.
--
-- district/taluka/village: structured location, set only when known (the "Just checking a
-- location" flow already collects these via the Ready Reckoner picker). Lets a future closed
-- transaction be matched to a training bucket at Ready-Reckoner granularity without first solving
-- free-text location matching.
--
-- closed_price_rupees/closed_at: the real, final transacted price once a deal closes — distinct
-- from cost_rupees, which is an asking price captured once at creation and never re-verified.
-- Asking price is not legitimate ground truth for a pricing model; a closed price is.
ALTER TABLE land_parcels
    ADD COLUMN district TEXT,
    ADD COLUMN taluka TEXT,
    ADD COLUMN village TEXT,
    ADD COLUMN closed_price_rupees BIGINT,
    ADD COLUMN closed_at TIMESTAMPTZ;

ALTER TABLE land_parcels
    ADD CONSTRAINT land_parcels_closed_price_positive
        CHECK (closed_price_rupees IS NULL OR closed_price_rupees > 0);
