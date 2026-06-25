import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  formatWon, yearMonthFirstDay, yearMonthKey,
} from "./constants.js";
import {
  computePerCapitaRevenue,
  computePerSessionRevenue,
  estimateTeacherPayByEntry,
  pickSessionRate,
} from "./settlement.js";
import { isManagerFixedPayout } from "./fixedPayoutDisplay.js";
import {
  deleteMonthlySessionCount,
  fetchMonthlyContracts,
  fetchMonthlySessionCounts,
  fetchPayRates,
  fetchPayrollEntries,
  fetchSessionRates,
  insertSessionRate,
  saveMonthlyContract,
  saveMonthlySessionCount,
} from "./api.js";
import {
  buildMonthlyContractPayload,
  getMonthlyContractDraft,
  isMonthlyFixedBilling,
  isPerCapitaBilling,
  PER_CAPITA_SESSION_TYPE,
  previousYearMonth,
} from "./monthlyBilling.js";

export default function InstitutionBillingTab({ institution, institutionId, canViewRevenue = true }) {
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [contracts, setContracts] = useState([]);
  const [sessionRates, setSessionRates] = useState([]);
  const [sessionCounts, setSessionCounts] = useState([]);
  const [partnerPayroll, setPartnerPayroll] = useState(0);
  const [loading, setLoading] = useState(true);

  const isPartner = institution.contract_type === "partner_billing";
  const isPerSession = institution.billing_type === "per_session" && !isPartner;
  const isPerCapita = isPerCapitaBilling(institution, sessionRates, sessionCounts);
  const isMonthlyFixed = isMonthlyFixedBilling(institution);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, rates, counts] = await Promise.all([
        fetchMonthlyContracts(institutionId),
        fetchSessionRates(institutionId),
        fetchMonthlySessionCounts(institutionId, yearMonth),
      ]);
      setContracts(c);
      setSessionRates(rates);
      setSessionCounts(counts);

      if (isPartner) {
        const [entries, payRates] = await Promise.all([
          fetchPayrollEntries({ institutionId, yearMonth }),
          fetchPayRates(),
        ]);
        setPartnerPayroll(estimateTeacherPayByEntry(entries, payRates));
      } else {
        setPartnerPayroll(0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [institutionId, yearMonth, isPartner]);

  useEffect(() => { load(); }, [load]);

  const sessionTypes = useMemo(() => {
    const types = new Set(sessionRates.map(r => r.session_type));
    sessionCounts.forEach(c => types.add(c.session_type));
    return [...types].sort();
  }, [sessionRates, sessionCounts]);

  const asOfDate = `${yearMonth}-28`;
  const previewRevenue = useMemo(
    () => computePerSessionRevenue(sessionCounts, sessionRates, asOfDate),
    [sessionCounts, sessionRates, asOfDate],
  );

  const capitaRate = useMemo(
    () => pickSessionRate(sessionRates, PER_CAPITA_SESSION_TYPE, asOfDate),
    [sessionRates, asOfDate],
  );
  const capitaRow = sessionCounts.find(c => c.session_type === PER_CAPITA_SESSION_TYPE);
  const previewCapitaRevenue = useMemo(
    () => computePerCapitaRevenue(sessionCounts, sessionRates, asOfDate),
    [sessionCounts, sessionRates, asOfDate],
  );

  const addContract = async () => {
    const amount = prompt("이번 달 계약금액(원)을 입력하세요", "0");
    if (amount == null) return;
    try {
      await saveMonthlyContract({
        institution_id: institutionId,
        year_month: yearMonthFirstDay(yearMonth),
        contract_amount: Number(amount.replace(/,/g, "")) || 0,
      });
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const addSessionRate = async () => {
    const sessionType = prompt("수업 유형 (예: 정규, 방과후)", "정규");
    if (!sessionType?.trim()) return;
    const rate = prompt("회당 단가(원)", "0");
    if (rate == null) return;
    const effectiveFrom = prompt("적용 시작일 (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!effectiveFrom) return;
    try {
      await insertSessionRate({
        institution_id: institutionId,
        session_type: sessionType.trim(),
        rate_per_session: Number(rate.replace(/,/g, "")) || 0,
        effective_from: effectiveFrom,
      });
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const saveCount = async (sessionType, count, note, existingId) => {
    try {
      await saveMonthlySessionCount({
        id: existingId,
        institution_id: institutionId,
        year_month: yearMonthFirstDay(yearMonth),
        session_type: sessionType,
        session_count: Number(count) || 0,
        note: note || null,
      });
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const addSessionTypeRow = async () => {
    const sessionType = prompt("수업 유형 (예: 정규, 방과후)", "정규");
    if (!sessionType?.trim()) return;
    const count = prompt("이번 달 진행 횟수", "0");
    if (count == null) return;
    await saveCount(sessionType.trim(), count, null, null);
  };

  if (loading) return <p className="sch-muted">불러오는 중...</p>;

  const hideRevenue = !canViewRevenue && isManagerFixedPayout(institution);

  if (hideRevenue) {
    return (
      <section className="sch-billing-panel">
        <h4 className="sch-subtitle">고정지급 (담당자)</h4>
        <p className="sch-muted sch-billing-note">
          이 원은 고정지급 계약입니다. 담당자 지급액만 표시됩니다.
          전체 매출·GTS 정산 정보는 본사(슈퍼관리자)에서만 확인할 수 있습니다.
        </p>
        <div className="sch-billing-preview">
          <span>담당자 고정지급</span>
          <strong>{formatWon(institution.fixed_payout_amount)}</strong>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="sch-toolbar">
        <label className="sch-field sch-field--inline">
          <span>대상 월</span>
          <input type="month" className="sch-input" value={yearMonth}
            onChange={e => setYearMonth(e.target.value)}/>
        </label>
      </div>

      {isPartner ? (
        <section className="sch-billing-panel">
          <h4 className="sch-subtitle">파트너 청구 (강사료 합산)</h4>
          <p className="sch-muted sch-billing-note">
            이 원은 파트너가 직접 계약한 곳입니다. GTS 매출은 없으며, 파견 강사료만 파트너에게 청구합니다.
          </p>
          <div className="sch-billing-preview">
            <span>파트너 청구금액</span>
            <strong>{formatWon(partnerPayroll)}</strong>
          </div>
          <p className="sch-muted">급여 입력에서 이 원을 선택한 수업시간이 합산됩니다.</p>
        </section>
      ) : isPerCapita ? (
        <>
          <section className="sch-billing-panel">
            <h4 className="sch-subtitle">인당 단가</h4>
            <ul className="sch-entry-list">
              {capitaRate > 0 ? (
                <li className="sch-entry-item">
                  <span>{Number(capitaRate).toLocaleString()}원/인</span>
                </li>
              ) : (
                <li className="sch-muted">등록된 인당 단가가 없습니다.</li>
              )}
            </ul>
          </section>

          <section className="sch-billing-panel">
            <h4 className="sch-subtitle">{yearMonth} 인원수</h4>
            {capitaRate <= 0 ? (
              <p className="sch-muted">인당 단가를 먼저 등록해주세요.</p>
            ) : (
              <ul className="sch-session-count-list">
                <SessionCountRow
                  sessionType="인원"
                  row={capitaRow}
                  rate={capitaRate}
                  subtotal={previewCapitaRevenue}
                  unitLabel="명"
                  onSave={(count, note) => saveCount(PER_CAPITA_SESSION_TYPE, count, note, capitaRow?.id)}
                  onDelete={capitaRow?.id ? async () => {
                    await deleteMonthlySessionCount(capitaRow.id);
                    await load();
                  } : null}
                />
              </ul>
            )}
            <div className="sch-billing-preview">
              <span>자동 계산 매출</span>
              <strong>{formatWon(previewCapitaRevenue)}</strong>
            </div>
          </section>
        </>
      ) : isPerSession ? (
        <>
          <section className="sch-billing-panel">
            <div className="sch-billing-panel-header">
              <h4 className="sch-subtitle">회당 단가</h4>
              <button type="button" className="sch-btn sch-btn--ghost" onClick={addSessionRate}>
                <Plus size={14}/> 단가 추가
              </button>
            </div>
            <ul className="sch-entry-list">
              {sessionRates.length === 0 ? (
                <li className="sch-muted">등록된 단가가 없습니다.</li>
              ) : sessionRates.map(r => (
                <li key={r.id} className="sch-entry-item">
                  <span>
                    {r.session_type} · {Number(r.rate_per_session).toLocaleString()}원/회
                    <span className="sch-muted"> · {r.effective_from}~</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="sch-billing-panel">
            <div className="sch-billing-panel-header">
              <h4 className="sch-subtitle">{yearMonth} 진행 횟수</h4>
              <button type="button" className="sch-btn sch-btn--primary" onClick={addSessionTypeRow}>
                <Plus size={14}/> 유형 추가
              </button>
            </div>
            {sessionTypes.length === 0 ? (
              <p className="sch-muted">단가를 먼저 등록한 뒤 진행 횟수를 입력하세요.</p>
            ) : (
              <ul className="sch-session-count-list">
                {sessionTypes.map(type => {
                  const row = sessionCounts.find(c => c.session_type === type);
                  const rate = pickSessionRate(sessionRates, type, asOfDate);
                  const subtotal = (Number(row?.session_count) || 0) * rate;
                  return (
                    <SessionCountRow
                      key={type}
                      sessionType={type}
                      row={row}
                      rate={rate}
                      subtotal={subtotal}
                      onSave={(count, note) => saveCount(type, count, note, row?.id)}
                      onDelete={row?.id ? async () => {
                        await deleteMonthlySessionCount(row.id);
                        await load();
                      } : null}
                    />
                  );
                })}
              </ul>
            )}
            <div className="sch-billing-preview">
              <span>자동 계산 매출</span>
              <strong>{formatWon(previewRevenue)}</strong>
            </div>
          </section>
        </>
      ) : isMonthlyFixed ? (
        <MonthlyFixedContractPanel
          yearMonth={yearMonth}
          contracts={contracts}
          institutionId={institutionId}
          onSaved={load}
        />
      ) : (
        <section className="sch-billing-panel">
          <button type="button" className="sch-btn sch-btn--primary" onClick={addContract}>
            <Plus size={14}/> {yearMonth} 계약금액 입력
          </button>
          <ul className="sch-entry-list">
            {contracts
              .filter(c => c.year_month?.slice(0, 7) === yearMonth)
              .map(c => (
                <li key={c.id} className="sch-entry-item">
                  <span>{c.year_month?.slice(0, 7)} · {Number(c.contract_amount).toLocaleString()}원</span>
                  {c.student_count != null ? <span className="sch-muted"> · {c.student_count}명</span> : null}
                </li>
              ))}
            {contracts.filter(c => c.year_month?.slice(0, 7) === yearMonth).length === 0 ? (
              <li className="sch-muted">이 달 계약금액이 없습니다.</li>
            ) : null}
          </ul>
        </section>
      )}

      {!isPartner && contracts.length > 0 && !isPerSession && !isPerCapita ? (
        <details className="sch-billing-history">
          <summary>과거 계약 이력</summary>
          <ul className="sch-entry-list">
            {contracts.map(c => (
              <li key={c.id} className="sch-entry-item">
                <span>{c.year_month?.slice(0, 7)} · {Number(c.contract_amount).toLocaleString()}원</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function MonthlyFixedContractPanel({ yearMonth, contracts, institutionId, onSaved }) {
  const draft = useMemo(
    () => getMonthlyContractDraft(contracts, yearMonth, institutionId),
    [contracts, yearMonth, institutionId],
  );
  const [amount, setAmount] = useState("");
  const [studentCount, setStudentCount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmount(draft.source !== "empty" ? String(draft.amount ?? 0) : "");
    setStudentCount(draft.studentCount === "" || draft.studentCount == null ? "" : String(draft.studentCount));
  }, [draft]);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      await saveMonthlyContract(buildMonthlyContractPayload({
        institutionId,
        yearMonth,
        amount,
        studentCount,
        existingId: draft.contract?.id,
      }));
      await onSaved();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const prevLabel = draft.previousYearMonth ?? previousYearMonth(yearMonth);

  return (
    <section className="sch-billing-panel">
      <h4 className="sch-subtitle">{yearMonth} 월 고정 매출</h4>
      {draft.source === "previous_month" ? (
        <p className="sch-billing-prefill-hint">
          {prevLabel}에 입력한 금액을 기본값으로 불러왔습니다. 그대로 저장하거나 수정 후 저장하세요.
        </p>
      ) : draft.source === "empty" ? (
        <p className="sch-muted sch-billing-note">직전 달 매출 이력이 없습니다. 금액을 입력해 주세요.</p>
      ) : (
        <p className="sch-muted sch-billing-note">이미 저장된 {yearMonth} 매출입니다. 수정 후 저장할 수 있습니다.</p>
      )}
      <form className="sch-form sch-form--inline-billing" onSubmit={handleSave}>
        <label className="sch-field">
          <span>계약금액 (원)</span>
          <input
            type="text"
            inputMode="numeric"
            className="sch-input"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
          />
        </label>
        <label className="sch-field">
          <span>학생 수 (선택)</span>
          <input
            type="number"
            min={0}
            className="sch-input sch-input--narrow"
            value={studentCount}
            onChange={e => setStudentCount(e.target.value)}
            placeholder="—"
          />
        </label>
        <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </form>
      {amount !== "" ? (
        <div className="sch-billing-preview">
          <span>{yearMonth} 매출</span>
          <strong>{formatWon(Number(amount))}</strong>
        </div>
      ) : null}
    </section>
  );
}

function SessionCountRow({ sessionType, row, rate, subtotal, onSave, onDelete, unitLabel = "회" }) {
  const [count, setCount] = useState(String(row?.session_count ?? 0));
  const [note, setNote] = useState(row?.note || "");

  useEffect(() => {
    setCount(String(row?.session_count ?? 0));
    setNote(row?.note || "");
  }, [row]);

  return (
    <li className="sch-session-count-row">
      <div className="sch-session-count-label">
        <strong>{sessionType}</strong>
        <span className="sch-muted">{Number(rate).toLocaleString()}원/{unitLabel === "명" ? "인" : "회"}</span>
      </div>
      <input
        type="number"
        className="sch-input sch-input--narrow"
        min={0}
        value={count}
        onChange={e => setCount(e.target.value)}
        onBlur={() => onSave(count, note)}
      />
      <span className="sch-muted">{unitLabel}</span>
      <input
        className="sch-input"
        placeholder="메모 (특수수업 등)"
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => onSave(count, note)}
      />
      <span className="sch-session-subtotal">{formatWon(subtotal)}</span>
      {onDelete ? (
        <button type="button" className="sch-icon-btn" onClick={onDelete} aria-label="삭제">
          <Trash2 size={14}/>
        </button>
      ) : null}
    </li>
  );
}
