import { useMemo, useState } from "react";
import { formatWon } from "./constants.js";
import { bulkSaveMonthlyRevenue, upsertInstitution } from "./api.js";
import { previousYearMonth } from "./monthlyBilling.js";
import { previewPerCapitaRevenueFromDraft, previewPerSessionRevenueFromDraft } from "./institutionRevenueDisplay.js";

export default function InstitutionRevenueEditModal({
  institution,
  yearMonth,
  draft: initialDraft,
  sessionRates,
  teachers = [],
  canEditManager = false,
  isFinalized,
  onClose,
  onSaved,
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [managerId, setManagerId] = useState(institution.manager_id || "");
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    if (draft.mode === "per_capita") {
      return previewPerCapitaRevenueFromDraft(draft, institution.id, sessionRates, yearMonth);
    }
    return previewPerSessionRevenueFromDraft(draft, institution.id, sessionRates, yearMonth);
  }, [draft, institution.id, sessionRates, yearMonth]);

  const handleSave = async () => {
    if (isFinalized) {
      const ok = confirm(
        `${yearMonth} 월 정산이 이미 확정되었습니다.\n매출을 수정하면 정산 수치와 달라질 수 있습니다.\n저장하시겠습니까?`,
      );
      if (!ok) return;
    }

    if (draft.mode === "contract") {
      const amount = String(draft.amount ?? "").replace(/,/g, "");
      if (amount === "") {
        return alert("계약금액을 입력해주세요.");
      }
    }

    setSaving(true);
    try {
      if (canEditManager && (managerId || null) !== (institution.manager_id || null)) {
        await upsertInstitution({
          id: institution.id,
          manager_id: managerId || null,
        });
      }
      await bulkSaveMonthlyRevenue({
        yearMonth,
        institutions: [institution],
        drafts: { [institution.id]: draft },
      });
      onSaved();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const prefillHint = draft.source === "previous_month"
    ? `${draft.previousYearMonth || previousYearMonth(yearMonth)} ${draft.mode === "per_capita" ? "인원수" : "금액/횟수"}를 기본값으로 불러왔습니다.`
    : null;

  return (
    <div className="sch-modal-overlay" onClick={() => !saving && onClose()}>
      <div className="sch-modal sch-modal--wide sch-revenue-edit-modal" onClick={e => e.stopPropagation()}>
        <h3>{institution.name} · {yearMonth}</h3>
        {isFinalized ? (
          <p className="sch-revenue-edit-warn">이번 달 정산이 확정된 원입니다. 수정 시 정산 수치와 달라질 수 있습니다.</p>
        ) : null}
        {prefillHint ? <p className="sch-muted sch-revenue-edit-hint">{prefillHint}</p> : null}

        {canEditManager ? (
          <label className="sch-field sch-revenue-edit-manager">
            <span>담당자</span>
            <select
              className="sch-select"
              value={managerId}
              onChange={e => setManagerId(e.target.value)}
            >
              <option value="">선택</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {draft.mode === "per_session" ? (
          <div className="sch-revenue-edit-sessions">
            {(draft.sessionTypes || []).length === 0 ? (
              <p className="sch-muted">등록된 회당 단가가 없습니다. 원 상세에서 단가를 먼저 추가해주세요.</p>
            ) : (draft.sessionTypes || []).map(type => (
              <label key={type} className="sch-bulk-revenue-session-field">
                <span>{type}</span>
                <input
                  type="number"
                  min={0}
                  className="sch-input sch-input--narrow"
                  value={draft.sessions?.[type] ?? "0"}
                  onChange={e => setDraft(d => ({
                    ...d,
                    sessions: { ...d.sessions, [type]: e.target.value },
                  }))}
                />
                <span className="sch-muted">회</span>
              </label>
            ))}
            {preview >= 0 ? (
              <p className="sch-bulk-revenue-preview">예상 매출 → {formatWon(preview)}</p>
            ) : null}
          </div>
        ) : draft.mode === "per_capita" ? (
          <div className="sch-revenue-edit-sessions">
            <p className="sch-muted sch-revenue-edit-hint">
              인당 단가: {Number(draft.rate || 0).toLocaleString("ko-KR")}원
            </p>
            <label className="sch-bulk-revenue-session-field">
              <span>인원수</span>
              <input
                type="number"
                min={0}
                className="sch-input sch-input--narrow"
                value={draft.headcount ?? "0"}
                onChange={e => setDraft(d => ({ ...d, headcount: e.target.value }))}
              />
              <span className="sch-muted">명</span>
            </label>
            {preview >= 0 ? (
              <p className="sch-bulk-revenue-preview">예상 매출 → {formatWon(preview)}</p>
            ) : null}
          </div>
        ) : (
          <label className="sch-field">
            <span>월 고정 계약금액</span>
            <div className="sch-bulk-revenue-amount-field">
              <input
                type="text"
                inputMode="numeric"
                className="sch-input sch-bulk-revenue-amount-input"
                placeholder="0"
                value={draft.amount ?? ""}
                onChange={e => setDraft(d => ({
                  ...d,
                  amount: e.target.value.replace(/[^\d]/g, ""),
                }))}
              />
              <span className="sch-muted">원</span>
            </div>
          </label>
        )}

        <div className="sch-form-actions">
          <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="button" className="sch-btn sch-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
