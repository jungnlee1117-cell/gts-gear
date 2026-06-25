#!/usr/bin/env node
/**
 * Supabase Auth 전체 사용자 비밀번호 초기화
 *
 *   node scripts/reset-all-auth-passwords.mjs --dry-run
 *   node scripts/reset-all-auth-passwords.mjs
 *
 * .env.local: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createSeedSupabase } from "./lib/seed-env.mjs";

const DRY = process.argv.includes("--dry-run");
const NEW_PASSWORD = "gts2026!";

const sb = createSeedSupabase();

async function listAllUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users ?? []));
    if ((data.users?.length ?? 0) < 1000) break;
    page += 1;
  }
  return users;
}

console.log(DRY ? "=== DRY RUN ===" : "=== RESET ALL PASSWORDS ===");

const users = await listAllUsers();
console.log(`대상: ${users.length}명`);

let ok = 0;
let fail = 0;

for (const user of users) {
  const email = user.email ?? "(no email)";
  const role = user.user_metadata?.role ?? "—";
  const name = user.user_metadata?.name ?? "—";

  if (DRY) {
    console.log(`  ${email} (${name}, ${role})`);
    ok += 1;
    continue;
  }

  const { error } = await sb.auth.admin.updateUserById(user.id, {
    password: NEW_PASSWORD,
    user_metadata: {
      ...(user.user_metadata ?? {}),
      must_change_password: false,
    },
  });

  if (error) {
    fail += 1;
    console.error(`✗ ${email}: ${error.message}`);
  } else {
    ok += 1;
    console.log(`✓ ${email} (${name})`);
  }
}

console.log(`\n완료: ${ok}명${fail ? `, 실패 ${fail}명` : ""}`);
if (fail) process.exit(1);

if (!DRY) {
  const sample = users.find(u => u.email) ?? users[0];
  if (sample?.email) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: sample.email,
      password: NEW_PASSWORD,
    });
    if (error) {
      console.error(`\n로그인 검증 실패 (${sample.email}):`, error.message);
      process.exit(1);
    }
    console.log(`\n로그인 검증 OK: ${sample.email}`);
    await sb.auth.signOut();
  }
}
