import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { fetchOneoffLessons, fetchTeachers } from "./api.js";
import { deleteOneoffLessonRecord } from "./oneoffLessonService.js";
import { oneoffLessonMinutes } from "./oneoffLessons.js";
import { DAY_LABELS, formatWon, yearMonthKey } from "./constants.js";
import OneoffLessonModal from "./OneoffLessonModal.jsx";

function formatTime(t) {
  return t ? String(t).slice(0, 5) : "";
}

function formatLessonDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d} (${DAY_LABELS[dt.getDay()]})`;
}

/** 수업등록/변경 — 일일등록 탭. 등록 폼은 OneoffLessonModal 재사용 */
export default function OneoffLessonRegisterPanel({ me }) {
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);

  useEffect(() => {
    fetchTeachers()
      .then(all => setTeachers((all || []).filter(t => t.role === "teacher")))
      .catch(err => {
        console.error(err);
        alert("선생님 목록을 불러오지 못했습니다: " + err.message);
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLessons(await fetchOneoffLessons({
        teacherId: teacherId || undefined,
        yearMonth,
      }));
    } catch (err) {
      console.error(err);
      alert("일일등록 목록을 불러오지 못했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [teacherId, yearMonth]);

  useEffect(() => { load(); }, [load]);

  const teacherMap = useMemo(
    () => new Map(teachers.map(t => [t.id, t.name])),
    [teachers],
  );

  const [y, m] = yearMonth.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;

  const shiftMonth = (delta) => {
    setYearMonth(prev => {
      const [yy, mm] = prev.split("-").map(Number);
      return yearMonthKey(new Date(yy, mm - 1 + delta, 1));
    });
  };

  const openCreate = () => {
    setEditingLesson(null);
    setModalOpen(true);
  };

  const openEdit = (lesson) => {
    setEditingLesson(lesson);
    setModalOpen(true);
  };

  /** 저장 직후 등록한 강사·월로 필터를 맞춰 목록에 바로 보이게 */
  const handleSaved = (saved) => {
    const nextTeacherId = saved?.teacherId || teacherId;
    const nextYearMonth = saved?.lessonDate
      ? String(saved.lessonDate).slice(0, 7)
      : yearMonth;
    if (nextTeacherId !== teacherId) setTeacherId(nextTeacherId);
    if (nextYearMonth !== yearMonth) setYearMonth(nextYearMonth);
    if (nextTeacherId === teacherId && nextYearMonth === yearMonth) load();
  };

  const handleDelete = async (lesson) => {
    const instName = lesson.institutions?.name || "기관 미지정";
    const label = `${formatLessonDate(lesson.lesson_date)} ${formatTime(lesson.start_time)}–${formatTime(lesson.end_time)} · ${instName}`;
    if (!confirm(`이 일일등록 수업을 삭제할까요?${lesson.payroll_entry_id ? "\n연결된 급여 항목도 함께 삭제됩니다." : ""}\n\n${label}`)) return;
    try {
      await deleteOneoffLessonRecord(lesson);
      await load();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    }
  };

  return (
    <div className="sch-oneoff-register-panel">
      <div className="sch-regular-classes-toolbar">
        <label className="sch-field sch-regular-classes-filter">
          <span>선생님 (목록 조회)</span>
          <select
            className="sch-select"
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
          >
            <option value="">전체</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="sch-btn sch-btn--primary"
          onClick={openCreate}
        >
          <Plus size={14}/> 일일등록
        </button>
      </div>

      <p className="sch-muted sch-regular-classes-hint">
        정규 시간표에 없는 일회성 수업을 등록합니다. 일일등록 버튼을 누른 뒤 선생님과 날짜를 선택하세요.
        급여 반영을 켜면 해당 날짜 급여 항목이 함께 생성됩니다.
      </p>

      <div className="sch-month-nav">
        <button type="button" className="sch-btn sch-btn--ghost" onClick={() => shiftMonth(-1)} aria-label="이전 달">
          ←
        </button>
        <span className="sch-month-label">{monthLabel}</span>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={() => shiftMonth(1)} aria-label="다음 달">
          →
        </button>
        <button type="button" className="sch-btn sch-btn--ghost sch-btn--today" onClick={() => setYearMonth(yearMonthKey())}>
          이번 달
        </button>
      </div>

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : lessons.length === 0 ? (
        <p className="sch-muted">
          {monthLabel}에 {teacherId ? `${teacherMap.get(teacherId) || ""} 선생님의 ` : ""}등록된 일일등록 수업이 없습니다.
        </p>
      ) : (
        <ul className="sch-regular-classes-list">
          {lessons.map(lesson => {
            const institutionName = lesson.institutions?.name || "기관 미지정";
            const lessonTeacherName = teacherMap.get(lesson.teacher_id) || "강사 미지정";
            const payrollLabel = lesson.link_payroll
              ? (lesson.pay_amount != null ? `급여 ${formatWon(lesson.pay_amount)}` : "급여 반영")
              : "급여 미반영";
            return (
              <li key={lesson.id} className="sch-regular-classes-item">
                <button
                  type="button"
                  className="sch-regular-classes-main sch-regular-classes-main--oneoff"
                  onClick={() => openEdit(lesson)}
                >
                  <span className="sch-regular-classes-dow">{formatLessonDate(lesson.lesson_date)}</span>
                  <span className="sch-regular-classes-time">
                    {formatTime(lesson.start_time)}–{formatTime(lesson.end_time)}
                  </span>
                  <span className="sch-regular-classes-type sch-regular-classes-type--oneoff">일일</span>
                  <span className="sch-regular-classes-inst" title={institutionName}>{institutionName}</span>
                  <span className="sch-regular-classes-teacher">{lessonTeacherName}</span>
                  <span className="sch-regular-classes-range">
                    {oneoffLessonMinutes(lesson)}분 · {payrollLabel}
                  </span>
                  {lesson.memo ? (
                    <span className="sch-regular-classes-note" title={lesson.memo}>{lesson.memo}</span>
                  ) : null}
                </button>
                <div className="sch-regular-classes-actions">
                  <button
                    type="button"
                    className="sch-btn sch-btn--ghost sch-btn--sm"
                    onClick={() => openEdit(lesson)}
                  >
                    <Pencil size={13}/> 수정
                  </button>
                  <button
                    type="button"
                    className="sch-btn sch-btn--ghost sch-btn--sm sch-regular-classes-delete"
                    onClick={() => handleDelete(lesson)}
                  >
                    <Trash2 size={13}/> 삭제
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <OneoffLessonModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingLesson(null);
        }}
        me={me}
        teacherId={editingLesson ? editingLesson.teacher_id : undefined}
        teacherName={editingLesson ? (teacherMap.get(editingLesson.teacher_id) || "") : ""}
        lessonDate={editingLesson ? String(editingLesson.lesson_date).slice(0, 10) : undefined}
        initialTeacherId={teacherId}
        markNotificationRead
        editingLesson={editingLesson}
        onSaved={handleSaved}
      />
    </div>
  );
}
