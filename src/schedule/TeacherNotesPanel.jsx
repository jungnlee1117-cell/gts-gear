import { useEffect, useMemo, useState } from "react";
import { ChevronDown, StickyNote } from "lucide-react";
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

export function AdminTeacherNotesSection({
  noteGroups,
  defaultCollapsed = true,
  sectionId = "sch-admin-section-notes",
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const noteCount = useMemo(
    () => (noteGroups || []).reduce((sum, g) => sum + (g.notes?.length || 0), 0),
    [noteGroups],
  );

  if (!noteGroups?.length) {
    return (
      <section
        id={sectionId}
        className="sch-admin-dash-section sch-admin-dash-section--notes"
      >
        <div className="sch-admin-section-head">
          <div className="sch-admin-section-head-main">
            <span className="sch-admin-section-icon sch-admin-section-icon--notes" aria-hidden>
              <StickyNote size={18} />
            </span>
            <div>
              <h3 className="sch-admin-dash-section-title">강사 개인 메모</h3>
              <p className="sch-muted sch-admin-dash-section-desc">이번 달 등록된 강사 메모가 없습니다.</p>
            </div>
          </div>
          <span className="sch-admin-count-badge">0건</span>
        </div>
      </section>
    );
  }

  return (
    <section
      id={sectionId}
      className="sch-admin-dash-section sch-admin-dash-section--notes"
    >
      <button
        type="button"
        className="sch-admin-section-toggle"
        onClick={() => setCollapsed(v => !v)}
        aria-expanded={!collapsed}
      >
        <div className="sch-admin-section-head-main">
          <span className="sch-admin-section-icon sch-admin-section-icon--notes" aria-hidden>
            <StickyNote size={18} />
          </span>
          <div className="sch-admin-section-toggle-text">
            <h3 className="sch-admin-dash-section-title">강사 개인 메모</h3>
            <p className="sch-muted sch-admin-dash-section-desc">
              강사가 남긴 특이사항 참고용 (관리자 읽기 전용)
            </p>
          </div>
        </div>
        <div className="sch-admin-section-badges">
          <span className="sch-admin-count-badge">{noteCount}건</span>
          <span className={`sch-admin-section-chevron${collapsed ? "" : " sch-admin-section-chevron--open"}`}>
            <ChevronDown size={18} aria-hidden />
          </span>
        </div>
      </button>

      {!collapsed ? (
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
      ) : (
        <p className="sch-muted sch-admin-section-collapsed-hint">
          접혀 있습니다. 클릭하면 {noteCount}건의 메모를 볼 수 있습니다.
        </p>
      )}
    </section>
  );
}

export { formatTeacherNoteLine, noteByDate, notesForMonth };
