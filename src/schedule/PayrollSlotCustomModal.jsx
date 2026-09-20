import { classTypeLabel, minutesBetween } from "./constants.js";
import ChangeReasonField from "./ChangeReasonField.jsx";
import {
  isMakeupReason,
  isPersonalReason,
  isSubstituteReason,
} from "./changeReasonOptions.js";
import { plannedSlotDisplayLabel } from "./payrollCalendar.js";

export const PAYROLL_QUICK_MINUTES = [30, 40, 45, 50, 60, 90];

export default function PayrollSlotCustomModal({
  customEdit,
  setCustomEdit,
  teacherId,
  teacherOptions = [],
  saving = false,
  needsReason = false,
  onSave,
  onSkip,
  onClose,
}) {
  if (!customEdit) return null;

  return (
    <div className="sch-modal-overlay" onClick={onClose}>
      <form className="sch-modal sch-form" onClick={(e) => e.stopPropagation()} onSubmit={onSave}>
        <h3>수업 수정</h3>
        <p className="sch-muted">
          {plannedSlotDisplayLabel(customEdit.planned)}
          {" · "}{classTypeLabel(customEdit.planned.payType)} · {customEdit.planned.dateStr}
        </p>
        <div className="sch-chip-row">
          {PAYROLL_QUICK_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              className={`sch-chip${Number(customEdit.minutes) === m ? " active" : ""}`}
              onClick={() => setCustomEdit((c) => ({ ...c, minutes: m }))}
            >
              {m}분
            </button>
          ))}
        </div>
        <label className="sch-field">
          <span>수업 시간 (분)</span>
          <input
            type="number"
            className="sch-input"
            min={1}
            required
            value={customEdit.minutes}
            onChange={(e) => setCustomEdit((c) => ({ ...c, minutes: e.target.value }))}
          />
        </label>
        <div className="sch-time-row">
          <label className="sch-field">
            <span>시작 (참고)</span>
            <input
              type="time"
              className="sch-input"
              value={customEdit.startTime}
              onChange={(e) => {
                const start = e.target.value;
                setCustomEdit((c) => ({
                  ...c,
                  startTime: start,
                  minutes: c.endTime ? minutesBetween(start, c.endTime) : c.minutes,
                }));
              }}
            />
          </label>
          <label className="sch-field">
            <span>종료 (참고)</span>
            <input
              type="time"
              className="sch-input"
              value={customEdit.endTime}
              onChange={(e) => {
                const end = e.target.value;
                setCustomEdit((c) => ({
                  ...c,
                  endTime: end,
                  minutes: c.startTime ? minutesBetween(c.startTime, end) : c.minutes,
                }));
              }}
            />
          </label>
        </div>
        <ChangeReasonField
          label="변동 사유"
          preset={customEdit.changeReasonPreset}
          customText={customEdit.changeReasonCustom}
          onPresetChange={(preset) => setCustomEdit((c) => ({
            ...c,
            changeReasonPreset: preset,
            substituteTeacherId: isSubstituteReason(preset) ? c.substituteTeacherId : "",
            makeupDate: isMakeupReason(preset) || isPersonalReason(preset) ? c.makeupDate : "",
            personalMakeup: isPersonalReason(preset) ? (c.personalMakeup || "") : "",
          }))}
          onCustomChange={(text) => setCustomEdit((c) => ({ ...c, changeReasonCustom: text }))}
          required={needsReason
            || isSubstituteReason(customEdit.changeReasonPreset)
            || isMakeupReason(customEdit.changeReasonPreset)
            || isPersonalReason(customEdit.changeReasonPreset)}
        />
        {isPersonalReason(customEdit.changeReasonPreset) ? (
          <div className="sch-field">
            <span>보강수업 진행 *</span>
            <div className="sch-chip-row" role="group" aria-label="보강수업 진행 여부">
              <button
                type="button"
                className={`sch-chip${customEdit.personalMakeup === "yes" ? " active" : ""}`}
                onClick={() => setCustomEdit((c) => ({ ...c, personalMakeup: "yes" }))}
              >
                O (보강 진행)
              </button>
              <button
                type="button"
                className={`sch-chip${customEdit.personalMakeup === "no" ? " active" : ""}`}
                onClick={() => setCustomEdit((c) => ({
                  ...c,
                  personalMakeup: "no",
                  makeupDate: "",
                }))}
              >
                X (보강 안 함)
              </button>
            </div>
            {customEdit.personalMakeup === "yes" ? (
              <label className="sch-field" style={{ marginTop: 10 }}>
                <span>보강 날짜 *</span>
                <input
                  type="date"
                  className="sch-input"
                  required
                  value={customEdit.makeupDate || ""}
                  onChange={(e) => setCustomEdit((c) => ({ ...c, makeupDate: e.target.value }))}
                />
              </label>
            ) : null}
          </div>
        ) : null}
        {isSubstituteReason(customEdit.changeReasonPreset) ? (
          <label className="sch-field">
            <span>누가 수업했나요? *</span>
            <select
              className="sch-select"
              required
              value={customEdit.substituteTeacherId}
              onChange={(e) => setCustomEdit((c) => ({ ...c, substituteTeacherId: e.target.value }))}
            >
              <option value="">대체 선생님 선택</option>
              {teacherOptions
                .filter((t) => t.id !== teacherId)
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
            <span className="sch-muted sch-field-hint">
              선택 시 수업료는 대체 선생님 급여로 이동하고, 원래 선생님 급여에서는 제외됩니다.
            </span>
          </label>
        ) : null}
        {isMakeupReason(customEdit.changeReasonPreset) ? (
          <>
            <label className="sch-field">
              <span>보강 날짜 *</span>
              <input
                type="date"
                className="sch-input"
                required
                value={customEdit.makeupDate}
                onChange={(e) => setCustomEdit((c) => ({ ...c, makeupDate: e.target.value }))}
              />
            </label>
            <div className="sch-time-row">
              <label className="sch-field">
                <span>보강 시작 *</span>
                <input
                  type="time"
                  className="sch-input"
                  required
                  value={customEdit.makeupStartTime}
                  onChange={(e) => {
                    const start = e.target.value;
                    setCustomEdit((c) => ({
                      ...c,
                      makeupStartTime: start,
                      minutes: c.makeupEndTime
                        ? minutesBetween(start, c.makeupEndTime)
                        : c.minutes,
                    }));
                  }}
                />
              </label>
              <label className="sch-field">
                <span>보강 종료 *</span>
                <input
                  type="time"
                  className="sch-input"
                  required
                  value={customEdit.makeupEndTime}
                  onChange={(e) => {
                    const end = e.target.value;
                    setCustomEdit((c) => ({
                      ...c,
                      makeupEndTime: end,
                      minutes: c.makeupStartTime
                        ? minutesBetween(c.makeupStartTime, end)
                        : c.minutes,
                    }));
                  }}
                />
              </label>
            </div>
            <p className="sch-muted sch-field-hint">
              원래 날짜에는 「수업변경 → 보강일」이, 보강 날짜에는 「(보강) 기관 N분」과 원래 날짜 안내가 표시됩니다.
            </p>
          </>
        ) : null}
        <label className="sch-field">
          <span>메모 (선택)</span>
          <input
            type="text"
            className="sch-input"
            value={customEdit.note}
            onChange={(e) => setCustomEdit((c) => ({ ...c, note: e.target.value }))}
          />
        </label>
        <div className="sch-form-actions sch-form-actions--stack">
          <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>저장</button>
          <button type="button" className="sch-btn sch-btn--skip" disabled={saving} onClick={onSkip}>
            이 수업 안 함
          </button>
          <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose}>취소</button>
        </div>
      </form>
    </div>
  );
}
