-- 이메일 컬럼 제거: 알림톡으로 대체되어 더 이상 사용하지 않음
ALTER TABLE orders DROP COLUMN IF EXISTS email;
