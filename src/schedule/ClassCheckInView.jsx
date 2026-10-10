import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, ChevronLeft, Pencil } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  classTypeLabel,
  fmtLocalDate,
  homeVisitColor,
  institutionColor,
  isHomeVisitPlanned,
  yearMonthKey,
} from "./constants.js";
import {
  fetchFinalizedInstitutionIds,
  fetchHomeVisitPatterns,
  fetchPayrollEntries,
  fetchScheduleExceptions,
  fetchTeachers,
  fetchWeeklySchedule,
} from "./api.js";
import {
  ENTRY_STATUS,
  findEntryForPlanned,
  getSlotsForDate,
  getHomeVisitsForDate,
  isSlotUnconfirmed,
} from "./payrollCalendar.js";
import { filterExceptionsForInstitutions } from "./scheduleExceptions.js";
import { useScheduleAuthReady } from "./ScheduleAuthContext.jsx";
import PayrollSlotCustomModal from "./PayrollSlotCustomModal.jsx";
import { confirmLongClassMinuteList, confirmLongClassMinutes } from "./longClassConfirm.js";
import {
  buildCustomEditState,
  buildPayrollSlotPayload,
  confirmPayrollSlotAsScheduled,
  customEditNeedsChangeReason,
  customEditSaveMinutes,
  saveCustomPayrollSlot,
  skipPayrollSlot,
} from "./payrollSlotPayload.js";
import {
  classIncidentErrorMessage,
  upsertClassIncidentReport,
} from "./classIncidentReports.js";
import {
  buildIncidentPayload,
  emptyIncidentForm,
  validateIncidentForm,
} from "./classIncidentCategories.js";
import ClassIncidentCategoryFields from "./ClassIncidentCategoryFields.jsx";
import { filterAssignableClassTeachers } from "./roles.js";
import { bulkUpsertPayrollSlotsWithNotifications } from "./payrollSaveWithNotification.js";
import { isScheduleSuperAdmin } from "./managerScope.js";
import { classCheckinPlannedKey } from "./classCheckinTodoItems.js";

function plannedKey(planned) {
  return classCheckinPlannedKey(planned);
}

function buildDemoPlanned(dateStr) {
  return [
    {
      source: "institution",
      slot: { id: "demo-slot-regular" },
      patternId: null,
      dateStr,
      institutionId: null,
      institutionName: "테스트 어린이집",
      displayLabel: "1교시",
      studentName: null,
      payType: "정규",
      startTime: "10:00",
      endTime: "10:40",
      scheduledMinutes: 40,
      location: null,
    },
    {
      source: "home_visit",
      slot: { id: "demo-slot-home" },
      patternId: "demo-slot-home",
      dateStr,
      institutionId: null,
      institutionName: "테스트 학생",
      displayLabel: "가정방문 · 테스트 학생",
      studentName: "테스트 학생",
      payType: "가정방문",
      startTime: "14:00",
      endTime: "14:50",
      scheduledMinutes: 50,
      location: null,
    },
  ];
}

function demoEntryFromPlanned(planned, status = ENTRY_STATUS.as_scheduled, minutes) {
  const mins = status === ENTRY_STATUS.skipped ? 0 : Number(minutes || planned.scheduledMinutes) || 0;
  return {
    id: `demo-${plannedKey(planned)}`,
    teacher_id: "demo",
    institution_id: null,
    institutions: { id: null, name: planned.institutionName },
    pay_type: planned.payType,
    class_date: planned.dateStr,
    entry_status: status,
    minutes: mins,
  };
}

const DEMO_TEACHER_OPTIONS = [
  { id: "demo-other-teacher", name: "테스트 대체 선생님" },
];

function checkInSlotHeading(item) {
  const place = String(item?.institutionName || item?.studentName || "").trim();
  const start = String(item?.startTime || "").trim();
  const end = String(item?.endTime || "").trim();
  const time = start && end ? `${start}~${end}` : start || end;
  return [place, time].filter(Boolean).join(" ");
}

