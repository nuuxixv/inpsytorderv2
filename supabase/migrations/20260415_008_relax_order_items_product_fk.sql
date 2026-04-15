-- order_items.product_id FK 제약조건 완화
-- 상품 삭제 시 주문 항목은 보존하되 product_id만 NULL로 변경
-- 스냅샷 컬럼(product_name, product_code, category, list_price)이 있어 표시에 영향 없음

-- 1. product_id를 nullable로 변경
ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;

-- 2. 기존 FK 제약조건 삭제 후 ON DELETE SET NULL로 재생성
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id)
  ON DELETE SET NULL;
