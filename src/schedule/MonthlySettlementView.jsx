import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { CONTRACT_TYPES, formatWon, yearMonthKey } from "./constants.js";
import {
  computeAndSaveSettlement,
  fetchInstitutions,
  fetchPayRates,
  fetchPayrollEntries,
  fetchTeachers,
  finalizeMonthSettlements,
} from "./api.js";
import { sortSettlementRows } from "./institutionSort.js";
import {
  expandFixedPayoutSettlements,
  FIXED_PAYOUT_SLICE,
  isFixedPayoutGtsSlice,
  isFixedPayoutManagerSlice,
  isManagerFixedPayout,
} from "./fixedPayoutDisplay.js";
import {
  canViewInstitutionRevenue,
  isScheduleSuperAdmin,
} from "./managerScope.js";

function SettlementRow({ s }) {
  const contractType = s.institutions?.contract_type;
  const personal = contractType === "manager_personal";
  const fixedPayout = contractType === "manager_fixed_payout";
  const partner = contractType === "partner_billing";
  const managerSlice = isFixedPayoutManagerSlice(s);

  if (partner) return null;

  if (managerSlice) {
    return (
      <tr>
        <td>{s.institutions?.name}</td>
        <td>{CONTRACT_TYPES[contractType]}</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>고정 {formatWon(s.fixed_payout)}</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>{s.is_finalized ? "확정" : "진행"}</td>
      </tr>
    );
  }

  return (
    <tr className={!s.revenue && contractType !== "manager_fixed_payout" ? "sch-row-warn" : ""}>
      <td>{s.institutions?.name}</td>
      <td>{CONTRACT_TYPES[contractType]}</td>
      <td>{formatWon(s.revenue)}</td>
      <td>{formatWon(s.vat)}</td>
      <td>{formatWon(s.revenue_after_vat)}</td>
      <td>{personal || fixedPayout ? "—" : formatWon(s.income_tax)}</td>
      <td>
        {personal ? "—" : fixedPayout
          ? `고정 ${formatWon(s.fixed_payout)}`
          : formatWon(s.instructor_cost)}
      </td>
      <td>{formatWon(s.net_profit)}</td>
      <td>{personal || fixedPayout || isFixedPayoutGtsSlice(s) ? "—" : formatWon(s.manager_share)}</td>
      <td>{personal ? "—" : formatWon(s.gts_share)}</td>
      <td>{s.is_finalized ? "확정" : "진행"}</td>
    </tr>
  );
}

