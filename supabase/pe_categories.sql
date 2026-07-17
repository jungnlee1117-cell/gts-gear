-- 체육자료실 카테고리 테이블
-- Supabase SQL Editor에서 resources.sql 실행 후 실행
-- 쓰기: admin + superadmin

CREATE TABLE IF NOT EXISTS public.pe_categories (
  id text PRIMARY KEY,
  num int NOT NULL,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#22c55e',
  bg text NOT NULL DEFAULT '#ecfdf5',
  items text[] NOT NULL DEFAULT '{}',
  subs text[] NOT NULL DEFAULT '{}',
  icon text NOT NULL DEFAULT 'clipboard',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

ALTER TABLE public.pe_categories ENABLE ROW LEVEL SECURITY;

-- 읽기: authenticated 전원
DROP POLICY IF EXISTS "pe_categories_select" ON public.pe_categories;
CREATE POLICY "pe_categories_select" ON public.pe_categories
  FOR SELECT TO authenticated USING (true);

-- 쓰기: admin + superadmin (구 superadmin-only 정책 교체)
DROP POLICY IF EXISTS "pe_categories_insert_superadmin" ON public.pe_categories;
DROP POLICY IF EXISTS "pe_categories_update_superadmin" ON public.pe_categories;
DROP POLICY IF EXISTS "pe_categories_delete_superadmin" ON public.pe_categories;
DROP POLICY IF EXISTS "pe_categories_insert_admin" ON public.pe_categories;
DROP POLICY IF EXISTS "pe_categories_update_admin" ON public.pe_categories;
DROP POLICY IF EXISTS "pe_categories_delete_admin" ON public.pe_categories;

CREATE POLICY "pe_categories_insert_admin" ON public.pe_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "pe_categories_update_admin" ON public.pe_categories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "pe_categories_delete_admin" ON public.pe_categories
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = auth.uid() AND t.role IN ('admin', 'superadmin')
    )
  );

-- 기본 카테고리 (테이블이 비어 있을 때만 삽입)
INSERT INTO public.pe_categories (id, num, title, color, bg, items, subs, icon, sort_order)
SELECT * FROM (VALUES
  ('age-program', 1, '연령별 프로그램', '#22c55e', '#ecfdf5',
   ARRAY['3, 4세 프로그램', '5, 6세 프로그램', '7세 프로그램'],
   ARRAY['3-4세', '5-6세', '7세'], 'users', 1),
  ('sports', 2, '스포츠 종목 자료', '#3b82f6', '#eff6ff',
   ARRAY['축구', '농구', '테니스', '배드민턴', '티볼', '체조'],
   ARRAY['축구', '농구', '테니스', '배드민턴', '티볼', '체조'], 'ball', 2),
  ('english-pe', 3, '영어체육 자료', '#8b5cf6', '#f5f3ff',
   ARRAY['TPR 표현', '주제별 표현', '영어 게임', '영어 노래', '영어 대본', '영어 체육 활동'],
   ARRAY['TPR', '주제별', '게임', '노래', '대본', '활동'], 'abc', 3),
  ('lesson-plan', 4, '수업 계획안', '#2563eb', '#eff6ff',
   ARRAY['연간 수업 계획안', '어린이집 수업 계획안', '영어유치원 수업 계획안'],
   ARRAY['연간', '어린이집', '영어유치원'], 'clipboard', 4),
  ('events', 5, '행사 자료', '#ec4899', '#fdf2f8',
   ARRAY['운동회', '물놀이', '할로윈', '크리스마스', '가족참여수업', '아빠참여수업'],
   ARRAY['운동회', '물놀이', '할로윈', '크리스마스', '가족참여', '아빠참여'], 'party', 5),
  ('child-dev', 6, '아동 발달 자료', '#f97316', '#fff7ed',
   ARRAY['연령별 발달', '사회성 발달', '신체 발달', '운동 발달'],
   ARRAY['연령별', '사회성', '신체', '운동'], 'smile', 6),
  ('teacher-ed', 7, '교사 교육 자료', '#14b8a6', '#f0fdfa',
   ARRAY['신입교사 교육', '안전 교육', '수업 운영', '교구 교육', '기관 안내'],
   ARRAY['신입교사', '안전', '수업운영', '교구', '기관'], 'grad', 7),
  ('videos', 8, '영상 자료실', '#0ea5e9', '#f0f9ff',
   ARRAY['수업 영상', '교구 활용 영상', '행사 영상', '영어체육 영상', '교육 콘텐츠'],
   ARRAY['수업', '교구', '행사', '영어체육', '교육'], 'video', 8)
) AS v(id, num, title, color, bg, items, subs, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.pe_categories LIMIT 1);
