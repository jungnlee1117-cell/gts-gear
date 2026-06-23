-- home_visit_patterns RLS 정책
-- RLS만 켜 두고 정책이 없으면 전체 차단됨 → 이 파일 실행
-- schedule_payroll_patch_11_home_visit_patterns.sql (테이블 생성) 후 적용

ALTER TABLE public.home_visit_patterns ENABLE ROW LEVEL SECURITY;

-- 관리자: 전체 조회·등록·수정·삭제
DROP POLICY IF EXISTS "home_visit_patterns_admin_all" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_admin_all" ON public.home_visit_patterns
  FOR ALL TO authenticated
  USING (public.is_schedule_admin())
  WITH CHECK (public.is_schedule_admin());

-- 강사: 본인 패턴만 조회
DROP POLICY IF EXISTS "home_visit_patterns_own_select" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_own_select" ON public.home_visit_patterns
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- 강사: 본인 패턴만 등록 (teacher_id는 본인 uid만)
DROP POLICY IF EXISTS "home_visit_patterns_own_insert" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_own_insert" ON public.home_visit_patterns
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- 강사: 본인 패턴만 수정
DROP POLICY IF EXISTS "home_visit_patterns_own_update" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_own_update" ON public.home_visit_patterns
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- 강사: 본인 패턴만 삭제
DROP POLICY IF EXISTS "home_visit_patterns_own_delete" ON public.home_visit_patterns;
CREATE POLICY "home_visit_patterns_own_delete" ON public.home_visit_patterns
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- 구버전 통합 정책 제거 (patch 11 초기안)
DROP POLICY IF EXISTS "home_visit_patterns_own_write" ON public.home_visit_patterns;

COMMENT ON TABLE public.home_visit_patterns IS
  '가정방문 반복 일정 패턴 — 강사 본인 CRUD, 관리자 전체 접근 (RLS)';
