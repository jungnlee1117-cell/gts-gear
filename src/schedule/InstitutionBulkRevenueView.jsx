import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  BILLING_TYPES,
  formatWon,
  yearMonthKey,
} from "./constants.js";
import { bulkSaveMonthlyRevenue, loadBulkRevenueData } from "./api.js";
import {
  getInstitutionRevenueInputMode,
  isMonthlyFixedBilling,
  previousYearMonth,
} from "./monthlyBilling.js";
import { computePerCapitaRevenue, computePerSessionRevenue, pickSessionRate } from "./settlement.js";
import { canViewInstitutionRevenue, isScheduleSuperAdmin } from "./managerScope.js";

function sourceHint(source, previousYearMonth) {
  if (source === "previous_month") {
    return `${previousYearMonth} 금액/횟수를 기본값으로 불러왔습니다.`;
  }
  if (source === "saved") return "이번 달 저장됨";
  return null;
}

function BulkRevenueRow({
  institution,
  draft,
  managerName,
  sessionRates,
  yearMonth,
  onDraftChange,
}) {
  const mode = draft?.mode ?? getInstitutionRevenueInputMode(institution, sessionRates);
  const hint = (mode === "per_session" || mode === "per_capita")
    ? sourceHint(draft?.source, previousYearMonth(yearMonth))
    : sourceHint(draft?.source, draft?.previousYearMonth);
  const pending = isMonthlyFixedBilling(institution)
    && draft?.mode === "contract"
    && draft?.source !== "saved"
    && !String(draft?.amount ?? "").replace(/,/g, "");

  const asOfDate = `${yearMonth}-28`;
  const previewRevenue = mode === "per_session" && draft?.sessionTypes?.length
    ? computePerSessionRevenue(
      draft.sessionTypes.map(type => ({
        session_type: type,
        session_count: Number(draft.sessions?.[type]) || 0,
      })),
      sessionRates.filter(r => r.institution_id === institution.id),
      asOfDate,
    )
    : mode === "per_capita"
      ? computePerCapitaRevenue(
        [{ session_type: "인당", session_count: Number(draft?.headcount) || 0 }],
        sessionRates.filter(r => r.institution_id === institution.id),
        asOfDate,
      )
      : 0;

  return (
    <li
      className={[
        "sch-bulk-revenue-row",
        pending ? "sch-bulk-revenue-row--warn" : "",
        draft?.source === "previous_month" ? "sch-bulk-revenue-row--prefill" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="sch-bulk-revenue-row-main">
        <div className="sch-bulk-revenue-row-info">
          <strong className="sch-bulk-revenue-name">{institution.name}</strong>
          <span className="sch-muted sch-bulk-revenue-meta">
            {managerName}
            {" · "}
            {BILLING_TYPES[institution.billing_type] || institution.billing_type}
          </span>
          {hint ? <span className="sch-bulk-revenue-hint">{hint}</span> : null}
        </div>

        <div className="sch-bulk-revenue-row-input">
          {mode === "partner" ? (
            <span className="sch-bulk-revenue-na">입력불필요</span>
          ) : mode === "per_session" ? (
            <div className="sch-bulk-revenue-sessions">
              {(draft?.sessionTypes || []).map(type => (
                <label key={type} className="sch-bulk-revenue-session-field">
                  <span>{type}</span>
                  <input
                    type="number"
                    min={0}
                    className="sch-input sch-input--narrow"
                    value={draft?.sessions?.[type] ?? "0"}
                    onChange={e => onDraftChange(institution.id, {
                      ...draft,
                      sessions: { ...draft.sessions, [type]: e.target.value },
                    })}
                  />
                  <span className="sch-muted">회</span>
                </label>
              ))}
              {previewRevenue > 0 ? (
                <span className="sch-bulk-revenue-preview">→ {formatWon(previewRevenue)}</span>
              ) : null}
            </div>
          ) : mode === "per_capita" ? (
            <div className="sch-bulk-revenue-sessions">
              <span className="sch-muted">
                {Number(draft?.rate || 0).toLocaleString("ko-KR")}원/인
              </span>
              <label className="sch-bulk-revenue-session-field">
                <span>인원</span>
                <input
                  type="number"
                  min={0}
                  className="sch-input sch-input--narrow"
                  value={draft?.headcount ?? "0"}
                  onChange={e => onDraftChange(institution.id, {
                    ...draft,
                    headcount: e.target.value,
                  })}
                />
                <span className="sch-muted">명</span>
              </label>
              {previewRevenue > 0 ? (
                <span className="sch-bulk-revenue-preview">→ {formatWon(previewRevenue)}</span>
              ) : null}
            </div>
          ) : (
            <label className="sch-bulk-revenue-amount-field">
              <span className="sch-muted">계약금액</span>
              <input
                type="text"
                inputMode="numeric"
                className="sch-input sch-bulk-revenue-amount-input"
                placeholder="0"
                value={draft?.amount ?? ""}
                onChange={e => onDraftChange(institution.id, {
                  ...draft,
                  amount: e.target.value.replace(/[^\d]/g, ""),
                })}
              />
              <span className="sch-muted">원</span>
            </label>
          )}
        </div>
      </div>
    </li>
  );
}

export default function InstitutionBulkRevenueView({ onBack, me }) {
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [institutions, setInstitutions] = useState([]);
  const [sessionRates, setSessionRates] = useState([]);
  const [managerMap, setManagerMap] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadBulkRevenueData(yearMonth);
      const scoped = isScheduleSuperAdmin(me)
        ? data.institutions
        : data.institutions.filter(inst => canViewInstitutionRevenue(me, inst));
      setInstitutions(scoped);
      setSessionRates(data.sessionRates);
      setManagerMap(data.managerMap);
      setDrafts(data.drafts);
    } catch (e) {
      console.error(e);
      alert("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [yearMonth, me]);

  useEffect(() => { load(); }, [load]);

  const sortedInstitutions = useMemo(
    () => [...institutions].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [institutions],
  );

  const stats = useMemo(() => {
    let contractInput = 0;
    let sessionInput = 0;
    let capitaInput = 0;
    let partner = 0;
    let pendingFixed = 0;
    for (const inst of institutions) {
      const draft = drafts[inst.id];
      const mode = draft?.mode ?? getInstitutionRevenueInputMode(inst, sessionRates);
      if (mode === "partner") partner += 1;
      else if (mode === "per_session") sessionInput += 1;
      else if (mode === "per_capita") capitaInput += 1;
      else contractInput += 1;
      if (
        isMonthlyFixedBilling(inst)
        && draft?.mode === "contract"
        && draft.source !== "saved"
        && !String(draft.amount ?? "").replace(/,/g, "")
      ) {
        pendingFixed += 1;
      }
    }
    return { contractInput, sessionInput, capitaInput, partner, pendingFixed };
  }, [institutions, drafts]);

  const handleDraftChange = (institutionId, nextDraft) => {
    setDrafts(prev => ({ ...prev, [institutionId]: nextDraft }));
  };

  const handleSaveAll = async () => {
    if (!confirm(`${yearMonth} 매출·진행횟수를 전체 저장할까요?`)) return;
    setSaving(true);
    try {
      const { contractCount, sessionCount } = await bulkSaveMonthlyRevenue({
        yearMonth,
        institutions,
        drafts,
      });
      await load();
      alert(`저장 완료 — 계약 ${contractCount}건, 진행횟수 ${sessionCount}건`);
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isScheduleSuperAdmin(me)) {
    return (
      <div className="sch-view">
        <p className="sch-muted">월별 매출 일괄입력은 슈퍼관리자만 사용할 수 있습니다.</p>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={onBack}>돌아가기</button>
      </div>
    );
  }

  return (
    <div className="sch-view sch-bulk-revenue-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 원 관리
        </button>
        <h2 className="sch-view-title">월별 매출 일괄입력</h2>
      </header>

      <p className="sch-muted sch-bulk-revenue-desc">
        모든 원의 이번 달 매출·진행횟수를 한 화면에서 입력합니다.
        월 고정 원은 직전 달 금액이 미리 채워집니다 — 맞으면 그대로 두고 전체 저장하세요.
      </p>

      <div className="sch-toolbar sch-toolbar--inst-list">
        <label className="sch-field sch-field--inline">
          <span>대상 월</span>
          <input
            type="month"
            className="sch-input"
            value={yearMonth}
            onChange={e => setYearMonth(e.target.value)}
          />
        </label>
        <p className="sch-muted sch-toolbar-hint">
          계약 {stats.contractInput} · 회당 {stats.sessionInput} · 입력불필요 {stats.partner}
          {stats.pendingFixed > 0 ? ` · 미입력 ${stats.pendingFixed}` : ""}
        </p>
      </div>

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : (
        <>
          <ul className="sch-bulk-revenue-list">
            {sortedInstitutions.map(inst => (
              <BulkRevenueRow
                key={inst.id}
                institution={inst}
                draft={drafts[inst.id]}
                managerName={managerMap[inst.manager_id]?.name || "본사"}
                sessionRates={sessionRates}
                yearMonth={yearMonth}
                onDraftChange={handleDraftChange}
              />
            ))}
          </ul>

          <div className="sch-bulk-revenue-footer">
            <button
              type="button"
              className="sch-btn sch-btn--primary sch-btn--lg"
              disabled={saving}
              onClick={handleSaveAll}
            >
              {saving ? "저장 중…" : "전체 저장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
