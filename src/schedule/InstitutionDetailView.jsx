import { useEffect, useMemo, useState } from "react";
import InstitutionSearchSelect from "./InstitutionSearchSelect.jsx";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import {
  DAY_LABELS, sortSlotsByTime,
  yearMonthKey,
} from "./constants.js";
import {
  deleteScheduleException,
  fetchAssignments,
  fetchInstitution,
  fetchInstitutions,
  fetchScheduleExceptions,
  fetchTeachers,
  fetchWeeklySchedule,
  upsertInstitution,
} from "./api.js";
import InstitutionAssignmentsTab from "./InstitutionAssignmentsTab.jsx";
import InstitutionBillingTab from "./InstitutionBillingTab.jsx";
import InstitutionTeacherPayTypesModal from "./InstitutionTeacherPayTypesModal.jsx";
import InstitutionTeacherTransferModal from "./InstitutionTeacherTransferModal.jsx";
import RegularClassesManagePanel from "./RegularClassesManagePanel.jsx";
import { invoiceEmailsDraft } from "./institutionEmails.js";
import { filterClassTeacherAssignments } from "./assignmentRoles.js";
import { formatExceptionNotice } from "./scheduleExceptions.js";
import {
  buildExceptionsByDateMap,
  exceptionsForDate,
  filterExceptionsForMonth,
  isInstitutionSlotCancelledOnDate,
} from "./scheduleExceptions.js";
import { fmtLocalDate, getMonthGrid } from "./payrollCalendar.js";
import CalendarEventBadges from "./CalendarEventBadges.jsx";
import { getKoreanHoliday, holidayShortLabel } from "./koreanHolidays.js";
import { filterAssignableClassTeachers, isScheduleAdmin } from "./roles.js";
import EventRegisterForm, { EMPTY_EVENT_FORM } from "./EventRegisterForm.jsx";
import ScheduleClassCancellationPicker from "./ScheduleClassCancellationPicker.jsx";
import { createScheduleEvent } from "./createScheduleEvent.js";
import {
  canViewInstitutionRevenue,
  filterInstitutionsForManagerScope,
  formatInstitutionManagerLabel,
  institutionInManagerScope,
  isScheduleRegionalManager,
} from "./managerScope.js";

const TABS = ["기본정보", "시간표", "계약/매출", "수업 선생님"];

function moveMonth(yearMonth, amount) {
  const [year, month] = yearMonth.split("-").map(Number);
  return yearMonthKey(new Date(year, month - 1 + amount, 1));
}

function slotTimeLabel(t) {
  return String(t || "").slice(0, 5);
}

