-- 게시판 메인 테이블
CREATE TABLE IF NOT EXISTS public.bulletins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'notice',
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 읽음 추적 테이블
CREATE TABLE IF NOT EXISTS public.bulletin_reads (
  bulletin_id UUID REFERENCES public.bulletins(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  first_read_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bulletin_id, user_id)
);

-- 이전 버전에서 생성된 경우 신규 컬럼 추가
ALTER TABLE public.bulletin_reads ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.bulletin_reads ADD COLUMN IF NOT EXISTS first_read_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.bulletin_reads ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NOW();
-- 구버전 read_at 컬럼이 있으면 first_read_at으로 마이그레이션
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bulletin_reads' AND column_name='read_at') THEN
    UPDATE public.bulletin_reads SET first_read_at = read_at, last_read_at = read_at WHERE first_read_at IS NULL;
    ALTER TABLE public.bulletin_reads DROP COLUMN read_at;
  END IF;
END $$;

-- RLS for bulletins
ALTER TABLE public.bulletins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view bulletins" ON public.bulletins;
CREATE POLICY "Authenticated can view bulletins" ON public.bulletins FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Master can insert bulletins" ON public.bulletins;
CREATE POLICY "Master can insert bulletins" ON public.bulletins FOR INSERT TO authenticated WITH CHECK (public.has_permission('master'));
DROP POLICY IF EXISTS "Master can update bulletins" ON public.bulletins;
CREATE POLICY "Master can update bulletins" ON public.bulletins FOR UPDATE TO authenticated USING (public.has_permission('master'));
DROP POLICY IF EXISTS "Master can delete bulletins" ON public.bulletins;
CREATE POLICY "Master can delete bulletins" ON public.bulletins FOR DELETE TO authenticated USING (public.has_permission('master'));

-- RLS for bulletin_reads
ALTER TABLE public.bulletin_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can mark bulletins read" ON public.bulletin_reads;
CREATE POLICY "Users can mark bulletins read" ON public.bulletin_reads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own reads" ON public.bulletin_reads;
CREATE POLICY "Users can view own reads" ON public.bulletin_reads FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own reads" ON public.bulletin_reads;
CREATE POLICY "Users can update own reads" ON public.bulletin_reads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Master can view all reads" ON public.bulletin_reads;
CREATE POLICY "Master can view all reads" ON public.bulletin_reads FOR SELECT TO authenticated USING (public.has_permission('master'));
