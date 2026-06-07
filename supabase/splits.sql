-- ============================================================
-- SPLITS MODULE — Run this in Supabase SQL Editor
-- ============================================================

-- Contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  label       TEXT DEFAULT 'Sello',
  notes       TEXT,
  start_date  DATE,
  end_date    DATE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Split participants per contract
CREATE TABLE IF NOT EXISTS public.contract_splits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  participant TEXT NOT NULL,        -- e.g. "Artista", "Sello", "Productor"
  role        TEXT NOT NULL DEFAULT 'other', -- artist | label | producer | other
  percentage  NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.contracts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contracts"
  ON public.contracts FOR ALL USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users manage own splits"
  ON public.contract_splits FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND (c.user_id = auth.uid() OR public.is_admin()))
  );

-- Trigger updated_at
CREATE TRIGGER set_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