function checkInSlotSubLabel(item) {
  const label = String(item?.displayLabel || "").trim();
  const place = String(item?.institutionName || item?.studentName || "").trim();
  if (!label || label === place) return "";
  if (item?.source === "home_visit") return "";
  return label;
}

function parseDateParam(value) {
  const text = String(value || "").slice(0, 10);
  const [y, m, d] = text.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function ClassCheckInView({ me, onBack }) {
  const scheduleAuthReady = useScheduleAuthReady();
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const focusParam = searchParams.get("focus") || "";
  const isDemo = searchParams.get("demo") === "1" && isScheduleSuperAdmin(me);
  const date = useMemo(() => parseDateParam(dateParam) || new Date(), [dateParam]);
  const dateStr = fmtLocalDate(date);
  const teacherId = me?.id;
  const yearMonth = yearMonthKey(date);

  const [weeklySlots, setWeeklySlots] = useState([]);
  const [homeVisitPatterns, setHomeVisitPatterns] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [finalizedIds, setFinalizedIds] = useState(new Set());
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customEdit, setCustomEdit] = useState(null);
  const [step, setStep] = useState("status");
  const [incidentEntry, setIncidentEntry] = useState(null);
  const [incidentQueue, setIncidentQueue] = useState([]);
  const [incidentForm, setIncidentForm] = useState(() => emptyIncidentForm());
  const [demoResolvedKeys, setDemoResolvedKeys] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!teacherId || !scheduleAuthReady) return;
    if (isDemo) {
      setTeacherOptions(DEMO_TEACHER_OPTIONS);
      setWeeklySlots([]);
      setHomeVisitPatterns([]);
      setEntries([]);
      setExceptions([]);
      setFinalizedIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [w, hv, ents, ex, fin, teachers] = await Promise.all([
        fetchWeeklySchedule(null, teacherId),
        fetchHomeVisitPatterns({ teacherId }),
        fetchPayrollEntries({ teacherId, yearMonth }),
        fetchScheduleExceptions(null, dateStr, dateStr),
        fetchFinalizedInstitutionIds(yearMonth),
        fetchTeachers({ yearMonth }),
      ]);
      setWeeklySlots(w || []);
      setHomeVisitPatterns(hv || []);
      setEntries(ents || []);
      setExceptions(ex || []);
      setFinalizedIds(fin || new Set());
      setTeacherOptions(filterAssignableClassTeachers(teachers));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [teacherId, scheduleAuthReady, dateStr, yearMonth, isDemo]);

  useEffect(() => {
    load();
  }, [load]);

  const teacherInstitutionIds = useMemo(() => {
    const ids = new Set();
    for (const s of weeklySlots || []) {
      if (s.institution_id) ids.add(s.institution_id);
    }
    return ids;
  }, [weeklySlots]);

  const teacherExceptions = useMemo(
    () => filterExceptionsForInstitutions(exceptions, teacherInstitutionIds),
    [exceptions, teacherInstitutionIds],
  );

  const planned = useMemo(() => {
    if (isDemo) return buildDemoPlanned(dateStr);
    const institution = getSlotsForDate(weeklySlots, date, teacherExceptions);
    const homeVisits = getHomeVisitsForDate(homeVisitPatterns, date);
    return [...institution, ...homeVisits].sort((a, b) =>
      String(a.startTime || "").localeCompare(String(b.startTime || "")),
    );
  }, [isDemo, dateStr, weeklySlots, date, teacherExceptions, homeVisitPatterns]);

  const isLocked = (institutionId) => !isDemo && institutionId && finalizedIds.has(institutionId);

  const unconfirmed = useMemo(() => {
    const rows = planned.filter((p) => {
      if (isLocked(p.institutionId)) return false;
      if (isDemo) return !demoResolvedKeys.has(plannedKey(p));
      return isSlotUnconfirmed(entries, p);
    });
    if (!focusParam) return rows;
    const focused = rows.filter((p) => plannedKey(p) === focusParam);
    const rest = rows.filter((p) => plannedKey(p) !== focusParam);
    return focused.length ? [...focused, ...rest] : rows;
  }, [planned, entries, finalizedIds, isDemo, demoResolvedKeys, focusParam]);

  const currentPlanned = unconfirmed[0] || null;

  const customEditNeedsReason = useMemo(() => {
    if (!customEdit) return false;
    return customEditNeedsChangeReason(
      customEdit,
      findEntryForPlanned(entries, customEdit.planned),
      teacherId,
    );
  }, [customEdit, entries, teacherId]);

  const markDemoDone = (items) => {
    setDemoResolvedKeys((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(plannedKey(item));
      return next;
    });
  };

  const goIncident = (entry, extraQueue = []) => {
    const queue = extraQueue.filter((row) => row?.id && row.id !== entry?.id);
    setIncidentQueue(queue);
    setIncidentEntry(entry);
    setIncidentForm(emptyIncidentForm());
    setStep("incident");
  };

  const finishIncidentAndContinue = async () => {
    if (incidentQueue.length) {
      const [next, ...rest] = incidentQueue;
      setIncidentQueue(rest);
      setIncidentEntry(next);
      setIncidentForm(emptyIncidentForm());
      setStep("incident");
      return;
    }
    setIncidentEntry(null);
    setStep("status");
    if (!isDemo) await load();
  };

  const handleConfirm = async (plannedItem) => {
    if (isLocked(plannedItem.institutionId)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }
    setSaving(true);
    try {
      if (isDemo) {
        if (!confirmLongClassMinutes(plannedItem.scheduledMinutes)) return;
        markDemoDone([plannedItem]);
        goIncident(demoEntryFromPlanned(plannedItem, ENTRY_STATUS.as_scheduled));
        return;
      }
      const entry = await confirmPayrollSlotAsScheduled(plannedItem, {
        existingEntry: findEntryForPlanned(entries, plannedItem),
        teacherId,
      });
      if (!entry) return;
      goIncident(entry);
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRemaining = async () => {
    if (!unconfirmed.length) return;
    if (!confirm(`남은 수업 ${unconfirmed.length}개를 평소대로 확정할까요?`)) return;
    if (!confirmLongClassMinuteList(unconfirmed.map((p) => p.scheduledMinutes))) return;
    setSaving(true);
    try {
      if (isDemo) {
        markDemoDone(unconfirmed);
        const fake = unconfirmed.map((p) => demoEntryFromPlanned(p, ENTRY_STATUS.as_scheduled));
        const [first, ...rest] = fake;
        if (first) goIncident(first, rest);
        return;
      }
      const payloads = unconfirmed.map((p) => ({
        planned: p,
        payload: buildPayrollSlotPayload(p, {
          status: ENTRY_STATUS.as_scheduled,
          minutes: p.scheduledMinutes,
        }, {
          existingEntry: findEntryForPlanned(entries, p),
          teacherId,
        }),
      }));
      const saved = await bulkUpsertPayrollSlotsWithNotifications(payloads);
      const [first, ...rest] = saved.filter(Boolean);
      if (first) goIncident(first, rest);
      else await load();
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleCustomSave = async (e) => {
    e.preventDefault();
    if (!customEdit) return;
    if (isLocked(customEdit.planned.institutionId)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }
    setSaving(true);
    try {
      if (isDemo) {
        if (!confirmLongClassMinutes(customEditSaveMinutes(customEdit))) return;
        markDemoDone([customEdit.planned]);
        setCustomEdit(null);
        goIncident(demoEntryFromPlanned(
          customEdit.planned,
          ENTRY_STATUS.custom,
          customEdit.minutes,
        ));
        return;
      }
      const entry = await saveCustomPayrollSlot(customEdit, {
        existingEntry: findEntryForPlanned(entries, customEdit.planned),
        teacherId,
      });
      if (!entry) return;
      setCustomEdit(null);
      goIncident(entry);
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSlotSkip = async () => {
    if (!customEdit) return;
    if (isLocked(customEdit.planned.institutionId)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }
    setSaving(true);
    try {
      if (isDemo) {
        markDemoDone([customEdit.planned]);
        setCustomEdit(null);
        goIncident(demoEntryFromPlanned(customEdit.planned, ENTRY_STATUS.skipped));
        return;
      }
      const entry = await skipPayrollSlot(customEdit, {
        existingEntry: findEntryForPlanned(entries, customEdit.planned),
        teacherId,
      });
      if (!entry) return;
      setCustomEdit(null);
      goIncident(entry);
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleIncidentNone = async () => {
    setSaving(true);
    try {
      await finishIncidentAndContinue();
    } finally {
      setSaving(false);
    }
  };

  const handleIncidentSave = async (e) => {
    e?.preventDefault?.();
    const error = validateIncidentForm(incidentForm);
    if (error) {
      alert(error);
      return;
    }
    if (!incidentEntry?.id) return;
    setSaving(true);
    try {
      if (!isDemo) {
        const substituteName = teacherOptions.find((t) => t.id === incidentForm.substitute_teacher_id)?.name || "";
        const payload = buildIncidentPayload(incidentForm, { substituteName });
        await upsertClassIncidentReport({
          payroll_entry_id: incidentEntry.id,
          teacher_id: teacherId,
          institution_id: incidentEntry.institution_id || null,
          class_date: incidentEntry.class_date,
          notify: {
            teacher_name: me?.name,
            institution_name: incidentEntry.institutions?.name,
          },
          ...payload,
        });
      }
      await finishIncidentAndContinue();
    } catch (err) {
      alert(classIncidentErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  const done = !loading && step === "status" && !currentPlanned;

  return (
    <div className="sch-view sch-checkin">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18} /> 급여/정산
        </button>
        <h2 className="sch-view-title">
          {dateStr === fmtLocalDate(new Date()) ? "오늘 수업 확인" : `${dateLabel} 수업 확인`}
        </h2>
      </header>
      {isDemo ? (
        <p className="sch-checkin-demo-banner" role="status">
          테스트 화면입니다. 완료·수정·특이사항은 저장되지 않고 급여에도 반영되지 않습니다.
        </p>
      ) : null}

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : done ? (
        <div className="sch-checkin-done-card" role="status">
          <div className="sch-checkin-done-card-icon" aria-hidden>
            <Check size={22} />
          </div>
          <h3>{planned.length ? "남은 수업 모두 완료" : "오늘 예정된 수업이 없습니다"}</h3>
          <p>
            {planned.length
              ? (isDemo ? "테스트 확인을 모두 마쳤습니다." : "오늘 수업은 모두 확인했습니다.")
              : dateLabel}
          </p>
          {planned.length ? <p className="sch-checkin-done-card-date">{dateLabel}</p> : null}
          <button type="button" className="sch-btn sch-btn--primary" onClick={onBack}>
            급여 화면으로
          </button>
        </div>
      ) : step === "incident" && incidentEntry ? (
        <section className="sch-checkin-step">
          <p className="sch-checkin-kicker">2단계 · {dateLabel}</p>
          <h3>특이사항 있으셨나요?</h3>
          <p className="sch-muted">
            {incidentEntry.institutions?.name || incidentEntry.pay_type || "수업"}
            {incidentEntry.entry_status === ENTRY_STATUS.skipped ? " · 수업 안 함" : ""}
          </p>
          <form className="sch-form" onSubmit={handleIncidentSave}>
            <ClassIncidentCategoryFields
              value={incidentForm}
              onChange={setIncidentForm}
              teachers={teacherOptions}
              excludeTeacherId={teacherId}
              bodyRows={4}
            />
            <div className="sch-form-actions sch-form-actions--stack">
              <button
                type="button"
                className="sch-btn sch-btn--primary"
                disabled={saving}
                onClick={handleIncidentNone}
              >
                없음
              </button>
              <button
                type="submit"
                className="sch-btn sch-btn--ghost"
                disabled={saving || Boolean(validateIncidentForm(incidentForm))}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
          {incidentQueue.length > 0 ? (
            <p className="sch-muted">이어서 확인할 수업 {incidentQueue.length}건</p>
          ) : null}
        </section>
      ) : currentPlanned ? (
        <section className="sch-checkin-step">
          <p className="sch-checkin-kicker">1단계 · {dateLabel}</p>
          <h3>오늘 수업 마치셨나요?</h3>
          <p className="sch-muted">
            확인할 수업 {unconfirmed.length}건 · 급여 화면의 완료/수정과 같은 동작입니다.
            {isDemo ? " (저장되지 않음)" : ""}
          </p>
          {unconfirmed.length > 1 ? (
            <button
              type="button"
              className="sch-checkin-bulk-card"
              disabled={saving}
              onClick={handleConfirmRemaining}
            >
              <Check size={18} />
              <span>
                <strong>남은 수업 모두 완료</strong>
                <em>평소대로 {unconfirmed.length}건을 한 번에 확정합니다</em>
              </span>
            </button>
          ) : null}
          <ul className="sch-payroll-slot-grid">
            {unconfirmed.map((item) => {
              const entry = findEntryForPlanned(entries, item);
              const color = isHomeVisitPlanned(item)
                ? homeVisitColor(item.patternId)
                : institutionColor(item.institutionId);
              const isCurrent = plannedKey(item) === plannedKey(currentPlanned);
              const subLabel = checkInSlotSubLabel(item);
              return (
                <li
                  key={plannedKey(item)}
                  className={`sch-payroll-slot-card${isCurrent ? " sch-checkin-card--current" : ""}`}
                >
                  <span className="sch-payroll-slot-card-accent" style={{ background: color }} aria-hidden />
                  <div className="sch-payroll-slot-card-body">
                    <div className="sch-payroll-slot-card-head">
                      <span className="sch-payroll-slot-time">{checkInSlotHeading(item)}</span>
                      <span className="sch-payroll-slot-type">{classTypeLabel(item.payType)}</span>
                    </div>
                    {subLabel ? <div className="sch-payroll-slot-inst">{subLabel}</div> : null}
                  </div>
                  {isCurrent ? (
                    <div className="sch-checkin-choice-row">
                      <button
                        type="button"
                        className="sch-payroll-confirm-btn"
                        disabled={saving}
                        onClick={() => handleConfirm(item)}
                      >
                        <Check size={14} /> 완료
                      </button>
                      <button
                        type="button"
                        className="sch-payroll-edit-btn"
                        disabled={saving}
                        onClick={() => setCustomEdit(buildCustomEditState(item, entry))}
                      >
                        <Pencil size={14} /> 수정
                      </button>
                      <button
                        type="button"
                        className="sch-btn sch-btn--skip sch-checkin-skip-btn"
                        disabled={saving}
                        onClick={() => setCustomEdit({
                          ...buildCustomEditState(item, entry),
                          intent: "skip",
                        })}
                      >
                        <Ban size={13} aria-hidden />
                        수업 안 함
                      </button>
                    </div>
                  ) : (
                    <p className="sch-muted sch-checkin-wait">위에서부터 차례로 확인합니다</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <PayrollSlotCustomModal
        customEdit={customEdit}
        setCustomEdit={setCustomEdit}
        teacherId={teacherId}
        teacherOptions={teacherOptions}
        saving={saving}
        needsReason={customEditNeedsReason}
        onSave={handleCustomSave}
        onSkip={handleSlotSkip}
        onClose={() => setCustomEdit(null)}
      />
    </div>
  );
}
