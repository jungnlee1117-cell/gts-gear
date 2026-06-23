import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { BILLING_TYPES, CONTRACT_TYPES, formatWon, yearMonthKey } from "./constants.js";
import {
  bulkApplyPreviousMonthContracts,
  fetchInstitutions,
  fetchMonthlyContracts,
  fetchTeachers,
  upsertInstitution,
} from "./api.js";
import {
  findContractForMonth,
  isMonthlyFixedBilling,
  listBulkPrefillTargets,
  previousYearMonth,
} from "./monthlyBilling.js";
import {
  canViewInstitutionRevenue,
  isScheduleSuperAdmin,
} from "./managerScope.js";

export default function InstitutionListView({ onBack, onOpenDetail, onOpenBulkRevenue, me }) {
  const [rows, setRows] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    parking_info: "",
    business_registration_number: "",
    manager_id: "",
    contract_type: "gts_official",
    billing_type: "manual",
    contract_start_date: "",
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [insts, ts, c] = await Promise.all([
        fetchInstitutions({ activeOnly: false }),
        fetchTeachers(),
        fetchMonthlyContracts(),
      ]);
      setRows(insts);
      setTeachers(ts.filter(t => t.role === "admin" || t.role === "superadmin"));
      setContracts(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const bulkTargets = useMemo(
    () => listBulkPrefillTargets(rows, contracts, yearMonth),
    [rows, contracts, yearMonth],
  );

  const handleBulkApply = async () => {
    if (!bulkTargets.length) {
      return alert(`${yearMonth}에 직전 달 금액을 적용할 월 고정 원이 없습니다. (이미 입력됐거나 직전 달 데이터 없음)`);
    }
    const prevYm = previousYearMonth(yearMonth);
    const names = bulkTargets.map(t => t.institution.name).join(", ");
    if (!confirm(
      `${yearMonth} 월 고정 매출 ${bulkTargets.length}개 원에 ${prevYm} 금액을 일괄 적용할까요?\n\n${names}`,
    )) return;
    setBulkSaving(true);
    try {
      const { applied } = await bulkApplyPreviousMonthContracts(yearMonth);
      await load();
      alert(`${applied.length}개 원에 ${prevYm} 금액을 적용했습니다.`);
    } catch (err) {
      alert("일괄 적용 실패: " + err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("원 이름을 입력해주세요.");
    try {
      const created = await upsertInstitution({
        ...form,
        manager_id: form.manager_id || null,
        contract_start_date: form.contract_start_date || null,
      });
      setShowForm(false);
      onOpenDetail(created.id);
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
  };

  const managerName = (id) => teachers.find(t => t.id === id)?.name || "—";

  const revenueStatus = (inst) => {
    if (!canViewInstitutionRevenue(me, inst) && inst.contract_type === "manager_fixed_payout") {
      return `고정지급 ${formatWon(inst.fixed_payout_amount)}`;
    }
    if (!isMonthlyFixedBilling(inst)) return "—";
    const current = findContractForMonth(contracts, yearMonth, inst.id);
    if (current) return "입력됨";
    const prev = findContractForMonth(contracts, previousYearMonth(yearMonth), inst.id);
    if (prev) return "미입력 (직전달 있음)";
    return "미입력";
  };

  const superAdmin = isScheduleSuperAdmin(me);

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">원 관리</h2>
        <div className="sch-header-actions">
          {superAdmin ? (
            <>
              <button type="button" className="sch-btn sch-btn--ghost" onClick={onOpenBulkRevenue}>
                월별 매출 일괄입력
              </button>
              <button type="button" className="sch-btn sch-btn--primary" onClick={() => setShowForm(true)}>
                <Plus size={16}/> 원 추가
              </button>
            </>
          ) : null}
        </div>
      </header>

      {superAdmin ? (
        <div className="sch-toolbar sch-toolbar--inst-list">
          <label className="sch-field sch-field--inline">
            <span>매출 대상 월</span>
            <input
              type="month"
              className="sch-input"
              value={yearMonth}
              onChange={e => setYearMonth(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="sch-btn sch-btn--primary"
            disabled={bulkSaving || loading || bulkTargets.length === 0}
            onClick={handleBulkApply}
          >
            {bulkSaving ? "적용 중…" : `직전 달 금액 일괄 적용 (${bulkTargets.length})`}
          </button>
          <p className="sch-muted sch-toolbar-hint">
            월 고정({BILLING_TYPES.monthly_fixed}) 원만 대상 · 회당과금·파트너 제외
          </p>
        </div>
      ) : null}

      {loading ? <p className="sch-muted">불러오는 중...</p> : (
        <div className="sch-table-wrap">
          <table className="sch-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>담당자</th>
                <th>과금</th>
                <th>{yearMonth} 매출</th>
                <th>계약유형</th>
                <th>활성</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(inst => {
                const status = revenueStatus(inst);
                const pending = status.startsWith("미입력");
                return (
                  <tr key={inst.id} className={pending && isMonthlyFixedBilling(inst) ? "sch-row-warn" : ""}>
                    <td>
                      <button type="button" className="sch-link-btn" onClick={() => onOpenDetail(inst.id)}>
                        {inst.name}
                      </button>
                    </td>
                    <td>{managerName(inst.manager_id)}</td>
                    <td>{BILLING_TYPES[inst.billing_type] || inst.billing_type}</td>
                    <td>{status}</td>
                    <td>{CONTRACT_TYPES[inst.contract_type]}</td>
                    <td>{inst.is_active ? "활성" : "비활성"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <div className="sch-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="sch-modal sch-modal--wide" onClick={e => e.stopPropagation()}>
            <h3>원 추가</h3>
            <form className="sch-form" onSubmit={handleCreate}>
              <label className="sch-field"><span>이름 *</span>
                <input className="sch-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
              </label>
              <label className="sch-field"><span>주소</span>
                <input className="sch-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}/>
              </label>
              <label className="sch-field"><span>주차정보</span>
                <input className="sch-input" value={form.parking_info} onChange={e => setForm(f => ({ ...f, parking_info: e.target.value }))}/>
              </label>
              <label className="sch-field"><span>사업자등록번호</span>
                <input className="sch-input" value={form.business_registration_number}
                  onChange={e => setForm(f => ({ ...f, business_registration_number: e.target.value }))}/>
              </label>
              <label className="sch-field"><span>담당자</span>
                <select className="sch-select" value={form.manager_id}
                  onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}>
                  <option value="">선택</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="sch-field"><span>계약유형</span>
                <select className="sch-select" value={form.contract_type}
                  onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}>
                  {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="sch-field"><span>과금방식</span>
                <select className="sch-select" value={form.billing_type}
                  onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}>
                  {Object.entries(BILLING_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <div className="sch-form-actions">
                <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setShowForm(false)}>취소</button>
                <button type="submit" className="sch-btn sch-btn--primary">저장</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
