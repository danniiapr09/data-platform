-- 001: tabel forecasts disimpan lebih lengkap (aman dijalankan berkali-kali)
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS indikator   VARCHAR(100);
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS agg         VARCHAR(10);
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS batas_bawah DOUBLE PRECISION;
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS batas_atas  DOUBLE PRECISION;
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS rmse        DOUBLE PRECISION;

UPDATE forecasts
SET indikator = split_part(periode, '|', 1),
    periode   = split_part(periode, '|', 2)
WHERE indikator IS NULL AND periode LIKE '%|%';