import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
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
  saveScheduleExceptionWithClasses,
} from "./api.js";
import {
  exceptionsForDate,
  filterExceptionsForMonth,
  formatExceptionNotice,
  buildExceptionsByDateMap,
} from "./scheduleExceptions.js";
import CalendarEventBadges from "./CalendarEventBadges.jsx";
import { fmtLocalDate, getMonthGrid } from "./payrollCalendar.js";
import {
  getKoreanHoliday,
  hasHolidayDataForYear,
  holidayShortLabel,
} from "./koreanHolidays.js";
import { isScheduleAdmin } from "./roles.js";
import {
  attachScheduleEventNoticeMetadata,
  createScheduleEventNotice,
  deleteScheduleEventNotice,
  isScheduleEventNotice,
  linkScheduleExceptionToNotice,
  updateScheduleEventNotice,
} from "./eventNoticeSync.js";
import { createScheduleEvent } from "./createScheduleEvent.js";
import EventRegisterForm, {
  EMPTY_EVENT_FORM,
  exceptionToEventForm,
} from "./EventRegisterForm.jsx";
import ScheduleClassCancellationPicker from "./ScheduleClassCancellationPicker.jsx";

const EMPTY_FORM = EMPTY_EVENT_FORM;

function exceptionToForm(ex) {
  return exceptionToEventForm(ex);
}

function isManagedInNotices(ex) {
  return Boolean(ex?.notice_id) && !isScheduleEventNotice(ex);
}

