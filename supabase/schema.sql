-- ============================================================
-- ROYALTIES APP — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Royalty records
CREATE TABLE IF NOT EXISTS public.royalty_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sale_period TEXT NOT NULL DEFAULT '',
  store TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  artist_name TEXT NOT NULL DEFAULT '',
  song_title TEXT NOT NULL DEFAULT '',
  album_name TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0,
  earnings_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_royalty_records_report_id ON public.royalty_records(report_id);
CREATE INDEX IF NOT EXISTS idx_royalty_records_user_id ON public.royalty_records(user_id);
CREATE INDEX IF NOT EXISTS idx_royalty_records_store ON public.royalty_records(store);
CREATE INDEX IF NOT EXISTS idx_royalty_records_song ON public.royalty_records(song_title);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- REPORTS policies
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own reports"
  ON public.reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reports"
  ON public.reports FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can delete own reports"
  ON public.reports FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- ROYALTY RECORDS policies
CREATE POLICY "Users can view own records"
  ON public.royalty_records FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own records"
  ON public.royalty_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ACTIVITY LOGS policies
CREATE POLICY "Users can view own logs"
  ON public.activity_logs FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- STORAGE
-- ============================================================

-- Create bucket for reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reports' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      public.is_admin()
    )
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'reports' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      public.is_admin()
    )
  );

-- ============================================================
-- CREATE FIRST ADMIN (run manually after setup)
-- Replace values below with your admin credentials
-- ============================================================
-- After creating your first user via Supabase Auth dashboard,
-- run this to make them admin:
--
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@tudominio.com';
