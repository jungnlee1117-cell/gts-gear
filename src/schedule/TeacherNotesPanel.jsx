import { useEffect, useMemo, useState } from "react";
import {
  formatTeacherNoteDate,
  formatTeacherNoteLine,
  noteByDate,
  normalizeNoteDate,
  notesForMonth,
} from "./teacherNotes.js";

export function TeacherNoteDayEditor({
  noteDate,
  note,
  onSave,
  onDelete,
  saving = false,
  readOnly = false,
}) {
  const [draft, setDraft] = useState(note?.content ?? "");

  useEffect(() => {
    setDraft(note?.content ?? "");
  }, [noteDate, note?.id, note?.content]);

  if (readOnly) {
    if (!note?.content) return null;
    return (
      <div className="sch-teacher-note-editor sch-teacher-note-editor--readonly">
        <h4 className="sch-teacher-note-label">개인 메모</h4>
        <p className="sch-teacher-note-readonly">{note.content}</p>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    await onSave({ note_date: noteDate, content, id: note?.id });
  };

  return (
    <form className="sch-teacher-note-editor" onSubmit={handleSave}>
      <h4 className="sch-teacher-note-label">개인 메모</h4>
      <textarea
        className="sch-input sch-teacher-note-textarea"
        rows={3}
        placeholder="예: 이날 30분 일찍 끝남, 대체 수업 진행함"
        value={draft}
        onChange={e => setDraft(e.target.value)}
      />
      <div className="sch-form-actions">
        {note?.id ? (
          <button
            type="button"
            className="sch-btn sch-btn--ghost"
            disabled={saving}
            onClick={() => onDelete(note.id)}
          >
            삭제
          </button>
        ) : null}
        <button
          type="submit"
          className="sch-btn sch-btn--primary"
          disabled={saving || !draft.trim()}
        >
          {saving ? "저장 중..." : note?.id ? "수정" : "저장"}
        </button>
      </div>
    </form>
  );
}

export function TeacherNotesMonthList({
  notes,
  year,
  month,
  onSelectDate,
  onEdit,
  onDelete,
  selectedDateStr,
  editable = false,
}) {
  const items = useMemo(() => notesForMonth(notes, year, month), [notes, year, month]);
  if (!items.length) return null;

  return (
    <section className="sch-teacher-notes-month" aria-label="이번 달 개인 메모">
      <h3 className="sch-teacher-notes-title">내 메모</h3>
      <ul className="sch-teacher-notes-list">
        {items.map(note => {
          const dateKey = normalizeNoteDate(note.note_date);
          return (
            <li key={note.id} className="sch-teacher-notes-row">
              <button
                type="button"
                className={[
                  "sch-teacher-notes-item",
                  selectedDateStr === dateKey && "sch-teacher-notes-item--active",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelectDate?.(dateKey)}
              >
                <span className="sch-teacher-notes-date">{formatTeacherNoteDate(dateKey)}</span>
                <span className="sch-teacher-notes-content">{note.content}</span>
              </button>
              {editable ? (
                <div className="sch-teacher-notes-actions">
                  <button
                    type="button"
                    className="sch-teacher-notes-action sch-teacher-notes-action--edit"
                    aria-label={`${formatTeacherNoteDate(dateKey)} 메모 수정`}
                    onClick={() => onEdit?.(note)}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="sch-teacher-notes-action sch-teacher-notes-action--delete"
                    aria-label={`${formatTeacherNoteDate(dateKey)} 메모 삭제`}
                    onClick={() => onDelete?.(note.id)}
                  >
                    🗑️
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AdminTeacherNotesSection({ noteGroups }) {
  if (!noteGroups.length) {
    return (
      <section className="sch-table-section">
        <h3>강사 개인 메모</h3>
        <p className="sch-muted">이번 달 등록된 강사 메모가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="sch-table-section">
      <h3>강사 개인 메모</h3>
      <p className="sch-muted">강사가 남긴 특이사항 참고용 (관리자 읽기 전용)</p>
      <div className="sch-admin-notes-groups">
        {noteGroups.map(group => (
          <div key={group.teacherId} className="sch-admin-notes-group">
            <h4 className="sch-admin-notes-teacher">{group.teacherName}</h4>
            <ul className="sch-teacher-notes-list sch-teacher-notes-list--admin">
              {group.notes.map(note => (
                <li key={note.id} className="sch-teacher-notes-item sch-teacher-notes-item--static">
                  <span className="sch-teacher-notes-date">{formatTeacherNoteDate(note.note_date)}</span>
                  <span className="sch-teacher-notes-content">{note.content}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export { formatTeacherNoteLine, noteByDate, notesForMonth };
