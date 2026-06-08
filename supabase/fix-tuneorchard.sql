-- ============================================================
-- Fix para soportar reportes de TuneOrchard / Global Sound Stars
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Ampliar la precisión de earnings_usd
--    NUMERIC(12,6) → NUMERIC(18,8)
--    Antes: máximo 999,999.999999
--    Ahora:  máximo 9,999,999,999.99999999
ALTER TABLE public.royalty_records
  ALTER COLUMN earnings_usd TYPE NUMERIC(18, 8);

-- 2. Verificar que el cambio se aplicó
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'royalty_records'
  AND column_name = 'earnings_usd';
