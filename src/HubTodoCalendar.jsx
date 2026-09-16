import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { exceptionBadgeLabel } from "./schedule/scheduleExceptions.js";
import { fetchInstitutions } from "./schedule/api.js";
import EventRegisterForm, { EMPTY_EVENT_FORM } from "./schedule/EventRegisterForm.jsx";
import ScheduleClassCancellationPicker from "./schedule/ScheduleClassCancellationPicker.jsx";
import { createScheduleEvent } from "./schedule/createScheduleEvent.js";

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

function monthRange(monthBase) {
  const year = monthBase.getFullYear();
  const month = monthBase.getMonth();
  return {
    start: ymd(new Date(year, month, 1)),
    end: ymd(new Date(year, month + 1, 0)),
  };
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

function eventTitle(event) {
  const institution = event.institutions?.name?.trim();
  const title = exceptionBadgeLabel(event);
  return institution ? `${institution} - ${title}` : title;
}

export default function HubTodoCalendar({
  supabase,
  todos = [],
  teacherId,
  showTodos = true,
  canRegisterEvents = false,
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
  const [registerChoiceDate, setRegisterChoiceDate] = useState("");
  const [saving, setSaving] = useState(false);
  const range = useMemo(() => monthRange(monthBase), [monthBase]);
  const cells = useMemo(() => monthGrid(monthBase), [monthBase]);
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
    if (!canRegisterEvents) return undefined;
    let cancelled = false;
    fetchInstitutions({ activeOnly: false })
      .then(rows => {
        if (!cancelled) setInstitutions(rows || []);
      })
      .catch(error => {
        if (!cancelled) console.warn("행사 등록 기관 로드 실패:", error);
      });
    return () => { cancelled = true; };
  }, [canRegisterEvents]);

  const myDueTodos = useMemo(
    () => {
      if (!showTodos) return [];
      const now = today.getTime();
      return (todos || []).filter(todo => {
        if (todo.assignee_id !== teacherId || !todo.due_date || todo.spawn_group_id) return false;
        if (todo.is_completed && todo.completed_at) {
          return now - new Date(todo.completed_at).getTime() < 24 * 60 * 60 * 1000;
        }
        return true;
      });
    },
    [todos, teacherId, today, showTodos],
  );

  const eventMap = useMemo(() => eventsByDate(events, range), [events, range]);
  const todoMap = useMemo(() => {
    const map = new Map();
    for (const todo of myDueTodos) {
      const date = String(todo.due_date).slice(0, 10);
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(todo);
    }
    return map;
  }, [myDueTodos]);

  const selectedEvents = eventMap.get(selectedDate) || [];
  const selectedTodos = todoMap.get(selectedDate) || [];

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
    setShowRegisterModal(true);
  };

  const openRegisterChoice = (dateStr) => {
    if (!canRegisterEvents) return;
    setSelectedDate(dateStr);
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
      </div>

      <div className="hub-todo-calendar__grid" role="grid" aria-label={`${monthBase.getMonth() + 1}월 일정`}>
        {DAY_LABELS.map(label => <div key={label} className="hub-todo-calendar__weekday">{label}</div>)}
        {cells.map(({ date, dateStr, inMonth }) => {
          const dayEvents = eventMap.get(dateStr) || [];
          const dayTodos = todoMap.get(dateStr) || [];
          const entries = [
            ...dayEvents.map(event => ({ key: `event-${event.id}`, type: "event", text: eventTitle(event) })),
            ...dayTodos.map(todo => ({ key: `todo-${todo.id}`, type: "todo", text: todo.content, done: todo.is_completed })),
          ];
          return (
            <button
              key={dateStr}
              type="button"
              role="gridcell"
              className={[
                "hub-todo-calendar__day",
                !inMonth && "is-outside",
                dateStr === todayStr && "is-today",
                dateStr === selectedDate && "is-selected",
              ].filter(Boolean).join(" ")}
              onClick={() => {
                setSelectedDate(dateStr);
                if (!inMonth) setMonthBase(new Date(date.getFullYear(), date.getMonth(), 1));
              }}
              onDoubleClick={() => openRegisterChoice(dateStr)}
            >
              <span className="hub-todo-calendar__date">{date.getDate()}</span>
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
      </div>

      <div className="hub-todo-calendar__detail">
        <strong>{selectedDate.replaceAll("-", ".")} 일정</strong>
        {loading ? (
          <p>행사를 불러오는 중...</p>
        ) : selectedEvents.length === 0 && selectedTodos.length === 0 ? (
          <p>{showTodos ? "등록된 행사나 마감 할 일이 없습니다." : "등록된 행사가 없습니다."}</p>
        ) : (
          <ul>
            {selectedEvents.map(event => (
              <li key={`event-${event.id}`}><i className="is-event"/><span>{eventTitle(event)}</span></li>
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
              <button type="button" className="sch-btn sch-btn--primary" onClick={chooseTodoRegister}>
                할 일 등록
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
