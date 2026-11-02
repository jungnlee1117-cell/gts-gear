import { useEffect, useMemo, useState } from "react";
import { Printer, Save, X } from "lucide-react";
import { formatWon } from "./constants.js";
import {
  PAYSLIP_DEDUCTIONS,
  PAYSLIP_DEFAULT_EARNINGS,
  PAYSLIP_EARNINGS,
  fetchPayslip,
  fetchPreviousPayslip,
  monthFirstDay,
  savePayslip,
  sumItems,
} from "./salaryPayslip.js";

const num = (v) => Number(String(v ?? "").replace(/[^\d-]/g, "")) || 0;
const fmt = (v) => (v ? Number(v).toLocaleString("ko-KR") : "");

export default function SalaryPayslipModal({
  teacher,
  yearMonth,
  baseGross = 2600000,
  additionalPayments = [],
  onClose,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payDate, setPayDate] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [earnings, setEarnings] = useState({});
  const [deductions, setDeductions] = useState({});
  const [bonusNote, setBonusNote] = useState("");
  const [paid, setPaid] = useState(false);
  const [existing, setExisting] = useState(false);

  const bonusFromAdditional = useMemo(
    () => (additionalPayments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [additionalPayments],
  );
  const bonusReasons = useMemo(
    () => (additionalPayments || []).map(p => `${p.reason} ${Number(p.amount).toLocaleString("ko-KR")}원`).join(", "),
    [additionalPayments],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cur = await fetchPayslip(teacher.id, yearMonth);
        if (!alive) return;
        if (cur) {
          setExisting(true);
          setPayDate(cur.pay_date || "");
          setHireDate(cur.hire_date || "");
          setEarnings(cur.earnings || {});
          setDeductions(cur.deductions || {});
          setBonusNote(cur.bonus_note || "");
          setPaid(Boolean(cur.paid));
        } else {
          const prev = await fetchPreviousPayslip(teacher.id, yearMonth).catch(() => null);
          if (!alive) return;
          const baseEarn = prev
            ? { ...(prev.earnings || {}), 상여: 0 }
            : { ...PAYSLIP_DEFAULT_EARNINGS };
          if (!baseEarn.기본급 && !prev) baseEarn.기본급 = baseGross - (baseEarn.식대 || 0);
          if (bonusFromAdditional) baseEarn.상여 = bonusFromAdditional;
          setEarnings(baseEarn);
          setDeductions(prev ? { ...(prev.deductions || {}) } : {});
          setHireDate(prev?.hire_date || "");
          setBonusNote(bonusReasons);
          const [y, m] = yearMonth.split("-").map(Number);
          const last = new Date(y, m, 0).getDate();
          setPayDate(`${yearMonth}-${String(last).padStart(2, "0")}`);
        }
      } catch (err) {
        alert("명세서를 불러오지 못했습니다: " + (err.message || err)
          + (/relation|schema cache/i.test(err.message || "") ? "\n(Supabase에서 급여_월급제_사업자_SQL.sql을 먼저 실행하세요)" : ""));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [teacher.id, yearMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const gross = sumItems(earnings);
  const dedTotal = sumItems(deductions);
  const net = gross - dedTotal;
  const [yy, mm] = yearMonth.split("-");

  const save = async () => {
    setSaving(true);
    try {
      const saved = await savePayslip({
        teacher_id: teacher.id,
        year_month: monthFirstDay(yearMonth),
        pay_date: payDate || null,
        hire_date: hireDate || null,
        earnings,
        deductions,
        bonus_note: bonusNote || null,
        paid,
      });
      setExisting(true);
      onSaved?.(saved);
      alert("급여명세서를 저장했습니다.");
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const rows = Math.max(PAYSLIP_EARNINGS.length, PAYSLIP_DEDUCTIONS.length);

  return (
    <div className="sch-modal-overlay payslip-overlay" onClick={() => !saving && onClose?.()}>
      <div className="sch-modal sch-modal--wide payslip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sch-modal-head no-print">
          <h3>{teacher.name} 선생님 급여명세서</h3>
          <button type="button" className="sch-icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        {loading ? <p className="sch-muted">불러오는 중...</p> : (
          <>
            <div className="payslip-actions no-print">
              <label className="payslip-field">지급일
                <input type="date" className="sch-input" value={payDate} onChange={e => setPayDate(e.target.value)}/>
              </label>
              <label className="payslip-field">입사일
                <input type="date" className="sch-input" value={hireDate} onChange={e => setHireDate(e.target.value)}/>
              </label>
              <label className="payslip-check">
                <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)}/> 지급 완료
              </label>
              <span className="payslip-actions__spacer"/>
              <button type="button" className="sch-btn" disabled={saving} onClick={save}><Save size={14}/> {saving ? "저장 중..." : "저장"}</button>
              <button type="button" className="sch-btn" onClick={() => window.print()}><Printer size={14}/> 인쇄 / PDF</button>
            </div>

            <div id="payslip-print-area" className="payslip-paper">
              <h2 className="payslip-title">{yy}년 {mm}월분 급여명세서</h2>
              <table className="payslip-info">
                <tbody>
                  <tr><th>회사명</th><td>지티에스(과세)</td><th>사 원 명</th><td>{teacher.name}</td></tr>
                  <tr><th>지 급 일</th><td>{payDate}</td><th>입 사 일</th><td>{hireDate}</td></tr>
                </tbody>
              </table>
              <table className="payslip-table">
                <thead>
                  <tr><th>지급내역</th><th>지급액</th><th>공제내역</th><th>공제액</th></tr>
                </thead>
                <tbody>
                  {Array.from({ length: rows }).map((_, i) => {
                    const e = PAYSLIP_EARNINGS[i];
                    const d = PAYSLIP_DEDUCTIONS[i];
                    return (
                      <tr key={i}>
                        <td>{e || ""}</td>
                        <td className="num">
                          {e ? (
                            <input
                              className="payslip-input"
                              inputMode="numeric"
                              value={fmt(earnings[e])}
                              onChange={ev => setEarnings(p => ({ ...p, [e]: num(ev.target.value) }))}
                            />
                          ) : null}
                        </td>
                        <td>{d || ""}</td>
                        <td className="num">
                          {d ? (
                            <input
                              className="payslip-input"
                              inputMode="numeric"
                              value={fmt(deductions[d])}
                              onChange={ev => setDeductions(p => ({ ...p, [d]: num(ev.target.value) }))}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr><th>지급액 계</th><td className="num">{gross.toLocaleString("ko-KR")}</td><th>공제액 계</th><td className="num">{dedTotal.toLocaleString("ko-KR")}</td></tr>
                  <tr className="payslip-net"><th colSpan={2}>차인지급액</th><td colSpan={2} className="num">{net.toLocaleString("ko-KR")}</td></tr>
                </tfoot>
              </table>
              {bonusNote ? <p className="payslip-note">상여 내역: {bonusNote}</p> : null}
              <p className="payslip-thanks">귀하의 노고에 감사드립니다.</p>
            </div>

            <div className="payslip-tools no-print">
              <label className="payslip-field payslip-field--wide">보너스(상여) 사유
                <input className="sch-input" value={bonusNote} placeholder="예: 11월 성과 보너스" onChange={e => setBonusNote(e.target.value)}/>
              </label>
              <p className="sch-muted">
                {existing ? "저장된 명세서입니다." : "처음 작성하는 달입니다. 지난달 명세서가 있으면 그 금액을 불러왔습니다."}
                {" "}공제내역(4대보험·소득세)은 세무사 자료대로 직접 입력하세요. 이번 달 추가지급 합계: {formatWon(bonusFromAdditional)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
