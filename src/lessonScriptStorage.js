const STORAGE_KEY = "gts_lesson_scripts_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listSavedLessonScripts() {
  return readAll().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function getSavedLessonScript(id) {
  return readAll().find(row => row.id === id) ?? null;
}

export function saveLessonScript(payload) {
  const now = new Date().toISOString();
  const rows = readAll();
  const existingIdx = payload.id ? rows.findIndex(r => r.id === payload.id) : -1;

  const row = {
    id: payload.id || crypto.randomUUID(),
    title: payload.title?.trim() || "제목 없는 수업 대본",
    warmupSetId: payload.warmupSetId,
    warmupActivityId: payload.warmupActivityId || null,
    gearId: payload.gearId || null,
    gameId: payload.gameId || null,
    levelId: payload.levelId || "foundation",
    fullText: payload.fullText || "",
    sections: payload.sections || [],
    createdAt: existingIdx >= 0 ? rows[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) rows[existingIdx] = row;
  else rows.unshift(row);

  writeAll(rows);
  return row;
}

export function deleteSavedLessonScript(id) {
  writeAll(readAll().filter(r => r.id !== id));
}
