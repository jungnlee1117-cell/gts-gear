import { DAY_LABELS, yearMonthLastDay } from "./constants.js";

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
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
    .filter(n => n.note_date >= monthStart && n.note_date <= monthEnd)
    .sort((a, b) => a.note_date.localeCompare(b.note_date));
}

export function noteByDate(notes, dateStr) {
  return notes.find(n => n.note_date === dateStr) ?? null;
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
