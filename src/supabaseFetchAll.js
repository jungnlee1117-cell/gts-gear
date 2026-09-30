/** PostgREST 기본 max-rows. 초과분은 에러 없이 잘리므로 range로 이어 읽는다. */
export const POSTGREST_MAX_ROWS = 1000;

/**
 * supabase-js 쿼리를 1000행 단위로 이어 붙인다.
 * makeQuery는 매번 새 빌더를 반환해야 한다(.range는 빌더를 소비한다).
 */
export async function fetchAllPages(makeQuery, {
  pageSize = POSTGREST_MAX_ROWS,
  orderColumn = "id",
  ascending = true,
} = {}) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery()
      .order(orderColumn, { ascending })
      .range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}

export function sortByCreatedAtDesc(rows) {
  return [...(rows || [])].sort((a, b) =>
    String(b?.created_at || "").localeCompare(String(a?.created_at || "")),
  );
}
