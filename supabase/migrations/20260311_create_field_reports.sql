-- field_reports 테이블 생성
CREATE TABLE IF NOT EXISTS field_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  day_number INT DEFAULT 1,
  content TEXT NOT NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE field_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full CRUD
CREATE POLICY "Allow authenticated read field_reports" ON field_reports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert field_reports" ON field_reports
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update field_reports" ON field_reports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete field_reports" ON field_reports
  FOR DELETE TO authenticated USING (true);
