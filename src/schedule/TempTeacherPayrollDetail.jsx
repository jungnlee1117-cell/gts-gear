import { ChevronLeft } from "lucide-react";
import { formatMinutes, formatWon, grossToNetPay } from "./constants.js";
import { formatTempTeacherPayFormula, formatTempTeacherPaySummary, TEMP_TEACHER_PAY_MODE_LABELS } from "./temporaryTeachers.js";

function PayTypeCell({ row, payType }) {
  if (row.payType !== payType) return "—";
  if (row.payMode === "daily") {
    return row.workDays > 0 ? `${row.workDays}일` : "—";
  }
  if (row.payMode === "hourly") {
    const minutes = row.byType?.[payType] || 0;
    return minutes > 0 ? formatMinutes(minutes) : (row.workHours > 0 ? `${row.workHours}시간` : "—");
  }
  if (row.payMode === "fixed_total") return "—";
  return "—";
}

export function TempTeacherPayrollTableRow({ row, onSelect, superAdmin = false }) {
  return (
    <tr key={row.teacher.id} className="sch-admin-row--temp">
      <td className="sch-td-name">
        <button
          type="button"
          className="sch-admin-teacher-link"
          onClick={() => onSelect(row)}
        >
          <strong>{row.teacher.name}</strong>
          <span className="sch-badge sch-badge--temp">임시</span>
        </button>
        <p className="sch-admin-cell-hint">{row.institutionName}</p>
        {row.inputMissing ? (
          <span className="sch-admin-row-alert-label">급여 미입력</span>
        ) : null}
      </td>
      <td className="sch-td-num"><PayTypeCell row={row} payType="정규"/></td>
      <td className="sch-td-num"><PayTypeCell row={row} payType="방과후"/></td>
      <td className="sch-td-num"><PayTypeCell row={row} payType="가정방문"/></td>
      <td className="sch-td-num"><PayTypeCell row={row} payType="센터"/></td>
      <td className="sch-td-num"><PayTypeCell row={row} payType="센터보조"/></td>
      <td className="sch-td-num">{formatWon(row.estimatedPay)}</td>
      <td className="sch-td-num sch-pay-net-cell">
        <div className="sch-admin-cell-num">{formatWon(grossToNetPay(row.estimatedPay))}</div>
        <div className="sch-admin-cell-hint">
          <p>{row.paySummaryLabel || formatTempTeacherPaySummary(row.tempTeacher).label}</p>
        </div>
      </td>
      <td className="sch-td-num">—</td>
      {superAdmin ? <td className="sch-td-action">—</td> : null}
    </tr>
  );
}

export default function TempTeacherPayrollDetail({ row, yearMonth, onBack }) {
  const [y, m] = yearMonth.split("-").map(Number);
  const eng = row.tempTeacher;
  const payModeLabel = TEMP_TEACHER_PAY_MODE_LABELS[eng.pay_mode] || eng.pay_mode;

  return (
    <div className="sch-view sch-temp-payroll-detail">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 선생님 목록
        </button>
        <h2 className="sch-view-title">
          {row.teacher.name}
          <span className="sch-badge sch-badge--temp">임시</span>
        </h2>
        <p className="sch-muted">{y}년 {m}월 급여 내역</p>
      </header>

      <div className="sch-summary-cards">
        <div className="sch-summary-card">
          <span className="sch-summary-label">예상 급여</span>
          <strong className="sch-summary-value">{formatWon(row.estimatedPay)}</strong>
        </div>
        <div className="sch-summary-card">
          <span className="sch-summary-label">실수령액 (3.3% 제외)</span>
          <strong className="sch-summary-value">{formatWon(grossToNetPay(row.estimatedPay))}</strong>
        </div>
        {eng.pay_mode === "hourly" && row.workHours > 0 ? (
          <div className="sch-summary-card">
            <span className="sch-summary-label">근무 시간</span>
            <strong className="sch-summary-value">{row.workHours}시간</strong>
          </div>
        ) : null}
        {eng.pay_mode === "daily" && row.workDays > 0 ? (
          <div className="sch-summary-card">
            <span className="sch-summary-label">근무 일수</span>
            <strong className="sch-summary-value">{row.workDays}일</strong>
          </div>
        ) : null}
      </div>

      <section className="sch-admin-dash-section">
        <h3 className="sch-admin-dash-section-title">근무 · 정산 정보</h3>
        <dl className="sch-detail-dl">
          <div className="sch-detail-dl-row">
            <dt>기관</dt>
            <dd>{row.institutionName}</dd>
          </div>
          <div className="sch-detail-dl-row">
            <dt>근무 기간</dt>
            <dd>{row.engagementPeriod || "—"}</dd>
          </div>
          <div className="sch-detail-dl-row">
            <dt>수업 유형</dt>
            <dd>{row.payType}</dd>
          </div>
          <div className="sch-detail-dl-row">
            <dt>급여 방식</dt>
            <dd>{payModeLabel}</dd>
          </div>
          {eng.pay_mode === "hourly" ? (
            <>
              <div className="sch-detail-dl-row">
                <dt>시급</dt>
                <dd>{formatWon(row.rateAmount)}</dd>
              </div>
              <div className="sch-detail-dl-row">
                <dt>근무 시간</dt>
                <dd>{row.workHours || 0}시간</dd>
              </div>
            </>
          ) : null}
          {eng.pay_mode === "daily" ? (
            <>
              <div className="sch-detail-dl-row">
                <dt>일급</dt>
                <dd>{formatWon(row.rateAmount)}</dd>
              </div>
              <div className="sch-detail-dl-row">
                <dt>근무 일수</dt>
                <dd>{row.workDays || 0}일</dd>
              </div>
            </>
          ) : null}
          {eng.pay_mode === "fixed_total" ? (
            <div className="sch-detail-dl-row">
              <dt>총금액</dt>
              <dd>{formatWon(row.rateAmount)}</dd>
            </div>
          ) : null}
          {row.isSubstitute ? (
            <>
              <div className="sch-detail-dl-row">
                <dt>대체 대상</dt>
                <dd>{row.substituteTeacherName ? `${row.substituteTeacherName} 선생님` : "—"}</dd>
              </div>
              <div className="sch-detail-dl-row">
                <dt>대체 기간</dt>
                <dd>{row.substitutePeriod || "—"}</dd>
              </div>
            </>
          ) : null}
          <div className="sch-detail-dl-row">
            <dt>정산 표시</dt>
            <dd>{row.settlementLabel}</dd>
          </div>
          {(eng.phone || eng.bank_name || eng.bank_account) ? (
            <div className="sch-detail-dl-row">
              <dt>연락처 · 계좌</dt>
              <dd>
                {[eng.phone, [eng.bank_name, eng.bank_account].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "—"}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="sch-admin-dash-section">
        <h3 className="sch-admin-dash-section-title">급여 계산</h3>
        <p className="sch-muted sch-admin-dash-section-desc">
          {formatTempTeacherPayFormula(eng)}
          {" → "}
          <strong>{formatWon(row.estimatedPay)}</strong>
        </p>
      </section>
    </div>
  );
}