function InstitutionCalendarPanel({
  exceptions,
  weekly = [],
  teachers = [],
  institutionId,
  onDelete,
  onDateDoubleClick,
}) {
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [selectedDate, setSelectedDate] = useState(() => fmtLocalDate(new Date()));
  const [year, month] = yearMonth.split("-").map(Number);
  const monthStart = `${yearMonth}-01`;
  const monthEnd = fmtLocalDate(new Date(year, month, 0));
  const monthExceptions = useMemo(
    () => filterExceptionsForMonth(exceptions, year, month - 1),
    [exceptions, year, month],
  );
  const exceptionsByDate = useMemo(
    () => buildExceptionsByDateMap(monthExceptions, monthStart, monthEnd),
    [monthExceptions, monthStart, monthEnd],
  );
  const selectedExceptions = useMemo(
    () => exceptionsForDate(monthExceptions, selectedDate),
    [monthExceptions, selectedDate],
  );
  const cells = useMemo(() => getMonthGrid(year, month - 1), [year, month]);

  /** 그 날짜에 진행되는 정규 수업 (요일 반복 · 적용기간 · 휴원 반영) */
  const classesOnDate = (dateStr) => {
    const dow = new Date(`${dateStr}T00:00:00`).getDay();
    return (weekly || [])
      .filter((slot) => {
        if (Number(slot.day_of_week) !== dow) return false;
        const from = slot.effective_from ? String(slot.effective_from).slice(0, 10) : null;
        const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;
        if (from && dateStr < from) return false;
        if (to && dateStr > to) return false;
        return !isInstitutionSlotCancelledOnDate(exceptions, institutionId, dateStr, slot);
      })
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
      .map((slot) => ({
        key: slot.id,
        time: `${slotTimeLabel(slot.start_time)}~${slotTimeLabel(slot.end_time)}`,
        teacher: teachers.find(t => t.id === slot.teacher_id)?.name || "",
        label: String(slot.label || "").trim(),
      }));
  };
  const selectedClasses = classesOnDate(selectedDate);

  const selectDate = (dateStr) => {
    setSelectedDate(dateStr);
  };

  return (
    <section className="sch-institution-calendar">
      <div className="sch-institution-calendar__header">
        <div>
          <h3 className="sch-institution-calendar__title">원 연간 일정</h3>
          <p className="sch-muted">날짜를 두 번 클릭하면 방학·휴원·행사를 등록할 수 있습니다.</p>
        </div>
      </div>

      <div className="sch-month-nav sch-institution-calendar__nav">
        <button type="button" className="sch-icon-btn" aria-label="이전 달" onClick={() => {
          const next = moveMonth(yearMonth, -1);
          setYearMonth(next);
          selectDate(`${next}-01`);
        }}><ChevronLeft size={18}/></button>
        <input type="month" className="sch-input" value={yearMonth} onChange={e => {
          setYearMonth(e.target.value);
          selectDate(`${e.target.value}-01`);
        }}/>
        <button type="button" className="sch-icon-btn" aria-label="다음 달" onClick={() => {
          const next = moveMonth(yearMonth, 1);
          setYearMonth(next);
          selectDate(`${next}-01`);
        }}><ChevronRight size={18}/></button>
      </div>

      <div className="sch-cal-grid" role="grid" aria-label={`${year}년 ${month}월 원 일정`}>
        <div className="sch-cal-head-row" role="row">
          {DAY_LABELS.map(day => <div key={day} role="columnheader">{day}</div>)}
        </div>
        <div className="sch-cal-body">
          {cells.map(({ date, inMonth }) => {
            const dateStr = fmtLocalDate(date);
            const dayEvents = inMonth ? (exceptionsByDate[dateStr] || []) : [];
            const holiday = inMonth ? getKoreanHoliday(dateStr) : null;
            const dayClasses = inMonth ? classesOnDate(dateStr) : [];
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
                  selectedDate === dateStr && "sch-cal-cell--selected",
                  holiday && "sch-cal-cell--holiday",
                  dayEvents.length && "sch-events-cal-cell--has",
                ].filter(Boolean).join(" ")}
                onClick={() => inMonth && selectDate(dateStr)}
                onDoubleClick={() => inMonth && onDateDoubleClick(dateStr)}
              >
                <span className="sch-cal-day-num">{date.getDate()}</span>
                {holiday ? <span className="sch-cal-holiday-label">{holidayShortLabel(holiday.name)}</span> : null}
                {dayEvents.length ? <CalendarEventBadges events={dayEvents} maxVisible={3}/> : null}
                {dayClasses.length ? (
                  <span className="sch-inst-cal-classes">
                    {dayClasses.slice(0, 2).map(c => (
                      <span key={c.key} className="sch-inst-cal-class" title={`${c.time} ${c.teacher} ${c.label}`}>
                        {c.time.slice(0, 5)} {c.teacher}
                      </span>
                    ))}
                    {dayClasses.length > 2 ? <span className="sch-inst-cal-class sch-inst-cal-class--more">+{dayClasses.length - 2}</span> : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sch-institution-calendar__detail">
        <div>
          <h4>휴원/행사 안내</h4>
          <p className="sch-muted">{selectedDate} 일정</p>
          {selectedClasses.length ? (
            <ul className="sch-entry-list">
              {selectedClasses.map(c => (
                <li key={c.key} className="sch-entry-item">
                  <span>정규 수업 {c.time} · {c.teacher || "선생님 미정"}{c.label ? ` (${c.label})` : ""}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedExceptions.length ? (
            <ul className="sch-entry-list">
              {selectedExceptions.map(ex => (
                <li key={ex.id} className="sch-entry-item">
                  <span>{formatExceptionNotice(ex)}</span>
                  <button type="button" className="sch-icon-btn" aria-label="일정 삭제" onClick={() => onDelete(ex.id)}>
                    <Trash2 size={14}/>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="sch-muted">등록된 일정이 없습니다.</p>}
        </div>

      </div>
    </section>
  );
}

export default function InstitutionDetailView({
  institutionId,
  onBack,
  me,
  onOpenRegularClasses,
  onSwitchInstitution,
  onTabChange,
  initialTab = "기본정보",
}) {
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : "기본정보");
  const [inst, setInst] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scopeDenied, setScopeDenied] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editPayTypesAssignment, setEditPayTypesAssignment] = useState(null);
  const [exForm, setExForm] = useState({
    ...EMPTY_EVENT_FORM,
    exception_type: "cancelled",
  });
  const [exSaving, setExSaving] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [emailDrafts, setEmailDrafts] = useState([""]);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      if (isScheduleRegionalManager(me)) {
        let gate = null;
        try {
          gate = await fetchInstitution(institutionId);
        } catch {
          gate = null;
        }
        if (!institutionInManagerScope(gate, me)) {
          setScopeDenied(true);
          setInst(null);
          setWeekly([]);
          setAssignments([]);
          setTeachers([]);
          setExceptions([]);
          return;
        }
      }
      setScopeDenied(false);
      const [i, ts, w, ex, a] = await Promise.all([
        fetchInstitution(institutionId),
        fetchTeachers(),
        fetchWeeklySchedule(institutionId),
        fetchScheduleExceptions(institutionId),
        fetchAssignments(institutionId),
      ]);
      setInst(i);
      setTeachers(ts);
      setWeekly(sortSlotsByTime(w));
      setExceptions(ex);
      setAssignments(a);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [institutionId]);

  useEffect(() => {
    if (!inst || inst.id !== institutionId) return;
    setEmailDrafts(invoiceEmailsDraft(inst.invoice_emails));
  }, [institutionId, inst?.id]);

  useEffect(() => {
    if (TABS.includes(initialTab)) setTab(initialTab);
  }, [institutionId, initialTab]);

  useEffect(() => {
    let cancelled = false;
    fetchInstitutions({ activeOnly: false })
      .then((rows) => {
        if (!cancelled) setInstitutions(filterInstitutionsForManagerScope(rows, me));
      })
      .catch((err) => {
        console.error(err);
      });
    return () => { cancelled = true; };
  }, [me]);

  const switcherInstitutions = useMemo(() => {
    if (!inst) return institutions;
    if (institutions.some((item) => item.id === inst.id)) return institutions;
    return [inst, ...institutions];
  }, [institutions, inst]);

  const changeTab = (nextTab) => {
    setTab(nextTab);
    onTabChange?.(nextTab);
  };

  const switchInstitution = (nextId) => {
    if (!nextId || nextId === institutionId) return;
    setTransferOpen(false);
    setEditPayTypesAssignment(null);
    setShowExceptionModal(false);
    onSwitchInstitution?.(nextId);
  };

  const saveInfo = async (e) => {
    e.preventDefault();
    try {
      const saved = await upsertInstitution({ ...inst });
      setInst(saved);
      alert("저장되었습니다.");
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
  };

  const addException = async (e) => {
    e.preventDefault();
    if (!exForm.start_date) return alert("시작 날짜를 입력해주세요.");
    if (!exForm.note.trim()) return alert("메모를 입력해주세요.");
    const end = exForm.end_date || exForm.start_date;
    if (end < exForm.start_date) return alert("종료일은 시작일 이후여야 합니다.");
    const selectedClasses = Array.isArray(exForm.cancelled_classes) ? exForm.cancelled_classes : [];
    if (exForm.exception_type === "class_cancelled" && selectedClasses.length === 0) {
      return alert("휴강할 수업을 한 개 이상 선택해주세요.");
    }
    const allClassesSelected = (
      exForm.exception_type === "class_cancelled"
      && exForm.class_candidate_count > 0
      && selectedClasses.length === exForm.class_candidate_count
    );
    setExSaving(true);
    try {
      await createScheduleEvent({
        payload: {
          institution_id: institutionId,
          exception_date: exForm.start_date,
          end_date: exForm.end_date && exForm.end_date !== exForm.start_date ? exForm.end_date : null,
          exception_type: allClassesSelected ? "cancelled" : exForm.exception_type,
          note: exForm.note.trim(),
        },
        selectedClasses,
        author: me,
      });
      setShowExceptionModal(false);
      setExForm({ ...EMPTY_EVENT_FORM, exception_type: "cancelled" });
      await load({ silent: true });
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setExSaving(false);
    }
  };

  const openExceptionModal = (dateStr) => {
    setExForm({
      ...EMPTY_EVENT_FORM,
      institution_id: institutionId,
      start_date: dateStr,
      exception_type: "cancelled",
      cancelled_classes: [],
      class_candidate_count: 0,
    });
    setShowExceptionModal(true);
  };

  const removeException = async (id) => {
    if (!confirm("이 일정을 삭제할까요? 선생님 안내에서도 함께 사라집니다.")) return;
    try {
      await deleteScheduleException(id);
      await load({ silent: true });
    } catch (err) {
      alert("삭제 실패: " + err.message);
    }
  };

  if (scopeDenied) {
    return (
      <div className="sch-view">
        <p className="sch-muted">이 원에 대한 접근 권한이 없습니다.</p>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={onBack}>돌아가기</button>
      </div>
    );
  }

  if (!inst) return <p className="sch-muted">불러오는 중...</p>;

  if (!institutionInManagerScope(inst, me) && inst.id === institutionId) {
    return (
      <div className="sch-view">
        <p className="sch-muted">이 원에 대한 접근 권한이 없습니다.</p>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={onBack}>돌아가기</button>
      </div>
    );
  }

  const admins = teachers.filter(t => t.role === "admin" || t.role === "superadmin");
  const teacherList = filterAssignableClassTeachers(teachers);
  const canManageRoles = isScheduleAdmin(me);
  const classTeachers = filterClassTeacherAssignments(assignments);
  const currentManager = teachers.find(t => t.id === inst.manager_id);
  const managerName = formatInstitutionManagerLabel(currentManager);
  const displayName = switcherInstitutions.find((item) => item.id === institutionId)?.name || inst.name;
  const switching = loading || inst.id !== institutionId;

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 원 관리
        </button>
        <div className="sch-inst-switcher">
          <h2 className="sch-view-title">
            {displayName}
            {inst.is_active === false ? (
              <span className="sch-inst-ended-badge">
                계약 종료{inst.contract_end_date ? ` (${String(inst.contract_end_date).slice(0, 10)}~)` : ""}
              </span>
            ) : null}
          </h2>
          <InstitutionSearchSelect
            institutions={switcherInstitutions}
            value={institutionId}
            onChange={switchInstitution}
            placeholder="원·센터 이름 검색"
            showInactive
            clearable={false}
            syncQueryToValue={false}
          />
        </div>
        {canManageRoles ? (
          <div className="sch-header-actions">
            <button
              type="button"
              className="sch-btn sch-btn--ghost"
              onClick={() => setTransferOpen(true)}
            >
              담당자 변경
            </button>
            <button
              type="button"
              className="sch-btn sch-btn--ghost"
              onClick={() => changeTab("수업 선생님")}
            >
              수업 선생님 추가/제거
            </button>
          </div>
        ) : null}
      </header>

      <div className="sch-tabs">
        {TABS.map(t => (
          <button key={t} type="button"
            className={`sch-tab${tab === t ? " active" : ""}`}
            onClick={() => changeTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {switching ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : (
        <>
      {tab === "기본정보" && (
        <div className="sch-institution-basic">
        <form className="sch-form" onSubmit={saveInfo}>
          <div className="sch-field" style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12,
          }}>
            <span style={{ fontWeight: 700 }}>담당자 (관리자)</span>
            <p style={{ margin: "6px 0 0", fontWeight: 800, fontSize: 16 }}>{managerName}</p>
            <p className="sch-muted" style={{ margin: "4px 0 0" }}>
              해당 기관을 관리하는 관리자입니다. 오른쪽 상단 &quot;담당자 변경&quot;으로 변경할 수 있습니다.
            </p>
          </div>

          <div className="sch-field" style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12,
          }}>
            <span style={{ fontWeight: 700 }}>수업 선생님</span>
            {classTeachers.length === 0 ? (
              <p className="sch-muted" style={{ margin: "6px 0 0" }}>등록된 수업 선생님이 없습니다.</p>
            ) : (
              <ul className="sch-info-teacher-list">
                {classTeachers.map(a => (
                  <li key={a.id} className="sch-info-teacher-row">
                    <div>
                      <div className="sch-info-teacher-name">{a.teachers?.name || "—"} 선생님</div>
                      <div className="sch-info-teacher-types">
                        {(a.pay_types || []).length ? (a.pay_types || []).join(" · ") : "유형 미지정"}
                      </div>
                    </div>
                    {canManageRoles ? (
                      <button
                        type="button"
                        className="sch-icon-btn"
                        title="수업 유형 수정"
                        aria-label={`${a.teachers?.name || "선생님"} 수업 유형 수정`}
                        onClick={() => setEditPayTypesAssignment(a)}
                      >
                        <Pencil size={16}/>
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="sch-muted" style={{ margin: "6px 0 0" }}>
              실제 수업을 진행하는 선생님입니다. 수업 유형은 연필 버튼으로 수정할 수 있습니다.
            </p>
          </div>

          <label className="sch-field"><span>이름</span>
            <input className="sch-input" value={inst.name || ""} onChange={e => setInst({ ...inst, name: e.target.value })}/>
          </label>
          <label className="sch-field"><span>계약 상태</span>
            <select
              className="sch-select"
              value={inst.is_active === false ? "ended" : "active"}
              onChange={e => {
                const ended = e.target.value === "ended";
                setInst({
                  ...inst,
                  is_active: !ended,
                  contract_end_date: ended ? (inst.contract_end_date || fmtLocalDate(new Date())) : null,
                });
              }}
            >
              <option value="active">계약중</option>
              <option value="ended">계약 종료 (매출 등록 불가)</option>
            </select>
          </label>
          {inst.is_active === false ? (
            <label className="sch-field"><span>계약 종료일</span>
              <input
                type="date"
                className="sch-input"
                value={inst.contract_end_date ? String(inst.contract_end_date).slice(0, 10) : ""}
                onChange={e => setInst({ ...inst, contract_end_date: e.target.value || null })}
              />
            </label>
          ) : null}
          <label className="sch-field"><span>주소</span>
            <input className="sch-input" value={inst.address || ""} onChange={e => setInst({ ...inst, address: e.target.value })}/>
          </label>
          <label className="sch-field"><span>주차정보</span>
            <input className="sch-input" value={inst.parking_info || ""} onChange={e => setInst({ ...inst, parking_info: e.target.value })}/>
          </label>
          <label className="sch-field"><span>사업자등록번호</span>
            <input className="sch-input" value={inst.business_registration_number || ""}
              onChange={e => setInst({ ...inst, business_registration_number: e.target.value })}/>
          </label>
          <button type="submit" className="sch-btn sch-btn--primary">저장</button>
        </form>
        <InstitutionCalendarPanel
          exceptions={exceptions}
          weekly={weekly}
          teachers={teachers}
          institutionId={institutionId}
          onDelete={removeException}
          onDateDoubleClick={openExceptionModal}
        />
        </div>
      )}

      {tab === "시간표" && (
        <div>
          <RegularClassesManagePanel
            me={me}
            lockedInstitutionId={institutionId}
            onOpenChangeAlerts={onOpenRegularClasses}
            onSlotsChanged={() => load({ silent: true })}
          />
        </div>
      )}

      {tab === "계약/매출" && (
        <InstitutionBillingTab
          me={me}
          institution={inst}
          institutionId={institutionId}
          teachers={teachers}
          canViewRevenue={canViewInstitutionRevenue(me, inst)}
          emailDrafts={emailDrafts}
          onEmailDraftsChange={setEmailDrafts}
          onInstitutionChange={setInst}
        />
      )}

      {tab === "수업 선생님" && (
        <InstitutionAssignmentsTab
          institutionId={institutionId}
          institution={inst}
          assignments={assignments}
          weekly={weekly}
          teachers={teachers}
          teacherList={teacherList}
          onRefresh={load}
          canEdit={canManageRoles}
          changedBy={me?.id || null}
        />
      )}
        </>
      )}

      {showExceptionModal ? (
        <div className="sch-modal-overlay" onClick={() => !exSaving && setShowExceptionModal(false)}>
          <div className="sch-modal sch-modal--wide" onClick={event => event.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>행사 등록 · {exForm.start_date}</h3>
            </div>
            <EventRegisterForm
              form={exForm}
              setForm={setExForm}
              institutions={inst ? [inst] : []}
              saving={exSaving}
              onSubmit={addException}
              onCancel={() => setShowExceptionModal(false)}
              showCancel
              lockedInstitutionName={inst.name}
              allowClassCancellation
              classCancellationField={<ScheduleClassCancellationPicker form={exForm} setForm={setExForm}/>}
            />
          </div>
        </div>
      ) : null}

      {editPayTypesAssignment ? (
        <InstitutionTeacherPayTypesModal
          assignment={editPayTypesAssignment}
          onClose={() => setEditPayTypesAssignment(null)}
          onSaved={load}
        />
      ) : null}

      {transferOpen ? (
        <InstitutionTeacherTransferModal
          mode="manager"
          institution={inst}
          teachers={teachers}
          adminList={admins}
          onClose={() => setTransferOpen(false)}
          onDone={load}
        />
      ) : null}
    </div>
  );
}
