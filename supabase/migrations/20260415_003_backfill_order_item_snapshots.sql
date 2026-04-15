-- 기존 주문 데이터 백필: products 테이블에서 현재 상품 정보를 order_items에 복사

-- 1. 존재하는 상품의 스냅샷 백필
UPDATE public.order_items oi
SET
  product_name = p.name,
  product_code = p.product_code,
  category = p.category,
  list_price = p.list_price
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.product_name IS NULL;

-- 2. 삭제된 상품 처리 (product_id가 products에 없는 경우)
UPDATE public.order_items oi
SET
  product_name = '(삭제된 상품)'
WHERE oi.product_name IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = oi.product_id);