function offsetYearMonth(yearMonth, offset) {
  const [year, month] = yearMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
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
      setExceptions(await attachScheduleEventNoticeMetadata(ex));
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

  const changeMonth = (nextMonth) => {
    if (!/^\d{4}-\d{2}$/.test(nextMonth)) return;
    setYearMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  };

  const moveMonth = (offset) => {
    changeMonth(offsetYearMonth(yearMonth, offset));
  };

  const openRegisterForDate = (dateStr) => {
    setSelectedDate(dateStr);
    setForm({ ...EMPTY_FORM, start_date: dateStr });
    setShowRegisterModal(true);
  };

  const closeRegisterModal = () => {
    setShowRegisterModal(false);
    setForm(EMPTY_FORM);
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
    const selectedClasses = Array.isArray(form.cancelled_classes) ? form.cancelled_classes : [];
    if (form.exception_type === "class_cancelled" && selectedClasses.length === 0) {
      return alert("휴강할 수업을 한 개 이상 선택해주세요.");
    }
    setSaving(true);
    try {
      const isNew = !form.id;
      const existing = form.id
        ? (editingException || exceptions.find(ex => ex.id === form.id))
        : null;
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
      if (form.id) payload.id = form.id;

      let savedException;
      if (isNew) {
        savedException = await createScheduleEvent({ payload, selectedClasses, author: me });
      } else {
        let noticeId = existing?.notice_id || null;
        if (!noticeId) {
          const notice = await createScheduleEventNotice(payload, me);
          noticeId = notice.id;
        }

        try {
          savedException = await saveScheduleExceptionWithClasses(
            { ...payload, notice_id: noticeId },
            payload.exception_type === "class_cancelled" ? selectedClasses : [],
          );
          if (existing?.notice_id) {
            await updateScheduleEventNotice(noticeId, payload);
          }
        } catch (error) {
          if (!existing?.notice_id && noticeId) {
            await deleteScheduleEventNotice(noticeId).catch(() => {});
          } else if (existing) {
            await saveScheduleExceptionWithClasses(
              {
                id: existing.id,
                institution_id: existing.institution_id,
                exception_date: existing.exception_date,
                end_date: existing.end_date,
                exception_type: existing.exception_type,
                note: existing.note,
                notice_id: existing.notice_id,
              },
              existing.institution_schedule_exception_classes || [],
            ).catch(() => {});
          }
          throw error;
        }

        await linkScheduleExceptionToNotice(noticeId, savedException.id).catch(error => {
          console.warn("행사 공지 연결 ID 저장 실패:", error);
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
      const target = exceptions.find(ex => ex.id === id);
      if (isManagedInNotices(target)) {
        alert("공지사항에서 등록한 행사는 공지사항 화면에서 수정·삭제해주세요.");
        return;
      }
      if (target?.notice_id) {
        await deleteScheduleEventNotice(target.notice_id);
      } else {
        await deleteScheduleException(id);
      }
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
        {admin ? (
          <div className="sch-header-actions">
            <button
              type="button"
              className="sch-btn sch-btn--primary"
              onClick={() => openRegisterForDate(
                selectedDate?.startsWith(yearMonth) ? selectedDate : monthStart
              )}
            >
              <Plus size={16}/> 행사 등록
            </button>
          </div>
        ) : null}
      </header>

      <p className="sch-muted">
        전체 원의 행사·휴원 안내를 등록합니다. 저장된 내용은 해당 원 배정 강사의 「내 수업과 급여」 이번 달 안내사항에 자동 표시됩니다.
      </p>

      <div className="sch-toolbar">
        <div className="sch-events-month-nav" aria-label="행사 달력 월 이동">
          <button
            type="button"
            className="sch-events-month-arrow"
            onClick={() => moveMonth(-1)}
            aria-label="이전 달"
            title="이전 달"
          >
            <ChevronLeft size={19}/>
          </button>
          <input
            type="month"
            className="sch-input"
            value={yearMonth}
            aria-label="표시할 월"
            onChange={e => changeMonth(e.target.value)}
          />
          <button
            type="button"
            className="sch-events-month-arrow"
            onClick={() => moveMonth(1)}
            aria-label="다음 달"
            title="다음 달"
          >
            <ChevronRight size={19}/>
          </button>
        </div>
        {admin ? (
          <p className="sch-muted sch-toolbar-hint">달력 날짜를 더블클릭하면 해당 날짜로 안내를 등록할 수 있습니다.</p>
        ) : null}
      </div>

      {!hasHolidayDataForYear(y) ? (
        <p className="sch-muted sch-holiday-data-warn">
          {y}년 공휴일 데이터가 아직 등록되지 않았습니다.
        </p>
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
                const holiday = inMonth ? getKoreanHoliday(dateStr) : null;
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
                      holiday && "sch-cal-cell--holiday",
                      dayEx.length > 0 && "sch-events-cal-cell--has",
                    ].filter(Boolean).join(" ")}
                    onClick={() => inMonth && setSelectedDate(dateStr)}
                    onDoubleClick={() => inMonth && admin && openRegisterForDate(dateStr)}
                    aria-label={`${m}월 ${date.getDate()}일${holiday ? ` ${holiday.name}` : ""}`}
                  >
                    <span className="sch-cal-day-num">{date.getDate()}</span>
                    {holiday ? (
                      <span className="sch-cal-holiday-label" title={holiday.name}>
                        {holidayShortLabel(holiday.name)}
                      </span>
                    ) : null}
                    {dayEx.length > 0 ? (
                      <CalendarEventBadges events={dayEx} maxVisible={4}/>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <section className="sch-events-day-section">
            {getKoreanHoliday(selectedDate) ? (
              <p className="sch-holiday-banner">
                공휴일 · {getKoreanHoliday(selectedDate).name}
              </p>
            ) : null}
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
                          disabled={saving || isManagedInNotices(ex)}
                          title={isManagedInNotices(ex) ? "공지사항에서 수정하세요" : "수정"}
                          onClick={() => openEdit(ex)}
                          aria-label="수정"
                        >
                          <Pencil size={13}/>
                        </button>
                        <button
                          type="button"
                          className="sch-btn sch-btn--ghost sch-btn--sm"
                          disabled={saving || isManagedInNotices(ex)}
                          title={isManagedInNotices(ex) ? "공지사항에서 삭제하세요" : "삭제"}
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
                                disabled={saving || isManagedInNotices(ex)}
                                title={isManagedInNotices(ex) ? "공지사항에서 수정하세요" : "수정"}
                                onClick={() => openEdit(ex)}
                                aria-label="수정"
                              >
                                <Pencil size={13}/>
                              </button>
                              <button
                                type="button"
                                className="sch-btn sch-btn--ghost sch-btn--sm"
                                disabled={saving || isManagedInNotices(ex)}
                                title={isManagedInNotices(ex) ? "공지사항에서 삭제하세요" : "삭제"}
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
        </>
      )}

      {showRegisterModal ? (
        <div className="sch-modal-overlay" onClick={() => !saving && closeRegisterModal()}>
          <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>행사 등록 · {form.start_date}</h3>
            </div>
            <EventRegisterForm
              form={form}
              setForm={setForm}
              institutions={institutions}
              saving={saving}
              onSubmit={handleSubmit}
              onCancel={closeRegisterModal}
              showCancel
              useSearchSelect
              allowClassCancellation
              classCancellationField={<ScheduleClassCancellationPicker form={form} setForm={setForm}/>}
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
              useSearchSelect
              allowClassCancellation
              classCancellationField={<ScheduleClassCancellationPicker form={form} setForm={setForm}/>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
