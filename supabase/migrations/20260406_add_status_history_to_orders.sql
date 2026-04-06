-- orders 테이블에 status_history 컬럼 추가
-- 상태 변경 이력을 jsonb 배열로 누적
-- 예: [{"status":"pending","changed_at":"2026-04-06T10:00:00Z"}, ...]
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 기존 주문건: created_at 기준으로 pending 이력 초기화
UPDATE orders
SET status_history = jsonb_build_array(
  jsonb_build_object('status', status, 'changed_at', created_at)
)
WHERE status_history = '[]'::jsonb;

-- 상태 변경 시 자동으로 status_history에 누적하는 트리거
CREATE OR REPLACE FUNCTION append_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history := OLD.status_history || jsonb_build_array(
      jsonb_build_object('status', NEW.status, 'changed_at', now())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_status_history ON orders;
CREATE TRIGGER trg_status_history
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION append_status_history();
