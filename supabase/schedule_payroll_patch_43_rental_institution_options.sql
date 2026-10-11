-- 교구 관리자·스케줄 관리자가 대여 신청에서 활성 기관 이름만 고를 수 있게 한다.
-- institutions 직접 SELECT는 스케줄 관리자 RLS라서, role=teacher 인 교구 관리자는 빈 목록이 된다.
-- 계약·매출 컬럼은 반환하지 않는다. 일반 선생님은 0건이다.

CREATE OR REPLACE FUNCTION public.get_rental_institution_options()
RETURNS TABLE (
  id uuid,
  name text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.name, i.is_active
  FROM public.institutions i
  WHERE i.is_active = true
    AND (
      public.is_item_admin()
      OR public.is_schedule_admin()
    )
  ORDER BY i.name;
$$;

REVOKE ALL ON FUNCTION public.get_rental_institution_options() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rental_institution_options() TO authenticated;

NOTIFY pgrst, 'reload schema';