export default function MonthlySettlementView({ me, onBack }) {
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [settlements, setSettlements] = useState([]);
  const [managerMap, setManagerMap] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [institutions, teachers] = await Promise.all([
        fetchInstitutions({ activeOnly: false }),
        fetchTeachers(),
      ]);
      const mgr = {};
      teachers.forEach(t => { mgr[t.id] = t.name; });
      setManagerMap(mgr);
      const [entries, rates] = await Promise.all([
        fetchPayrollEntries({ yearMonth }),
        fetchPayRates(),
      ]);
      const results = [];
      for (const inst of institutions) {
        if (isManagerFixedPayout(inst) && !canViewInstitutionRevenue(me, inst)) {
          results.push({
            id: `manager-slice-${inst.id}`,
            institution_id: inst.id,
            institutions: inst,
            fixed_payout: inst.fixed_payout_amount,
            revenue: 0,
            vat: 0,
            income_tax: 0,
            instructor_cost: 0,
            net_profit: 0,
            manager_share: 0,
            gts_share: 0,
            is_finalized: false,
            displayKey: `${inst.id}:${FIXED_PAYOUT_SLICE.manager}`,
            displaySlice: FIXED_PAYOUT_SLICE.manager,
          });
          continue;
        }
        try {
          const row = await computeAndSaveSettlement(inst, yearMonth, entries, rates);
          results.push(row);
        } catch (err) {
          console.error(inst.name, err);
        }
      }
      setSettlements(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [yearMonth, me]);

  useEffect(() => { load(); }, [load]);

  const { regularGroups, partnerRows } = useMemo(() => {
    const visible = isScheduleSuperAdmin(me)
      ? settlements
      : settlements.filter(s => !isFixedPayoutGtsSlice(s));
    const { regular, partner } = expandFixedPayoutSettlements(visible);
    for (const [mgrId, rows] of regular) {
      regular.set(mgrId, sortSettlementRows(rows));
    }
    return { regularGroups: regular, partnerRows: partner };
  }, [settlements, me]);

  const totals = useMemo(() => {
    const visible = isScheduleSuperAdmin(me)
      ? settlements
      : settlements.filter(s => !isFixedPayoutGtsSlice(s));
    const t = { revenue: 0, instructor_cost: 0, net_profit: 0, manager_share: 0, gts_share: 0 };
    for (const s of visible) {
      if (s.institutions?.contract_type === "partner_billing") continue;
      t.revenue += Number(s.revenue) || 0;
      t.instructor_cost += Number(s.instructor_cost) || 0;
      t.net_profit += Number(s.net_profit) || 0;
      t.manager_share += Number(s.manager_share) || 0;
      t.gts_share += Number(s.gts_share) || 0;
    }
    return t;
  }, [settlements, me]);

  const partnerTotal = useMemo(
    () => partnerRows.reduce((sum, s) => sum + (Number(s.partner_invoice_amount) || 0), 0),
    [partnerRows],
  );

  const handleFinalize = async () => {
    if (!confirm(`${yearMonth} 정산을 확정할까요? 확정 후 강사 입력이 잠깁니다.`)) return;
    try {
      await finalizeMonthSettlements(yearMonth);
      await load();
      alert("확정되었습니다.");
    } catch (err) {
      alert("확정 실패: " + err.message);
    }
  };

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 급여/정산
        </button>
        <h2 className="sch-view-title">월별 정산</h2>
        {isScheduleSuperAdmin(me) ? (
          <button type="button" className="sch-btn sch-btn--primary" onClick={handleFinalize}>
            이번 달 확정
          </button>
        ) : null}
      </header>

      <div className="sch-toolbar">
        <input type="month" className="sch-input" value={yearMonth} onChange={e => setYearMonth(e.target.value)}/>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={load}>재계산</button>
      </div>

      {loading ? <p className="sch-muted">계산 중...</p> : (
        <>
          {[...regularGroups.entries()].map(([mgrId, rows]) => (
            <section key={mgrId} className="sch-table-section">
              <h3>
                {mgrId === "none"
                  ? "본사 그룹"
                  : `${managerMap[mgrId] || "담당자"} 그룹`}
              </h3>
              <div className="sch-table-wrap">
                <table className="sch-table sch-table--compact">
                  <thead>
                    <tr>
                      <th>원</th>
                      <th>유형</th>
                      <th>매출</th>
                      <th>부가세</th>
                      <th>부가세제외</th>
                      <th>종소세</th>
                      <th>강사료/고정지급</th>
                      <th>순이익</th>
                      <th>담당자</th>
                      <th>GTS</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(s => <SettlementRow key={s.displayKey ?? s.id} s={s} />)}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {partnerRows.length > 0 ? (
            <section className="sch-table-section sch-table-section--partner">
              <h3>파트너 청구</h3>
              <p className="sch-muted sch-billing-note">
                파트너가 직접 계약한 원 — GTS 매출 없음, 파견 강사료만 청구합니다.
              </p>
              <div className="sch-table-wrap">
                <table className="sch-table sch-table--compact">
                  <thead>
                    <tr>
                      <th>원</th>
                      <th>담당 파트너</th>
                      <th>청구금액</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerRows.map(s => (
                      <tr key={s.id}>
                        <td>{s.institutions?.name}</td>
                        <td>{managerMap[s.institutions?.manager_id] || "—"}</td>
                        <td>{formatWon(s.partner_invoice_amount)}</td>
                        <td>{s.is_finalized ? "확정" : "진행"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div className="sch-totals-bar">
            <span>전체 매출 {formatWon(totals.revenue)}</span>
            <span>강사료 {formatWon(totals.instructor_cost)}</span>
            <span>순이익 {formatWon(totals.net_profit)}</span>
            {isScheduleSuperAdmin(me) ? (
              <>
                <span>담당자 {formatWon(totals.manager_share)}</span>
                <span>GTS {formatWon(totals.gts_share)}</span>
              </>
            ) : null}
            {partnerTotal > 0 ? <span>파트너 청구 {formatWon(partnerTotal)}</span> : null}
          </div>
        </>
      )}
    </div>
  );
}
