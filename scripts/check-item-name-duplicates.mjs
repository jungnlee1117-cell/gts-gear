#!/usr/bin/env node
/**
 * DB items 테이블 교구명 중복 확인
 * node scripts/check-item-name-duplicates.mjs
 */
import { createSeedSupabase } from "./lib/seed-env.mjs";

function normalize(name) {
  return (name || "").trim().toLowerCase();
}

const supabase = createSeedSupabase();
const { data, error } = await supabase.from("items").select("id, name, code");
if (error) {
  console.error("조회 실패:", error.message);
  process.exit(1);
}

const groups = new Map();
for (const row of data || []) {
  const key = normalize(row.name);
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}

const dupes = [...groups.entries()].filter(([, rows]) => rows.length > 1);
if (!dupes.length) {
  console.log("중복 교구명 없음 (", data?.length ?? 0, "건)");
  process.exit(0);
}

console.log("중복 교구명", dupes.length, "그룹:");
for (const [key, rows] of dupes) {
  console.log(`\n  [${key}]`);
  for (const r of rows) {
    console.log(`    - ${r.name} (${r.code}) id=${r.id}`);
  }
}
process.exit(1);
