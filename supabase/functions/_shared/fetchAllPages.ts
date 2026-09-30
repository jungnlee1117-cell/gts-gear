export const POSTGREST_MAX_ROWS = 1000;

export async function fetchAllPages(makeQuery: () => any, pageSize = POSTGREST_MAX_ROWS) {
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery()
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}
