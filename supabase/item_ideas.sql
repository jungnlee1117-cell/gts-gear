-- 교구 반납 시 공유하는 활용 아이디어 + 좋아요
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.item_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_name text NOT NULL,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_ideas_item_id ON public.item_ideas(item_id);
CREATE INDEX IF NOT EXISTS idx_item_ideas_created_at ON public.item_ideas(created_at DESC);

COMMENT ON TABLE public.item_ideas IS '교구 반납 시 선생님이 공유한 활동 아이디어';

CREATE TABLE IF NOT EXISTS public.item_idea_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.item_ideas(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_item_idea_likes_idea_id ON public.item_idea_likes(idea_id);

COMMENT ON TABLE public.item_idea_likes IS '교구 활용 아이디어 좋아요';

ALTER TABLE public.item_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_idea_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_ideas_read_all" ON public.item_ideas;
CREATE POLICY "item_ideas_read_all" ON public.item_ideas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "item_ideas_insert_own" ON public.item_ideas;
CREATE POLICY "item_ideas_insert_own" ON public.item_ideas
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "item_idea_likes_read_all" ON public.item_idea_likes;
CREATE POLICY "item_idea_likes_read_all" ON public.item_idea_likes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "item_idea_likes_insert_own" ON public.item_idea_likes;
CREATE POLICY "item_idea_likes_insert_own" ON public.item_idea_likes
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "item_idea_likes_delete_own" ON public.item_idea_likes;
CREATE POLICY "item_idea_likes_delete_own" ON public.item_idea_likes
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());
