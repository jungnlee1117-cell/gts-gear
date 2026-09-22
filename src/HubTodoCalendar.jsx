import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { exceptionBadgeLabel } from "./schedule/scheduleExceptions.js";
import { fetchInstitutions } from "./schedule/api.js";
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

function isMultiDayEvent(event) {
  const start = String(event?.exception_date || "").slice(0, 10);
  const end = String(event?.end_date || start).slice(0, 10);
  return Boolean(start && end && end > start);
}

function isMultiDayTodo(todo) {
  const bounds = todoDateBounds(todo);
  return Boolean(bounds && bounds.end > bounds.start);
}

function buildWeekRangeLayout(weekCells, events, todos, institutionNameById) {
  const weekStart = weekCells[0]?.dateStr;
  const weekEnd = weekCells[6]?.dateStr;
  if (!weekStart || !weekEnd) return { laneCount: 0, segments: [] };

  const items = [
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
  ]
    .filter((item) => item.start <= weekEnd && item.end >= weekStart)
    .map((item) => ({
      ...item,
      clippedStart: item.start < weekStart ? weekStart : item.start,
      clippedEnd: item.end > weekEnd ? weekEnd : item.end,
    }))
    .sort((a, b) => (
      a.clippedStart.localeCompare(b.clippedStart)
      || b.clippedEnd.localeCompare(a.clippedEnd)
      || a.type.localeCompare(b.type)
      || a.text.localeCompare(b.text, "ko")
    ));

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

export default function HubTodoCalendar({
  supabase,
  todos = [],
  teacherId,
  showTodos = true,
  canRegisterEvents = false,
  canRegisterTodos = false,
  me = null,
  onRequestTodoCreate = null,
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = ymd(today);
  const [monthBase, setMonthBase] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [events, setEvents] = useState([]);
  const [loadedRange, setLoadedRange] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [institutions, setInstitutions] = useState([]);
  const [form, setForm] = useState(EMPTY_EVENT_FORM);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerNonce, setRegisterNonce] = useState(0);
  const [registerChoiceDate, setRegisterChoiceDate] = useState("");
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

  const myDueTodos = useMemo(
    () => {
      if (!showTodos) return [];
      const now = today.getTime();
      return (todos || []).filter(todo => {
        if (todo.assignee_id !== teacherId || !todo.due_date) return false;
        if (todo.is_completed && todo.completed_at) {
          return now - new Date(todo.completed_at).getTime() < 24 * 60 * 60 * 1000;
        }
        return true;
      });
    },
    [todos, teacherId, today, showTodos],
  );

  const eventMap = useMemo(() => eventsByDate(events, range), [events, range]);
  const todoMap = useMemo(() => todosByDate(myDueTodos, range), [myDueTodos, range]);
  const weekRangeLayouts = useMemo(
    () => weeks.map((week) => buildWeekRangeLayout(
      week,
      events,
      myDueTodos,
      institutionNameById,
    )),
    [weeks, events, myDueTodos, institutionNameById],
  );

  const selectedEvents = eventMap.get(selectedDate) || [];
  const selectedTodos = todoMap.get(selectedDate) || [];
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
        <span><i className="is-holiday"/>공휴일</span>
      </div>

      <div className="hub-todo-calendar__grid" role="grid" aria-label={`${monthBase.getMonth() + 1}월 일정`}>
        {DAY_LABELS.map(label => <div key={label} className="hub-todo-calendar__weekday">{label}</div>)}
        {weeks.map((week, weekIndex) => {
          const layout = weekRangeLayouts[weekIndex] || { laneCount: 0, segments: [] };
          return (
            <div
              key={`week-${week[0].dateStr}`}
              className="hub-todo-calendar__week"
              role="row"
              style={{ "--range-space": `${layout.laneCount * 16}px` }}
            >
              {week.map(({ date, dateStr, inMonth }) => {
                const dayEvents = eventMap.get(dateStr) || [];
                const dayTodos = todoMap.get(dateStr) || [];
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
              {layout.laneCount > 0 ? (
                <div className="hub-todo-calendar__range-layer" aria-hidden="true">
                  {layout.segments.map((segment) => (
                    <span
                      key={`${segment.key}-${weekIndex}`}
                      className={[
                        "hub-todo-calendar__range-bar",
                        `is-${segment.type}`,
                        segment.done && "is-done",
                      ].filter(Boolean).join(" ")}
                      style={{
                        gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                        gridRow: segment.lane + 1,
                      }}
                      title={segment.text}
                    >
                      {segment.text}
                    </span>
                  ))}
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
        ) : selectedEvents.length === 0 && selectedTodos.length === 0 ? (
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
    </>
  );
}
