-- 안소연 선생님 1명만 gear_only. teacher_id + 이름 + 이메일이 모두 일치해야 함.
-- 대상이 1행이 아니면 전체 롤백.

DO $$
DECLARE
  n int;
  tid constant uuid := '64f92ddb-c785-4588-9692-dd942d510e5f';
BEGIN
  SELECT COUNT(*) INTO n
  FROM public.teachers
  WHERE id = tid
    AND name = '안소연'
    AND email = 'sonnitory7@gmail.com'
    AND role = 'teacher'
    AND COALESCE(is_item_admin, false) = false;

  IF n <> 1 THEN
    RAISE EXCEPTION
      'gear_only apply aborted: expected 1 matching teacher (id+name+email+role), found %',
      n;
  END IF;

  UPDATE public.teachers
  SET access_scope = 'gear_only'
  WHERE id = tid
    AND name = '안소연'
    AND email = 'sonnitory7@gmail.com'
    AND role = 'teacher'
    AND COALESCE(is_item_admin, false) = false;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'gear_only apply aborted: update affected % rows', n;
  END IF;

  RAISE NOTICE 'access_scope=gear_only applied to %', tid;
END $$;
