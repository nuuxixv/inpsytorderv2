-- 알림톡으로 이메일 대체 — email 컬럼 NOT NULL 제약 제거
ALTER TABLE orders ALTER COLUMN email DROP NOT NULL;
