-- List order for entity records (the app shows lists newest-first or oldest-first; `ord` keeps its order).
ALTER TABLE entity_records ADD COLUMN IF NOT EXISTS ord double precision NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS entity_ord_ix ON entity_records (tenant_id, collection, ord);

-- India · new tax regime (FY 2025-26 slabs), annual tax incl. 4% cess, rebate u/s 87A up to ₹12 lakh taxable.
CREATE OR REPLACE FUNCTION tds_new_regime(annual_gross numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  WITH t AS (SELECT greatest(annual_gross - 75000, 0) AS ti)
  SELECT CASE WHEN ti <= 1200000 THEN 0 ELSE round((
      least(greatest(ti - 400000, 0), 400000) * 0.05 +
      least(greatest(ti - 800000, 0), 400000) * 0.10 +
      least(greatest(ti - 1200000, 0), 400000) * 0.15 +
      least(greatest(ti - 1600000, 0), 400000) * 0.20 +
      least(greatest(ti - 2000000, 0), 400000) * 0.25 +
      greatest(ti - 2400000, 0) * 0.30) * 1.04, 0) END
  FROM t
$$;
