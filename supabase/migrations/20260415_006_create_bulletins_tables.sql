-- 게시판 메인 테이블
CREATE TABLE public.bulletins (
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
CREATE TABLE public.bulletin_reads (
  bulletin_id UUID REFERENCES public.bulletins(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  first_read_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bulletin_id, user_id)
);

-- RLS for bulletins
ALTER TABLE public.bulletins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view bulletins" ON public.bulletins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master can insert bulletins" ON public.bulletins FOR INSERT TO authenticated WITH CHECK (public.has_permission('master'));
CREATE POLICY "Master can update bulletins" ON public.bulletins FOR UPDATE TO authenticated USING (public.has_permission('master'));
CREATE POLICY "Master can delete bulletins" ON public.bulletins FOR DELETE TO authenticated USING (public.has_permission('master'));

-- RLS for bulletin_reads
ALTER TABLE public.bulletin_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can mark bulletins read" ON public.bulletin_reads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own reads" ON public.bulletin_reads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own reads" ON public.bulletin_reads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Master can view all reads" ON public.bulletin_reads FOR SELECT TO authenticated USING (public.has_permission('master'));
