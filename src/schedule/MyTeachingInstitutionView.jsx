import { ChevronLeft } from "lucide-react";
import {
  DAY_LABELS,
  classTypeLabel,
  formatMinutes,
  formatWon,
  resolveInstitutionSlotPayType,
} from "./constants.js";
import { buildTeachingInstitutionDetail } from "./myTeachingInstitutions.js";

function clock(value) {
  return String(value || "").slice(0, 5);
}

export default function MyTeachingInstitutionView({
  institutionId,
  institutionName,
  me,
  teacherId,
  subjectName,
  yearMonth,
  slots = [],
  entries = [],
  rates = [],
  sessionRates = [],
  onBack,
}) {
  const subjectId = teacherId || me?.id;
  const ownView = !teacherId || teacherId === me?.id;
  const who = subjectName || "이 선생님";
  const detail = buildTeachingInstitutionDetail({
    slots,
    entries,
    yearMonth,
    teacherId: subjectId,
    institutionId,
    rates,
    sessionRates,
  });

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 급여/정산
        </button>
        <h2 className="sch-view-title">{institutionName}</h2>
      </header>
      <p className="sch-muted">
        {ownView
          ? "이 원에서 내가 가르친 수업과 급여만 표시됩니다."
          : `${who} 선생님이 이 원에서 가르친 수업과 급여만 표시됩니다.`}
      </p>

      <h3 className="sch-rate-form-title">{ownView ? "이번 달 내 수업" : "이번 달 수업"}</h3>
      {detail.slots.length === 0 ? (
        <p className="sch-muted">
          {ownView ? "이번 달에 적용 중인 내 수업이 없습니다." : "이번 달에 적용 중인 수업이 없습니다."}
        </p>
      ) : (
        <table className="sch-table sch-table--compact">
          <thead>
            <tr>
              <th>요일</th>
              <th>시간</th>
              <th>유형</th>
              <th>반</th>
            </tr>
          </thead>
          <tbody>
            {detail.slots.map((slot) => (
              <tr key={slot.id}>
                <td>{DAY_LABELS[Number(slot.day_of_week)] || ""}</td>
                <td>{clock(slot.start_time)}–{clock(slot.end_time)}</td>
                <td>{classTypeLabel(resolveInstitutionSlotPayType(slot))}</td>
                <td>{slot.label || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="sch-rate-form-title" style={{ marginTop: 16 }}>
        {ownView ? "이번 달 내 급여" : "이번 달 급여"}
      </h3>
      {detail.payrollRows.length === 0 && detail.unconfirmed.length === 0 ? (
        <p className="sch-muted">이번 달 급여 기록이 없습니다.</p>
      ) : (
        <table className="sch-table sch-table--compact">
          <thead>
            <tr>
              <th>날짜</th>
              <th>유형</th>
              <th>분</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            {detail.payrollRows.map((row) => (
              <tr key={row.id}>
                <td>{row.date}{row.substitute ? " · 대체" : ""}</td>
                <td>{row.payType}</td>
                <td>{formatMinutes(row.minutes)}</td>
                <td>{formatWon(row.amount)}</td>
              </tr>
            ))}
            {detail.unconfirmed.map((row) => (
              <tr key={row.id}>
                <td>{row.date} · 미확정</td>
                <td>{row.payType}</td>
                <td>{formatMinutes(row.minutes)}</td>
                <td>{row.amount > 0 ? formatWon(row.amount) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="sch-muted" style={{ marginTop: 8 }}>
        확정 {formatMinutes(detail.confirmedMinutes)} · 예상 급여 {formatWon(detail.estimatedPay)}
      </p>
    </div>
  );
}
