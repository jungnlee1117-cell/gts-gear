-- teachers 테이블에 이메일 컬럼 추가 (Supabase SQL Editor에서 실행)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS email text;
