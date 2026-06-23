import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Trash2 } from "lucide-react";
import {
  DAY_LABELS,
  EXCEPTION_LABELS,
  institutionColor,
  yearMonthKey,
  yearMonthLastDay,
} from "./constants.js";
import {
  deleteScheduleException,
  fetchInstitutions,
  fetchScheduleExceptions,
  saveScheduleException,
} from "./api.js";
import {
  exceptionsForDate,
  filterExceptionsForMonth,
  formatExceptionNotice,
} from "./scheduleExceptions.js";
import { fmtLocalDate, getMonthGrid } from "./payrollCalendar.js";
import { isScheduleAdmin } from "./roles.js";

const EMPTY_FORM = {
  institution_id: "",
  start_date: "",
  end_date: "",
  exception_type: "event",
  note: "",
};

export default function EventsScheduleView({ me, onBack }) {
  const admin = isScheduleAdmin(me);
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [institutions, setInstitutions] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDate, setSelectedDate] = useState(() => fmtLocalDate(new Date()));

  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = `${yearMonth}-01`;
  const monthEnd = yearMonthLastDay(yearMonth);
  const monthLabel = `${y}년 ${m}월`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insts, ex] = await Promise.all([
        fetchInstitutions({ activeOnly: false }),
        fetchScheduleExceptions(null, monthStart, monthEnd),
      ]);
      setInstitutions(insts);
      setExceptions(ex);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  const monthExceptions = useMemo(
    () => filterExceptionsForMonth(exceptions, y, m - 1),
    [exceptions, y, m],
  );

  const selectedDayExceptions = useMemo(
    () => exceptionsForDate(monthExceptions, selectedDate),
    [monthExceptions, selectedDate],
  );

  const exceptionsByDate = useMemo(() => {
    const map = {};
    for (const ex of monthExceptions) {
      const end = ex.end_date || ex.exception_date;
      let cur = ex.exception_date;
      while (cur <= end) {
        if (cur >= monthStart && cur <= monthEnd) {
          if (!map[cur]) map[cur] = [];
          if (!map[cur].some(e => e.id === ex.id)) map[cur].push(ex);
        }
        const [cy, cm, cd] = cur.split("-").map(Number);
        cur = fmtLocalDate(new Date(cy, cm - 1, cd + 1));
      }
    }
    return map;
  }, [monthExceptions, monthStart, monthEnd]);

  const gridCells = useMemo(() => getMonthGrid(y, m - 1), [y, m]);

  const instName = (id) => institutions.find(i => i.id === id)?.name || "—";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!admin) return;
    if (!form.institution_id) return alert("원을 선택해주세요.");
    if (!form.start_date) return alert("시작 날짜를 입력해주세요.");
    if (!form.note.trim()) return alert("메모를 입력해주세요.");
    const end = form.end_date || form.start_date;
    if (end < form.start_date) return alert("종료일은 시작일 이후여야 합니다.");
    setSaving(true);
    try {
      await saveScheduleException({
        institution_id: form.institution_id,
        exception_date: form.start_date,
        end_date: form.end_date && form.end_date !== form.start_date ? form.end_date : null,
        exception_type: form.exception_type,
        note: form.note.trim(),
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!admin) return;
    if (!confirm("이 안내를 삭제할까요?")) return;
    setSaving(true);
    try {
      await deleteScheduleException(id);
      await load();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-view sch-events-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">행사 일정</h2>
      </header>

      <p className="sch-muted">
        전체 원의 행사·휴원 안내를 등록합니다. 저장된 내용은 해당 원 배정 강사의 「내 수업과 급여」 이번 달 안내사항에 자동 표시됩니다.
      </p>

      <div className="sch-toolbar">
        <input type="month" className="sch-input" value={yearMonth} onChange={e => setYearMonth(e.target.value)}/>
      </div>

      {admin ? (
        <section className="sch-events-form-section">
          <h3 className="sch-admin-dash-section-title">안내 등록</h3>
          <form className="sch-form sch-events-form" onSubmit={handleSubmit}>
            <label className="sch-field">
              <span>원</span>
              <select
                className="sch-select"
                required
                value={form.institution_id}
                onChange={e => setForm(f => ({ ...f, institution_id: e.target.value }))}
              >
                <option value="">원 선택</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </label>
            <div className="sch-time-row">
              <label className="sch-field">
                <span>시작일</span>
                <input type="date" className="sch-input" required
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}/>
              </label>
              <label className="sch-field">
                <span>종료일 (선택)</span>
                <input type="date" className="sch-input"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}/>
              </label>
            </div>
            <label className="sch-field">
              <span>유형</span>
              <select className="sch-select" value={form.exception_type}
                onChange={e => setForm(f => ({ ...f, exception_type: e.target.value }))}>
                {Object.entries(EXCEPTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="sch-field">
              <span>메모</span>
              <input type="text" className="sch-input" required placeholder="예: 여름방학, 현장학습"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}/>
            </label>
            <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
              {saving ? "저장 중..." : "안내 저장"}
            </button>
          </form>
        </section>
      ) : null}

      {loading ? <p className="sch-muted">불러오는 중...</p> : (
        <>
          <div className="sch-cal-grid sch-events-cal" role="grid" aria-label={`${monthLabel} 행사·휴원`}>
            <div className="sch-cal-head-row" role="row">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={[
                    "sch-cal-head-cell",
                    (i === 0 || i === 6) && "sch-cal-head-cell--weekend",
                  ].filter(Boolean).join(" ")}
                  role="columnheader"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="sch-cal-body">
              {gridCells.map(({ date, inMonth }) => {
                const dateStr = fmtLocalDate(date);
                const dayEx = inMonth ? (exceptionsByDate[dateStr] || []) : [];
                const isSelected = selectedDate === dateStr;
                const instIds = [...new Set(dayEx.map(ex => ex.institution_id))];
                return (
                  <button
                    key={dateStr}
                    type="button"
                    role="gridcell"
                    disabled={!inMonth}
                    className={[
                      "sch-cal-cell",
                      "sch-events-cal-cell",
                      !inMonth && "sch-cal-cell--muted",
                      isSelected && "sch-cal-cell--selected",
                      dayEx.length > 0 && "sch-events-cal-cell--has",
                    ].filter(Boolean).join(" ")}
                    onClick={() => inMonth && setSelectedDate(dateStr)}
                  >
                    <span className="sch-cal-day-num">{date.getDate()}</span>
                    {dayEx.length > 0 ? (
                      <span className="sch-cal-dots">
                        {instIds.slice(0, 4).map(id => (
                          <span key={id} className="sch-cal-dot" style={{ background: institutionColor(id) }}/>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <section className="sch-events-list-section">
            <h3 className="sch-admin-dash-section-title">
              {monthLabel} 전체 안내 ({monthExceptions.length}건)
            </h3>
            {monthExceptions.length === 0 ? (
              <p className="sch-muted">등록된 행사·휴원 안내가 없습니다.</p>
            ) : (
              <div className="sch-table-wrap sch-admin-table-wrap">
                <table className="sch-table sch-admin-table">
                  <thead>
                    <tr>
                      <th>원</th>
                      <th>안내</th>
                      <th>유형</th>
                      <th>메모</th>
                      {admin ? <th/> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {monthExceptions.map(ex => (
                      <tr key={ex.id}>
                        <td>
                          <span className="sch-cal-dot sch-events-inst-dot" style={{ background: institutionColor(ex.institution_id) }}/>
                          {ex.institutions?.name || instName(ex.institution_id)}
                        </td>
                        <td>{formatExceptionNotice(ex)}</td>
                        <td>{EXCEPTION_LABELS[ex.exception_type] || ex.exception_type}</td>
                        <td>{ex.note || "—"}</td>
                        {admin ? (
                          <td>
                            <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" disabled={saving}
                              onClick={() => handleDelete(ex.id)}>
                              <Trash2 size={13}/>
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="sch-events-day-section">
            <h3 className="sch-admin-dash-section-title">
              {selectedDate} 안내 ({selectedDayExceptions.length}건)
            </h3>
            {selectedDayExceptions.length === 0 ? (
              <p className="sch-muted">이 날짜에 등록된 안내가 없습니다.</p>
            ) : (
              <ul className="sch-month-notices-list">
                {selectedDayExceptions.map(ex => (
                  <li key={ex.id} className="sch-month-notices-item sch-events-day-item">
                    <span className="sch-month-notices-inst">
                      {ex.institutions?.name || instName(ex.institution_id)}
                    </span>
                    <span>{formatExceptionNotice(ex)}</span>
                    {admin ? (
                      <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" disabled={saving}
                        onClick={() => handleDelete(ex.id)}>
                        <Trash2 size={13}/>
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
