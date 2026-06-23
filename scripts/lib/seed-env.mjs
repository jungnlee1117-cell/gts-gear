import { config as loadDotenv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "../..");

if (existsSync(join(ROOT, ".env.local"))) {
  loadDotenv({ path: join(ROOT, ".env.local"), override: true, quiet: true });
}
if (existsSync(join(ROOT, ".env"))) {
  loadDotenv({ path: join(ROOT, ".env"), quiet: true });
}

export function envValue(key) {
  const v = process.env[key];
  return v?.trim() ? v.trim() : undefined;
}

export function createSeedSupabase() {
  const url = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL(VITE_SUPABASE_URL) 및 SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local)");
  }
  return createClient(url, key);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Set();
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") flags.add("dry-run");
    else if (a === "--probe-sheet") flags.add("probe-sheet");
    else if (a === "--force") flags.add("force");
    else if (a === "--validate-only") flags.add("validate-only");
    else if (a === "--only-manual") flags.add("only-manual");
    else if (a === "--csv-dir" && argv[i + 1]) { opts.csvDir = argv[++i]; }
    else if (a === "--teacher" && argv[i + 1]) { opts.teacher = argv[++i]; }
  }
  return { flags, opts };
}
