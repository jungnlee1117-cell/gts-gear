-- 서류 종류를 관리자가 화면에서 추가/수정/비활성화
-- 기존 teacher_documents.doc_type(resume/health/other) 을 FK 로 이전
-- supabase db query --linked -f supabase/teacher_document_types.sql

CREATE TABLE IF NOT EXISTS public.teacher_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  allows_custom_label boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_document_types_label_chk CHECK (length(btrim(label)) > 0)
);

COMMENT ON TABLE public.teacher_document_types IS
  '내 정보 > 서류 업로드 종류. 관리자가 추가·이름 변경·비활성화.';
COMMENT ON COLUMN public.teacher_document_types.slug IS
  '시드 종류 식별자(resume/health/other). 관리자가 추가한 종류는 null.';
COMMENT ON COLUMN public.teacher_document_types.allows_custom_label IS
  'true면 업로드 시 서류 이름을 직접 입력(기타).';

CREATE INDEX IF NOT EXISTS teacher_document_types_sort_idx
  ON public.teacher_document_types (sort_order, label);

INSERT INTO public.teacher_document_types (slug, label, sort_order, is_active, allows_custom_label)
VALUES
  ('resume', '이력서', 10, true, false),
  ('health', '건강검진표', 20, true, false),
  ('other', '기타', 90, true, true)
ON CONFLICT (slug) DO UPDATE SET
  label = COALESCE(public.teacher_document_types.label, EXCLUDED.label);

ALTER TABLE public.teacher_documents
  DROP CONSTRAINT IF EXISTS teacher_documents_doc_type_check;
ALTER TABLE public.teacher_documents
  DROP CONSTRAINT IF EXISTS teacher_documents_other_label_chk;

ALTER TABLE public.teacher_documents
  ADD COLUMN IF NOT EXISTS doc_type_id uuid;

UPDATE public.teacher_documents d
SET doc_type_id = t.id
FROM public.teacher_document_types t
WHERE d.doc_type_id IS NULL
  AND d.doc_type IS NOT NULL
  AND t.slug = d.doc_type;

UPDATE public.teacher_documents
SET doc_type_id = (SELECT id FROM public.teacher_document_types WHERE slug = 'other' LIMIT 1)
WHERE doc_type_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.teacher_documents WHERE doc_type_id IS NULL
  ) THEN
    RAISE EXCEPTION 'teacher_documents.doc_type_id 백필에 실패한 행이 있습니다.';
  END IF;
END $$;

ALTER TABLE public.teacher_documents
  ALTER COLUMN doc_type_id SET NOT NULL;

ALTER TABLE public.teacher_documents
  DROP CONSTRAINT IF EXISTS teacher_documents_doc_type_id_fkey;
ALTER TABLE public.teacher_documents
  ADD CONSTRAINT teacher_documents_doc_type_id_fkey
  FOREIGN KEY (doc_type_id) REFERENCES public.teacher_document_types(id) ON DELETE RESTRICT;

ALTER TABLE public.teacher_documents
  ALTER COLUMN doc_type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS teacher_documents_type_idx
  ON public.teacher_documents (doc_type_id);

CREATE OR REPLACE FUNCTION public.teacher_documents_protect()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_type public.teacher_document_types%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN
    RAISE EXCEPTION 'teacher_id는 변경할 수 없습니다.';
  END IF;

  SELECT * INTO v_type
  FROM public.teacher_document_types
  WHERE id = NEW.doc_type_id;

  IF v_type.id IS NULL THEN
    RAISE EXCEPTION '서류 종류를 찾을 수 없습니다.';
  END IF;

  IF TG_OP = 'INSERT' AND v_type.is_active IS NOT TRUE THEN
    RAISE EXCEPTION '비활성화된 서류 종류입니다.';
  END IF;

  NEW.doc_type := v_type.slug;

  IF v_type.allows_custom_label THEN
    NEW.doc_label := NULLIF(btrim(COALESCE(NEW.doc_label, '')), '');
    IF NEW.doc_label IS NULL THEN
      RAISE EXCEPTION '서류 이름을 입력해 주세요.';
    END IF;
  ELSE
    NEW.doc_label := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teacher_documents_protect ON public.teacher_documents;
CREATE TRIGGER teacher_documents_protect
  BEFORE INSERT OR UPDATE ON public.teacher_documents
  FOR EACH ROW EXECUTE FUNCTION public.teacher_documents_protect();

CREATE OR REPLACE FUNCTION public.teacher_document_types_protect()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.teacher_documents d WHERE d.doc_type_id = OLD.id
    ) THEN
      RAISE EXCEPTION '이 종류로 올라간 서류가 있어 삭제할 수 없습니다. 비활성화해 주세요.';
    END IF;
    RETURN OLD;
  END IF;
  NEW.label := btrim(COALESCE(NEW.label, ''));
  IF NEW.label = '' THEN
    RAISE EXCEPTION '서류 종류 이름을 입력해 주세요.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teacher_document_types_protect ON public.teacher_document_types;
CREATE TRIGGER teacher_document_types_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.teacher_document_types
  FOR EACH ROW EXECUTE FUNCTION public.teacher_document_types_protect();

ALTER TABLE public.teacher_document_types ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.teacher_document_types FROM PUBLIC;
REVOKE ALL ON public.teacher_document_types FROM anon;
GRANT SELECT ON public.teacher_document_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teacher_document_types TO authenticated;
GRANT ALL ON public.teacher_document_types TO service_role;

DROP POLICY IF EXISTS "teacher_document_types_select" ON public.teacher_document_types;
CREATE POLICY "teacher_document_types_select" ON public.teacher_document_types
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "teacher_document_types_admin_insert" ON public.teacher_document_types;
CREATE POLICY "teacher_document_types_admin_insert" ON public.teacher_document_types
  FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_schedule_admin());

DROP POLICY IF EXISTS "teacher_document_types_admin_update" ON public.teacher_document_types;
CREATE POLICY "teacher_document_types_admin_update" ON public.teacher_document_types
  FOR UPDATE TO authenticated
  USING (public.is_teacher_schedule_admin())
  WITH CHECK (public.is_teacher_schedule_admin());

DROP POLICY IF EXISTS "teacher_document_types_admin_delete" ON public.teacher_document_types;
CREATE POLICY "teacher_document_types_admin_delete" ON public.teacher_document_types
  FOR DELETE TO authenticated
  USING (public.is_teacher_schedule_admin());

NOTIFY pgrst, 'reload schema';
