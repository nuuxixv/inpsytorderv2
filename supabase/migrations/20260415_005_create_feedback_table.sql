CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  location TEXT,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'received';
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert feedback" ON public.feedback;
CREATE POLICY "Authenticated can insert feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Master can view feedback" ON public.feedback;
CREATE POLICY "Master can view feedback" ON public.feedback
  FOR SELECT TO authenticated USING (public.has_permission('master'));

DROP POLICY IF EXISTS "Master can update feedback" ON public.feedback;
CREATE POLICY "Master can update feedback" ON public.feedback
  FOR UPDATE TO authenticated USING (public.has_permission('master'));
