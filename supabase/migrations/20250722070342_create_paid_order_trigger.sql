-- 트리거를 실행할 함수를 먼저 정의합니다.
CREATE OR REPLACE FUNCTION public.notify_order_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- NEW.id를 payload로 하여 'order_paid' 채널에 NOTIFY를 보냅니다.
  PERFORM pg_notify('order_paid', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- orders 테이블에 트리거를 부착합니다.
CREATE TRIGGER on_order_status_paid
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status <> 'paid')
EXECUTE FUNCTION public.notify_order_paid();