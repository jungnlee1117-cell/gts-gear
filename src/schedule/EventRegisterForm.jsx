import InstitutionSearchSelect from "./InstitutionSearchSelect.jsx";
import { EXCEPTION_LABELS } from "./constants.js";

export const EMPTY_EVENT_FORM = {
  institution_id: "",
  scope: "global", // global | institution (공지용)
  start_date: "",
  end_date: "",
  exception_type: "event",
  note: "",
};

export function exceptionToEventForm(ex) {
  return {
    id: ex.id,
    institution_id: ex.institution_id || "",
    start_date: ex.exception_date || "",
    end_date: ex.end_date && ex.end_date !== ex.exception_date ? ex.end_date : "",
    exception_type: ex.exception_type || "event",
    note: ex.note || "",
  };
}

/**
 * 스케줄 행사일정 / 공지 행사 공통 입력 필드
 * allowGlobal: "전체 공개" 선택 가능 (공지용, institution_id="")
 */
export function EventScheduleFields({
  form,
  setForm,
  institutions = [],
  allowGlobal = false,
  useSearchSelect = false,
}) {
  const isGlobal = allowGlobal && (form.scope !== "institution");

  return (
    <>
      <div className="sch-field">
        <span>원 *</span>
        {useSearchSelect ? (
          <>
            {allowGlobal ? (
              <div className="sch-chip-row" style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  className={`sch-chip${isGlobal ? " active" : ""}`}
                  onClick={() => setForm(f => ({ ...f, scope: "global", institution_id: "" }))}
                >
                  전체 공개
                </button>
                <button
                  type="button"
                  className={`sch-chip${!isGlobal ? " active" : ""}`}
                  onClick={() => setForm(f => ({ ...f, scope: "institution" }))}
                >
                  특정 기관
                </button>
              </div>
            ) : null}
            {isGlobal ? (
              <p className="sch-muted" style={{ margin: 0 }}>
                슈퍼관리자·전체 관리자·전체 선생님에게 공개됩니다.
              </p>
            ) : (
              <>
                <InstitutionSearchSelect
                  institutions={institutions}
                  value={form.institution_id || ""}
                  onChange={(id) => setForm(f => ({
                    ...f,
                    scope: "institution",
                    institution_id: id || "",
                  }))}
                  required
                  placeholder="기관 이름 검색"
                />
                <p className="sch-muted" style={{ marginTop: 6 }}>
                  해당 기관 담당 선생님·담당 관리자만 조회할 수 있습니다. (슈퍼관리자는 전체)
                </p>
              </>
            )}
          </>
        ) : (
          <select
            className="sch-select"
            required={!allowGlobal}
            value={form.institution_id}
            onChange={e => setForm(f => ({ ...f, institution_id: e.target.value }))}
          >
            {allowGlobal ? (
              <option value="">전체 공개</option>
            ) : (
              <option value="">원 선택</option>
            )}
            {institutions.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="sch-time-row">
        <label className="sch-field">
          <span>시작일</span>
          <input
            type="date"
            className="sch-input"
            required
            value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
          />
        </label>
        <label className="sch-field">
          <span>종료일 (선택)</span>
          <input
            type="date"
            className="sch-input"
            value={form.end_date}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
          />
        </label>
      </div>
      <label className="sch-field">
        <span>유형</span>
        <select
          className="sch-select"
          value={form.exception_type}
          onChange={e => setForm(f => ({ ...f, exception_type: e.target.value }))}
        >
          {Object.entries(EXCEPTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className="sch-field">
        <span>메모</span>
        <input
          type="text"
          className="sch-input"
          required
          placeholder="예: 여름방학, 현장학습"
          value={form.note}
          onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
        />
      </label>
    </>
  );
}

export default function EventRegisterForm({
  form,
  setForm,
  institutions,
  saving,
  onSubmit,
  onCancel,
  showCancel = false,
  submitLabel = "안내 저장",
  allowGlobal = false,
  useSearchSelect = false,
}) {
  return (
    <form className="sch-form sch-events-form" onSubmit={onSubmit}>
      <EventScheduleFields
        form={form}
        setForm={setForm}
        institutions={institutions}
        allowGlobal={allowGlobal}
        useSearchSelect={useSearchSelect}
      />
      <div className="sch-form-actions">
        {showCancel ? (
          <button type="button" className="sch-btn sch-btn--ghost" disabled={saving} onClick={onCancel}>
            취소
          </button>
        ) : null}
        <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
          {saving ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
