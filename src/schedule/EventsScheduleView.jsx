import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import {
  DAY_LABELS,
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
  buildExceptionsByDateMap,
} from "./scheduleExceptions.js";
import CalendarEventBadges from "./CalendarEventBadges.jsx";
import { fmtLocalDate, getMonthGrid } from "./payrollCalendar.js";
import { isScheduleAdmin } from "./roles.js";
import { notifyEventScheduled } from "./pushScheduleNotification.js";
import EventRegisterForm, {
  EMPTY_EVENT_FORM,
  exceptionToEventForm,
} from "./EventRegisterForm.jsx";

const EMPTY_FORM = EMPTY_EVENT_FORM;

function exceptionToForm(ex) {
  return exceptionToEventForm(ex);
}

export default function EventsScheduleView({ me, onBack }) {
  const admin = isScheduleAdmin(me);
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [institutions, setInstitutions] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDate, setSelectedDate] = useState(() => fmtLocalDate(new Date()));
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingException, setEditingException] = useState(null);

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

  const exceptionsByDate = useMemo(
    () => buildExceptionsByDateMap(monthExceptions, monthStart, monthEnd),
    [monthExceptions, monthStart, monthEnd],
  );

  const gridCells = useMemo(() => getMonthGrid(y, m - 1), [y, m]);

  const instName = (id) => institutions.find(i => i.id === id)?.name || "—";

  const openRegisterForDate = (dateStr) => {
    setSelectedDate(dateStr);
    setForm(f => ({ ...f, start_date: dateStr, end_date: "" }));
    setShowRegisterModal(true);
  };

  const closeRegisterModal = () => {
    setShowRegisterModal(false);
  };

  const openEdit = (ex) => {
    setEditingException(ex);
    setForm(exceptionToForm(ex));
  };

  const closeEditModal = () => {
    setEditingException(null);
    setForm(EMPTY_FORM);
  };

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
      const isNew = !form.id;
      const payload = {
        institution_id: form.institution_id,
        exception_date: form.start_date,
        end_date: form.end_date && form.end_date !== form.start_date ? form.end_date : null,
        exception_type: form.exception_type,
        note: form.note.trim(),
      };
      if (form.id) payload.id = form.id;

      await saveScheduleException(payload);
      if (isNew) {
        void notifyEventScheduled({
          institution_id: payload.institution_id,
          note: payload.note,
          event_date: payload.exception_date,
        });
      }
      setForm(EMPTY_FORM);
      setShowRegisterModal(false);
      setEditingException(null);
      setSelectedDate(form.start_date);
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
        {admin ? (
          <p className="sch-muted sch-toolbar-hint">달력 날짜를 더블클릭하면 해당 날짜로 안내를 등록할 수 있습니다.</p>
        ) : null}
      </div>

      {loading ? <p className="sch-muted">불러오는 중...</p> : (
        <>
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
                        <td>
                          {ex.note || "—"}
                          {ex.event_location ? (
                            <span className="sch-muted" style={{ display: "block", fontSize: 12 }}>
                              📍 {ex.event_location}
                            </span>
                          ) : null}
                          {ex.notice_id ? (
                            <span className="sch-badge sch-badge--muted" style={{ display: "inline-block", marginTop: 4 }}>
                              공지 연동
                            </span>
                          ) : null}
                        </td>
                        {admin ? (
                          <td>
                            <div className="sch-events-row-actions">
                              <button
                                type="button"
                                className="sch-btn sch-btn--ghost sch-btn--sm"
                                disabled={saving || !!ex.notice_id}
                                title={ex.notice_id ? "공지사항에서 수정하세요" : "수정"}
                                onClick={() => openEdit(ex)}
                                aria-label="수정"
                              >
                                <Pencil size={13}/>
                              </button>
                              <button
                                type="button"
                                className="sch-btn sch-btn--ghost sch-btn--sm"
                                disabled={saving || !!ex.notice_id}
                                title={ex.notice_id ? "공지사항에서 삭제하세요" : "삭제"}
                                onClick={() => handleDelete(ex.id)}
                                aria-label="삭제"
                              >
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
                    onDoubleClick={() => inMonth && admin && openRegisterForDate(dateStr)}
                  >
                    <span className="sch-cal-day-num">{date.getDate()}</span>
                    {dayEx.length > 0 ? (
                      <CalendarEventBadges events={dayEx} maxVisible={4}/>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

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
                      <div className="sch-events-row-actions">
                        <button
                          type="button"
                          className="sch-btn sch-btn--ghost sch-btn--sm"
                          disabled={saving}
                          onClick={() => openEdit(ex)}
                          aria-label="수정"
                        >
                          <Pencil size={13}/>
                        </button>
                        <button
                          type="button"
                          className="sch-btn sch-btn--ghost sch-btn--sm"
                          disabled={saving}
                          onClick={() => handleDelete(ex.id)}
                          aria-label="삭제"
                        >
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {admin ? (
            <section className="sch-events-form-section">
              <h3 className="sch-admin-dash-section-title">안내 등록</h3>
              <EventRegisterForm
                form={form}
                setForm={setForm}
                institutions={institutions}
                saving={saving}
                onSubmit={handleSubmit}
              />
            </section>
          ) : null}
        </>
      )}

      {showRegisterModal ? (
        <div className="sch-modal-overlay" onClick={() => !saving && closeRegisterModal()}>
          <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>안내 등록 · {form.start_date}</h3>
            </div>
            <EventRegisterForm
              form={form}
              setForm={setForm}
              institutions={institutions}
              saving={saving}
              onSubmit={handleSubmit}
              onCancel={closeRegisterModal}
              showCancel
            />
          </div>
        </div>
      ) : null}

      {editingException ? (
        <div className="sch-modal-overlay" onClick={() => !saving && closeEditModal()}>
          <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>안내 수정 · {editingException.note || "행사"}</h3>
            </div>
            <EventRegisterForm
              form={form}
              setForm={setForm}
              institutions={institutions}
              saving={saving}
              onSubmit={handleSubmit}
              onCancel={closeEditModal}
              showCancel
              submitLabel="수정 저장"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
