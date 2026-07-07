import { DAY_LABELS, yearMonthLastDay } from "./constants.js";

function parseLocalDate(dateStr) {
  const [y, m, d] = normalizeNoteDate(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Supabase date / timestamptz → YYYY-MM-DD */
export function normalizeNoteDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function formatTeacherNoteDate(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY_LABELS[d.getDay()]})`;
}

export function formatTeacherNoteLine(note) {
  return `${formatTeacherNoteDate(note.note_date)} ${note.content}`;
}

export function notesForMonth(notes, year, month) {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStart = `${monthKey}-01`;
  const monthEnd = yearMonthLastDay(monthKey);
  return notes
    .filter(n => {
      const d = normalizeNoteDate(n.note_date);
      return d >= monthStart && d <= monthEnd;
    })
    .sort((a, b) => normalizeNoteDate(a.note_date).localeCompare(normalizeNoteDate(b.note_date)));
}

export function noteByDate(notes, dateStr) {
  const key = normalizeNoteDate(dateStr);
  return notes.find(n => normalizeNoteDate(n.note_date) === key) ?? null;
}

export function mergeTeacherNote(notes, saved) {
  if (!saved?.id) return notes;
  const savedDate = normalizeNoteDate(saved.note_date);
  const next = notes.filter(
    n => n.id !== saved.id && normalizeNoteDate(n.note_date) !== savedDate,
  );
  next.push({ ...saved, note_date: savedDate });
  return next.sort((a, b) => normalizeNoteDate(a.note_date).localeCompare(normalizeNoteDate(b.note_date)));
}

export function groupNotesByTeacher(notes) {
  const map = new Map();
  for (const note of notes) {
    const key = note.teacher_id;
    if (!map.has(key)) {
      map.set(key, {
        teacherId: key,
        teacherName: note.teachers?.name ?? "—",
        notes: [],
      });
    }
    map.get(key).notes.push(note);
  }
  for (const group of map.values()) {
    group.notes.sort((a, b) => a.note_date.localeCompare(b.note_date));
  }
  return [...map.values()].sort((a, b) => a.teacherName.localeCompare(b.teacherName, "ko"));
}
