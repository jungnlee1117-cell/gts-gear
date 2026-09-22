import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { exceptionBadgeLabel } from "./schedule/scheduleExceptions.js";
import { fetchInstitutions, fetchTeachersUnfiltered } from "./schedule/api.js";
import { filterAssignableClassTeachers } from "./schedule/roles.js";
import EventRegisterForm, { EMPTY_EVENT_FORM } from "./schedule/EventRegisterForm.jsx";
import ScheduleClassCancellationPicker from "./schedule/ScheduleClassCancellationPicker.jsx";
import { createScheduleEvent } from "./schedule/createScheduleEvent.js";
import { getKoreanHoliday, holidayShortLabel } from "./schedule/koreanHolidays.js";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYmd(value) {
  const [year, month, day] = String(value || "").slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthGrid(monthBase) {
  const first = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    return {
      date,
      dateStr: ymd(date),
      inMonth: date.getMonth() === monthBase.getMonth(),
    };
  });
}

function eventsByDate(events, range) {
  const map = new Map();
  for (const event of events || []) {
    let cursor = parseYmd(event.exception_date);
    const end = parseYmd(event.end_date || event.exception_date);
    while (cursor <= end) {
      const dateStr = ymd(cursor);
      if (dateStr >= range.start && dateStr <= range.end) {
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr).push(event);
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  }
  return map;
}

function todoDateBounds(todo) {
  const due = String(todo?.due_date || "").slice(0, 10);
  const start = String(todo?.start_date || due).slice(0, 10);
  if (!start && !due) return null;
  const end = due || start;
  return start <= end ? { start, end } : { start: end, end: start };
}

function todosByDate(todos, range) {
  const map = new Map();
  for (const todo of todos || []) {
    const bounds = todoDateBounds(todo);
    if (!bounds) continue;
    let cursor = parseYmd(bounds.start);
    const end = parseYmd(bounds.end);
    while (cursor <= end) {
      const dateStr = ymd(cursor);
      if (dateStr >= range.start && dateStr <= range.end) {
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr).push(todo);
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  }
  return map;
}

function vacationsByDate(vacations, range) {
  const map = new Map();
  for (const vacation of vacations || []) {
    let cursor = parseYmd(vacation.start_date);
    const end = parseYmd(vacation.end_date);
    while (cursor <= end) {
      const dateStr = ymd(cursor);
      if (dateStr >= range.start && dateStr <= range.end) {
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr).push(vacation);
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  }
  return map;
}

function birthdaysByDate(teachers, cells) {
  const byMonthDay = new Map();
  for (const teacher of teachers || []) {
    if (teacher.role !== "teacher") continue;
    const monthDay = String(teacher.birth_date || "").slice(5, 10);
    if (!/^\d{2}-\d{2}$/.test(monthDay)) continue;
    if (!byMonthDay.has(monthDay)) byMonthDay.set(monthDay, []);
    byMonthDay.get(monthDay).push(teacher);
  }
  return new Map(cells.map(cell => [cell.dateStr, byMonthDay.get(cell.dateStr.slice(5)) || []]));
}

function isMultiDayEvent(event) {
  const start = String(event?.exception_date || "").slice(0, 10);
  const end = String(event?.end_date || start).slice(0, 10);
  return Boolean(start && end && end > start);
}

function isMultiDayTodo(todo) {
  const bounds = todoDateBounds(todo);
  return Boolean(bounds && bounds.end > bounds.start);
}

function buildWeekRangeLayout(weekCells, events, todos, vacations, monthlySummary, institutionNameById) {
  const weekStart = weekCells[0]?.dateStr;
  const weekEnd = weekCells[6]?.dateStr;
  if (!weekStart || !weekEnd) return { laneCount: 0, segments: [] };

  const items = [
    ...(monthlySummary ? [{
      key: `settlement-${monthlySummary.periodYm}`,
      type: "settlement",
      start: monthlySummary.date,
      end: monthlySummary.date,
      text: monthlySummary.text,
      done: monthlySummary.completed === monthlySummary.total,
      periodYm: monthlySummary.periodYm,
    }] : []),
    ...(events || [])
      .filter(isMultiDayEvent)
      .map((event) => ({
        key: `event-${event.id}`,
        type: "event",
        start: String(event.exception_date).slice(0, 10),
        end: String(event.end_date || event.exception_date).slice(0, 10),
        text: eventTitle(event, institutionNameById),
        done: false,
      })),
    ...(todos || [])
      .filter(isMultiDayTodo)
      .map((todo) => {
        const bounds = todoDateBounds(todo);
        return {
          key: `todo-${todo.id}`,
          type: "todo",
          start: bounds.start,
          end: bounds.end,
          text: todo.content,
          done: Boolean(todo.is_completed),
        };
      }),
    ...(vacations || []).map((vacation) => ({
      key: `vacation-${vacation.id}`,
      type: "vacation",
      start: String(vacation.start_date).slice(0, 10),
      end: String(vacation.end_date).slice(0, 10),
      text: `${vacation.teacher?.name || "선생님"} 휴무`,
      done: false,
    })),
  ]
    .filter((item) => item.start <= weekEnd && item.end >= weekStart)
    .map((item) => ({
      ...item,
      clippedStart: item.start < weekStart ? weekStart : item.start,
      clippedEnd: item.end > weekEnd ? weekEnd : item.end,
    }))
    .sort((a, b) => {
      const typePriority = { settlement: -1, todo: 0, vacation: 1, event: 2 };
      return (
        (typePriority[a.type] ?? 9) - (typePriority[b.type] ?? 9)
        || a.clippedStart.localeCompare(b.clippedStart)
        || b.clippedEnd.localeCompare(a.clippedEnd)
        || a.text.localeCompare(b.text, "ko")
      );
    });

  const laneEnds = [];
  const segments = items.map((item) => {
    const startCol = weekCells.findIndex((cell) => cell.dateStr === item.clippedStart);
    const endCol = weekCells.findIndex((cell) => cell.dateStr === item.clippedEnd);
    let lane = laneEnds.findIndex((lastEnd) => startCol > lastEnd);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = endCol;
    return { ...item, startCol, endCol, lane };
  });

  return { laneCount: laneEnds.length, segments };
}

function eventTitle(event, institutionNameById) {
  const institution = (
    event.institutions?.name
    || institutionNameById.get(event.institution_id)
    || ""
  ).trim();
  const title = exceptionBadgeLabel(event);
  return institution ? `${institution} - ${title}` : title;
}

function MonthEndChecklist({
  periodYm,
  todos,
  people,
  me,
  onToggleTodo,
  onClose,
}) {
  const nameById = useMemo(() => new Map([
    ...(people || []).map(person => [person.id, person.name || ""]),
    ...(me?.id ? [[me.id, me.name || ""]] : []),
  ]), [people, me]);
  const rows = useMemo(
    () => (todos || [])
      .filter(todo => todo.recurrence_id && todo.period_ym === periodYm)
      .slice()
      .sort((a, b) => (
        Number(a.is_completed) - Number(b.is_completed)
        || String(a.due_date || "").localeCompare(String(b.due_date || ""))
        || String(a.content || "").localeCompare(String(b.content || ""), "ko")
        || String(nameById.get(a.assignee_id) || "").localeCompare(
          String(nameById.get(b.assignee_id) || ""),
          "ko",
        )
      )),
    [todos, periodYm, nameById],
  );
  const completed = rows.filter(todo => todo.is_completed).length;
  const progress = rows.length ? Math.round((completed / rows.length) * 100) : 0;
  const [year, month] = periodYm.split("-");

  return (
    <div className="hub-month-end-overlay" role="dialog" aria-modal="true" aria-label="월말 정산 체크리스트">
      <section className="hub-month-end-checklist">
        <header className="hub-month-end-checklist__head">
          <div>
            <span className="hub-month-end-checklist__eyebrow">{year}년 {Number(month)}월</span>
            <h2>월말 정산 체크리스트</h2>
            <p>이번 달 정산 업무 {rows.length}개 중 {completed}개 완료</p>
          </div>
          <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose}>달력으로</button>
        </header>

        <div className="hub-month-end-checklist__progress" aria-label={`진행률 ${progress}%`}>
          <span style={{ width: `${progress}%` }}/>
        </div>
        <strong className="hub-month-end-checklist__progress-label">{progress}% 완료</strong>

        {rows.length === 0 ? (
          <p className="hub-month-end-checklist__empty">이 달에 생성된 반복 정산 업무가 없습니다.</p>
        ) : (
          <ul className="hub-month-end-checklist__list">
            {rows.map(todo => {
              const assignee = todo.assignee_id
                ? nameById.get(todo.assignee_id) || "담당자"
                : "공용";
              return (
                <li key={todo.id} className={todo.is_completed ? "is-done" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(todo.is_completed)}
                      onChange={event => onToggleTodo?.(todo.id, event.target.checked)}
                    />
                    <span className="hub-month-end-checklist__item-main">
                      <strong>{todo.content}</strong>
                      <small>
                        담당 {assignee}
                        {todo.start_date || todo.due_date
                          ? ` · ${String(todo.start_date || todo.due_date).slice(5).replace("-", "/")}~${String(todo.due_date || todo.start_date).slice(5).replace("-", "/")}`
                          : ""}
                      </small>
                    </span>
                    <span className="hub-month-end-checklist__status">
                      {todo.is_completed ? "완료" : "미완료"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function HubTodoCalendar({
  supabase,
  todos = [],
  teacherId,
  showTodos = true,
  showAllTodos = false,
  canRegisterEvents = false,
  canRegisterTodos = false,
  me = null,
  onRequestTodoCreate = null,
  onToggleTodo = null,
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = ymd(today);
  const [monthBase, setMonthBase] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [events, setEvents] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [calendarTeachers, setCalendarTeachers] = useState([]);
  const [loadedRange, setLoadedRange] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [institutions, setInstitutions] = useState([]);
  const [form, setForm] = useState(EMPTY_EVENT_FORM);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerNonce, setRegisterNonce] = useState(0);
  const [registerChoiceDate, setRegisterChoiceDate] = useState("");
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [expandedRangeWeeks, setExpandedRangeWeeks] = useState(() => new Set());
  const [checklistPeriod, setChecklistPeriod] = useState("");
  const [vacationForm, setVacationForm] = useState({
    teacher_id: "",
    start_date: "",
    end_date: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const cells = useMemo(() => monthGrid(monthBase), [monthBase]);
  const range = useMemo(() => ({
    start: cells[0].dateStr,
    end: cells[cells.length - 1].dateStr,
  }), [cells]);
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7)),
    [cells],
  );
  const rangeKey = `${range.start}:${range.end}`;
  const loading = loadedRange !== rangeKey;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("institution_schedule_exceptions")
      .select("id, institution_id, exception_date, end_date, exception_type, note, institutions(id, name)")
      .lte("exception_date", range.end)
      .or(`end_date.gte.${range.start},and(end_date.is.null,exception_date.gte.${range.start})`)
      .order("exception_date")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("대시보드 행사 달력 로드 실패:", error.message);
          setEvents([]);
        } else {
          setEvents(data || []);
        }
        setLoadedRange(`${range.start}:${range.end}`);
      });
    return () => { cancelled = true; };
  }, [supabase, range.start, range.end, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from("teacher_vacations")
        .select("id, teacher_id, start_date, end_date, note, teacher:teachers!teacher_vacations_teacher_id_fkey(id, name)")
        .lte("start_date", range.end)
        .gte("end_date", range.start)
        .order("start_date"),
      fetchTeachersUnfiltered(),
    ]).then(([vacationResult, people]) => {
      if (cancelled) return;
      if (vacationResult.error) console.warn("선생님 휴가 로드 실패:", vacationResult.error.message);
      setVacations(vacationResult.data || []);
      setCalendarTeachers(filterAssignableClassTeachers(people).filter(
        person => person.active !== false && !person.resigned_at,
      ));
    }).catch(error => {
      if (!cancelled) console.warn("휴무 대상·생일 로드 실패:", error);
    });
    return () => { cancelled = true; };
  }, [supabase, range.start, range.end, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    fetchInstitutions({
      activeOnly: !canRegisterEvents,
      teacherScope: !canRegisterEvents,
    })
      .then(rows => {
        if (!cancelled) setInstitutions(rows || []);
      })
      .catch(error => {
        if (!cancelled) console.warn("행사 등록 기관 로드 실패:", error);
      });
    return () => { cancelled = true; };
  }, [canRegisterEvents]);

  const institutionNameById = useMemo(
    () => new Map(institutions.map(institution => [institution.id, institution.name || ""])),
    [institutions],
  );

  const visibleDueTodos = useMemo(
    () => {
      if (!showTodos) return [];
      const now = today.getTime();
      return (todos || []).filter(todo => {
        if (!todo.due_date) return false;
        if (todo.recurrence_id) return false;
        // 관리자 달력은 자신이 다른 담당자에게 배정했거나 공용으로 만든
        // 할 일도 확인해야 한다. 일반 사용자는 본인에게 배정된 항목만 본다.
        if (!showAllTodos && todo.assignee_id !== teacherId) return false;
        if (todo.is_completed && todo.completed_at) {
          return now - new Date(todo.completed_at).getTime() < 24 * 60 * 60 * 1000;
        }
        return true;
      });
    },
    [todos, teacherId, today, showTodos, showAllTodos],
  );

  const monthPeriodYm = `${monthBase.getFullYear()}-${String(monthBase.getMonth() + 1).padStart(2, "0")}`;
  const monthRecurringTodos = useMemo(
    () => showTodos
      ? (todos || []).filter(todo => todo.recurrence_id && todo.period_ym === monthPeriodYm)
      : [],
    [todos, monthPeriodYm, showTodos],
  );
  const monthlySummary = useMemo(() => {
    if (!monthRecurringTodos.length) return null;
    const completed = monthRecurringTodos.filter(todo => todo.is_completed).length;
    return {
      periodYm: monthPeriodYm,
      date: ymd(new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0)),
      total: monthRecurringTodos.length,
      completed,
      text: `월말 정산 업무 ${monthRecurringTodos.length}개 · ${completed}개 완료`,
    };
  }, [monthRecurringTodos, monthPeriodYm, monthBase]);

  const eventMap = useMemo(() => eventsByDate(events, range), [events, range]);
  const todoMap = useMemo(() => todosByDate(visibleDueTodos, range), [visibleDueTodos, range]);
  const vacationMap = useMemo(() => vacationsByDate(vacations, range), [vacations, range]);
  const birthdayMap = useMemo(() => birthdaysByDate(calendarTeachers, cells), [calendarTeachers, cells]);
  const weekRangeLayouts = useMemo(
    () => weeks.map((week) => buildWeekRangeLayout(
      week,
      events,
      visibleDueTodos,
      vacations,
      monthlySummary,
      institutionNameById,
    )),
    [weeks, events, visibleDueTodos, vacations, monthlySummary, institutionNameById],
  );

  const selectedEvents = eventMap.get(selectedDate) || [];
  const selectedTodos = todoMap.get(selectedDate) || [];
  const selectedVacations = vacationMap.get(selectedDate) || [];
  const selectedBirthdays = birthdayMap.get(selectedDate) || [];
  const selectedHoliday = getKoreanHoliday(selectedDate);

  const moveMonth = (offset) => {
    const next = new Date(monthBase.getFullYear(), monthBase.getMonth() + offset, 1);
    setMonthBase(next);
    setSelectedDate(ymd(next));
  };

  const returnToday = () => {
    setMonthBase(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayStr);
  };

  const openRegisterForDate = (dateStr) => {
    if (!canRegisterEvents) return;
    setForm({
      ...EMPTY_EVENT_FORM,
      start_date: dateStr,
      cancelled_classes: [],
      class_candidate_count: 0,
    });
    setRegisterNonce(token => token + 1);
    setShowRegisterModal(true);
  };

  const openRegisterChoice = (dateStr) => {
    if (!canRegisterEvents && !canRegisterTodos) return;
    setSelectedDate(dateStr);
    if (!canRegisterEvents && canRegisterTodos) {
      onRequestTodoCreate?.(dateStr);
      return;
    }
    setRegisterChoiceDate(dateStr);
  };

  const chooseEventRegister = () => {
    const dateStr = registerChoiceDate;
    setRegisterChoiceDate("");
    openRegisterForDate(dateStr);
  };

  const chooseTodoRegister = () => {
    const dateStr = registerChoiceDate;
    setRegisterChoiceDate("");
    onRequestTodoCreate?.(dateStr);
  };

  const chooseVacationRegister = () => {
    const dateStr = registerChoiceDate;
    setRegisterChoiceDate("");
    setVacationForm({
      teacher_id: "",
      start_date: dateStr,
      end_date: dateStr,
      note: "",
    });
    setShowVacationModal(true);
  };

  const closeVacationModal = () => {
    if (saving) return;
    setShowVacationModal(false);
  };

  const toggleRangeWeek = (weekKey) => {
    setExpandedRangeWeeks(previous => {
      const next = new Set(previous);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  };

  const handleVacationRegister = async (event) => {
    event.preventDefault();
    if (!vacationForm.teacher_id) return alert("선생님 또는 관리자를 선택해주세요.");
    if (!vacationForm.start_date || !vacationForm.end_date) return alert("휴무 기간을 입력해주세요.");
    if (vacationForm.end_date < vacationForm.start_date) return alert("종료일은 시작일 이후여야 합니다.");
    setSaving(true);
    try {
      const { error } = await supabase.from("teacher_vacations").insert({
        teacher_id: vacationForm.teacher_id,
        start_date: vacationForm.start_date,
        end_date: vacationForm.end_date,
        note: vacationForm.note.trim() || null,
        created_by: me?.id || null,
      });
      if (error) throw error;
      setSelectedDate(vacationForm.start_date);
      setShowVacationModal(false);
      setReloadToken(token => token + 1);
    } catch (error) {
      alert("휴무 저장 실패: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVacationDelete = async (vacation) => {
    if (!canRegisterEvents || !vacation?.id) return;
    if (!confirm(`${vacation.teacher?.name || "선생님"} 휴무를 삭제할까요?`)) return;
    const { error } = await supabase.from("teacher_vacations").delete().eq("id", vacation.id);
    if (error) {
      alert("휴무 삭제 실패: " + error.message);
      return;
    }
    setReloadToken(token => token + 1);
  };

  const closeRegisterModal = () => {
    if (saving) return;
    setShowRegisterModal(false);
    setForm(EMPTY_EVENT_FORM);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (!canRegisterEvents) return;
    if (!form.institution_id) return alert("원을 선택해주세요.");
    if (!form.start_date) return alert("시작 날짜를 입력해주세요.");
    if (!form.note.trim()) return alert("메모를 입력해주세요.");
    const end = form.end_date || form.start_date;
    if (end < form.start_date) return alert("종료일은 시작일 이후여야 합니다.");

    const selectedClasses = Array.isArray(form.cancelled_classes) ? form.cancelled_classes : [];
    if (form.exception_type === "class_cancelled" && selectedClasses.length === 0) {
      return alert("휴강할 수업을 한 개 이상 선택해주세요.");
    }
    const allClassesSelected = (
      form.exception_type === "class_cancelled"
      && form.class_candidate_count > 0
      && selectedClasses.length === form.class_candidate_count
    );
    const payload = {
      institution_id: form.institution_id,
      exception_date: form.start_date,
      end_date: form.end_date && form.end_date !== form.start_date ? form.end_date : null,
      exception_type: allClassesSelected ? "cancelled" : form.exception_type,
      note: form.note.trim(),
    };

    setSaving(true);
    try {
      await createScheduleEvent({ payload, selectedClasses, author: me });
      setSelectedDate(form.start_date);
      setShowRegisterModal(false);
      setForm(EMPTY_EVENT_FORM);
      setLoadedRange("");
      setReloadToken(token => token + 1);
    } catch (error) {
      alert("저장 실패: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="hub-todo-calendar" aria-label="행사 및 내 할 일 달력">
      <header className="hub-todo-calendar__head">
        <div>
          <h2>일정 달력</h2>
          <p>
            {canRegisterEvents
              ? "날짜를 두 번 클릭하면 행사·휴강 또는 할 일을 등록할 수 있습니다."
              : canRegisterTodos
                ? "날짜를 두 번 클릭하면 내 할 일을 등록할 수 있습니다."
              : showTodos
                ? "행사와 마감일이 있는 내 할 일을 함께 확인하세요."
                : "내가 수업하는 원의 행사 일정을 확인하세요."}
          </p>
        </div>
        <div className="hub-todo-calendar__nav">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft size={17}/></button>
          <strong>{monthBase.getFullYear()}년 {monthBase.getMonth() + 1}월</strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight size={17}/></button>
          <button type="button" className="hub-todo-calendar__today" onClick={returnToday}>오늘</button>
        </div>
      </header>

      <div className="hub-todo-calendar__legend">
        <span><i className="is-event"/>행사</span>
        {showTodos ? <span><i className="is-todo"/>내 할 일</span> : null}
        <span><i className="is-vacation"/>휴무</span>
        <span><i className="is-birthday"/>생일</span>
        <span><i className="is-holiday"/>공휴일</span>
      </div>

      <div className="hub-todo-calendar__grid" role="grid" aria-label={`${monthBase.getMonth() + 1}월 일정`}>
        {DAY_LABELS.map(label => <div key={label} className="hub-todo-calendar__weekday">{label}</div>)}
        {weeks.map((week, weekIndex) => {
          const layout = weekRangeLayouts[weekIndex] || { laneCount: 0, segments: [] };
          const weekKey = week[0].dateStr;
          const hasRangeOverflow = layout.laneCount > 2;
          const rangeExpanded = expandedRangeWeeks.has(weekKey);
          const visibleRangeSegments = hasRangeOverflow && !rangeExpanded
            ? layout.segments.filter(segment => segment.lane < 2)
            : layout.segments;
          const hiddenRangeCount = layout.segments.length - visibleRangeSegments.length;
          const displayedRangeRows = rangeExpanded
            ? layout.laneCount + 1
            : hasRangeOverflow
              ? 3
              : layout.laneCount;
          return (
            <div
              key={`week-${weekKey}`}
              className="hub-todo-calendar__week"
              role="row"
              style={{ "--range-space": `${displayedRangeRows * 16}px` }}
            >
              {week.map(({ date, dateStr, inMonth }) => {
                const dayEvents = eventMap.get(dateStr) || [];
                const dayTodos = todoMap.get(dateStr) || [];
                const dayBirthdays = birthdayMap.get(dateStr) || [];
                const holiday = inMonth ? getKoreanHoliday(dateStr) : null;
                const entries = [
                  ...dayEvents
                    .filter((event) => !isMultiDayEvent(event))
                    .map(event => ({
                      key: `event-${event.id}`,
                      type: "event",
                      text: eventTitle(event, institutionNameById),
                    })),
                  ...dayTodos
                    .filter((todo) => !isMultiDayTodo(todo))
                    .map(todo => ({
                      key: `todo-${todo.id}`,
                      type: "todo",
                      text: todo.content,
                      done: todo.is_completed,
                    })),
                  ...dayBirthdays.map(teacher => ({
                    key: `birthday-${teacher.id}-${dateStr}`,
                    type: "birthday",
                    text: `🎂 ${teacher.name} 생일`,
                  })),
                ];
                return (
                  <button
                    key={dateStr}
                    type="button"
                    role="gridcell"
                    data-date={dateStr}
                    aria-label={`${dateStr}${holiday ? ` ${holiday.name}` : ""} 일정`}
                    className={[
                      "hub-todo-calendar__day",
                      !inMonth && "is-outside",
                      dateStr === todayStr && "is-today",
                      dateStr === selectedDate && "is-selected",
                      holiday && "is-holiday",
                    ].filter(Boolean).join(" ")}
                    onClick={() => {
                      setSelectedDate(dateStr);
                      if (!inMonth) setMonthBase(new Date(date.getFullYear(), date.getMonth(), 1));
                    }}
                    onDoubleClick={() => openRegisterChoice(dateStr)}
                  >
                    <span className="hub-todo-calendar__day-head">
                      <span className="hub-todo-calendar__date">{date.getDate()}</span>
                      {holiday ? (
                        <span className="hub-todo-calendar__holiday" title={holiday.name}>
                          {holidayShortLabel(holiday.name)}
                        </span>
                      ) : null}
                    </span>
                    <span className="hub-todo-calendar__range-space" aria-hidden />
                    <span className="hub-todo-calendar__entries">
                      {entries.slice(0, 2).map(entry => (
                        <span
                          key={entry.key}
                          className={`hub-todo-calendar__entry is-${entry.type}${entry.done ? " is-done" : ""}`}
                          title={entry.text}
                        >
                          {entry.text}
                        </span>
                      ))}
                      {entries.length > 2 ? <span className="hub-todo-calendar__more">+{entries.length - 2}</span> : null}
                    </span>
                  </button>
                );
              })}
              {displayedRangeRows > 0 ? (
                <div className="hub-todo-calendar__range-layer">
                  {visibleRangeSegments.map((segment) => {
                    const commonProps = {
                      className: [
                        "hub-todo-calendar__range-bar",
                        `is-${segment.type}`,
                        segment.done && "is-done",
                      ].filter(Boolean).join(" "),
                      style: {
                        gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                        gridRow: segment.lane + 1,
                      },
                      title: segment.text,
                    };
                    return segment.type === "settlement" ? (
                      <button
                        key={`${segment.key}-${weekIndex}`}
                        {...commonProps}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setChecklistPeriod(segment.periodYm);
                        }}
                      >
                        {segment.text}
                      </button>
                    ) : (
                      <span key={`${segment.key}-${weekIndex}`} {...commonProps}>{segment.text}</span>
                    );
                  })}
                  {hasRangeOverflow ? (
                    <button
                      type="button"
                      className="hub-todo-calendar__range-more"
                      aria-expanded={rangeExpanded}
                      style={{
                        gridColumn: "1 / -1",
                        gridRow: rangeExpanded ? layout.laneCount + 1 : 3,
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleRangeWeek(weekKey);
                      }}
                    >
                      {rangeExpanded ? "접기" : `+${hiddenRangeCount}개 더보기`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hub-todo-calendar__detail">
        <strong>{selectedDate.replaceAll("-", ".")} 일정</strong>
        {selectedHoliday ? (
          <p className="hub-todo-calendar__holiday-banner">공휴일 · {selectedHoliday.name}</p>
        ) : null}
        {loading ? (
          <p>행사를 불러오는 중...</p>
        ) : selectedEvents.length === 0
          && selectedTodos.length === 0
          && selectedVacations.length === 0
          && selectedBirthdays.length === 0 ? (
          <p>{showTodos ? "등록된 행사나 마감 할 일이 없습니다." : "등록된 행사가 없습니다."}</p>
        ) : (
          <ul>
            {selectedEvents.map(event => (
              <li key={`event-${event.id}`}>
                <i className="is-event"/>
                <span>{eventTitle(event, institutionNameById)}</span>
              </li>
            ))}
            {selectedTodos.map(todo => (
              <li key={`todo-${todo.id}`} className={todo.is_completed ? "is-done" : ""}>
                <i className="is-todo"/><span>{todo.content}</span>
              </li>
            ))}
            {selectedVacations.map(vacation => (
              <li key={`vacation-${vacation.id}`}>
                <i className="is-vacation"/>
                <span>{vacation.teacher?.name || "선생님"} 휴무{vacation.note ? ` · ${vacation.note}` : ""}</span>
                {canRegisterEvents ? (
                  <button
                    type="button"
                    className="hub-todo-calendar__detail-delete"
                    onClick={() => handleVacationDelete(vacation)}
                  >
                    삭제
                  </button>
                ) : null}
              </li>
            ))}
            {selectedBirthdays.map(teacher => (
              <li key={`birthday-${teacher.id}`}>
                <i className="is-birthday"/><span>🎂 {teacher.name} 생일</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </section>

      {canRegisterEvents && registerChoiceDate ? (
        <div className="sch-modal-overlay" onClick={() => setRegisterChoiceDate("")}>
          <div className="sch-modal" onClick={event => event.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>{registerChoiceDate.replaceAll("-", ".")} 등록</h3>
            </div>
            <p className="sch-muted">등록할 일정 종류를 선택해주세요.</p>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setRegisterChoiceDate("")}>
                취소
              </button>
              {canRegisterTodos ? (
                <button type="button" className="sch-btn sch-btn--primary" onClick={chooseTodoRegister}>
                  할 일 등록
                </button>
              ) : null}
              <button type="button" className="sch-btn sch-btn--primary" onClick={chooseVacationRegister}>
                휴무 등록
              </button>
              <button type="button" className="sch-btn sch-btn--primary" onClick={chooseEventRegister}>
                행사 등록
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canRegisterEvents && showRegisterModal ? (
        <div className="sch-modal-overlay" onClick={closeRegisterModal}>
          <div className="sch-modal sch-modal--wide" onClick={event => event.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>행사 등록 · {form.start_date}</h3>
            </div>
            <EventRegisterForm
              key={`hub-event-${registerNonce}`}
              form={form}
              setForm={setForm}
              institutions={institutions}
              saving={saving}
              onSubmit={handleRegister}
              onCancel={closeRegisterModal}
              showCancel
              useSearchSelect
              allowClassCancellation
              classCancellationField={<ScheduleClassCancellationPicker form={form} setForm={setForm}/>}
            />
          </div>
        </div>
      ) : null}

      {canRegisterEvents && showVacationModal ? (
        <div className="sch-modal-overlay" onClick={closeVacationModal}>
          <form className="sch-modal" onSubmit={handleVacationRegister} onClick={event => event.stopPropagation()}>
            <div className="sch-modal-head"><h3>휴무 등록</h3></div>
            <label className="sch-field">
              <span>선생님·관리자</span>
              <select
                className="sch-select"
                value={vacationForm.teacher_id}
                onChange={event => setVacationForm(form => ({ ...form, teacher_id: event.target.value }))}
                required
              >
                <option value="">선택해주세요</option>
                {calendarTeachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </label>
            <div className="sch-form-grid sch-form-grid--2">
              <label className="sch-field">
                <span>시작일</span>
                <input
                  className="sch-input"
                  type="date"
                  value={vacationForm.start_date}
                  onChange={event => setVacationForm(form => ({ ...form, start_date: event.target.value }))}
                  required
                />
              </label>
              <label className="sch-field">
                <span>종료일</span>
                <input
                  className="sch-input"
                  type="date"
                  min={vacationForm.start_date}
                  value={vacationForm.end_date}
                  onChange={event => setVacationForm(form => ({ ...form, end_date: event.target.value }))}
                  required
                />
              </label>
            </div>
            <label className="sch-field">
              <span>메모 (선택)</span>
              <input
                className="sch-input"
                value={vacationForm.note}
                onChange={event => setVacationForm(form => ({ ...form, note: event.target.value }))}
                placeholder="예: 연차"
              />
            </label>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={closeVacationModal}>취소</button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "저장 중..." : "휴무 등록"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {checklistPeriod ? (
        <MonthEndChecklist
          periodYm={checklistPeriod}
          todos={todos}
          people={calendarTeachers}
          me={me}
          onToggleTodo={onToggleTodo}
          onClose={() => setChecklistPeriod("")}
        />
      ) : null}
    </>
  );
}
