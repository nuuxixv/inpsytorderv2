-- 알림톡 발송 이력 추적 컬럼
ALTER TABLE orders ADD COLUMN IF NOT EXISTS alimtalk_sent_at timestamptz;
