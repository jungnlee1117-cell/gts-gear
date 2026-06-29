export async function fetchItemIdeas(supabase, itemId, teacherId) {
  const { data: ideas, error } = await supabase
    .from("item_ideas")
    .select("*")
    .eq("item_id", itemId);
  if (error) throw error;
  if (!ideas?.length) return [];

  const ids = ideas.map(i => i.id);
  const { data: likeRows, error: likeErr } = await supabase
    .from("item_idea_likes")
    .select("idea_id, teacher_id")
    .in("idea_id", ids);
  if (likeErr) throw likeErr;

  const likeCountByIdea = {};
  const likedByMe = new Set();
  for (const row of likeRows || []) {
    likeCountByIdea[row.idea_id] = (likeCountByIdea[row.idea_id] || 0) + 1;
    if (teacherId && row.teacher_id === teacherId) likedByMe.add(row.idea_id);
  }

  return ideas
    .map(idea => ({
      ...idea,
      like_count: likeCountByIdea[idea.id] || 0,
      liked_by_me: likedByMe.has(idea.id),
    }))
    .sort((a, b) => {
      if (b.like_count !== a.like_count) return b.like_count - a.like_count;
      return new Date(b.created_at) - new Date(a.created_at);
    });
}

export async function insertItemIdea(supabase, { itemId, teacherId, teacherName, content }) {
  const trimmed = (content || "").trim();
  if (!trimmed) return { data: null, error: null };

  return supabase.from("item_ideas").insert({
    item_id: itemId,
    teacher_id: teacherId,
    teacher_name: teacherName,
    content: trimmed,
  }).select().single();
}

export async function toggleItemIdeaLike(supabase, ideaId, teacherId, currentlyLiked) {
  if (currentlyLiked) {
    const { error } = await supabase
      .from("item_idea_likes")
      .delete()
      .eq("idea_id", ideaId)
      .eq("teacher_id", teacherId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from("item_idea_likes").insert({
    idea_id: ideaId,
    teacher_id: teacherId,
  });
  if (error) throw error;
  return true;
}
