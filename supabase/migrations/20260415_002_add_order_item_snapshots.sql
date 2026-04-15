-- 주문 시점 상품 정보 박제: order_items에 스냅샷 컬럼 추가
-- 상품명 변경, 가격 변경, 절판 시에도 과거 주문 데이터가 보존됨

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS list_price NUMERIC;
