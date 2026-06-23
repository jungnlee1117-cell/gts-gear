import { useMemo } from "react";
import { Megaphone } from "lucide-react";
import {
  filterExceptionsForMonth,
  formatExceptionNotice,
} from "./scheduleExceptions.js";
import { hasHolidayDataForYear } from "./koreanHolidays.js";

/** 급여/정산 화면 상단 — 이번 달 공지·원 안내 */
export default function PayrollMonthNotices({ exceptions, year, month }) {
  const items = useMemo(
    () => filterExceptionsForMonth(exceptions, year, month),
    [exceptions, year, month],
  );
  const holidayDataMissing = !hasHolidayDataForYear(year);

  return (
    <section className="sch-payroll-month-notices" aria-label="이번 달 안내사항">
      <h3 className="sch-payroll-month-notices-title">
        <Megaphone size={20} strokeWidth={2} className="sch-payroll-month-notices-icon" aria-hidden />
        이번 달 안내사항
      </h3>
      <div className="sch-payroll-month-notices-body">
        {holidayDataMissing ? (
          <p className="sch-holiday-data-warn">
            {year}년 공휴일 데이터가 없습니다. koreanHolidays.js에 해당 연도 목록을 추가해 주세요.
          </p>
        ) : null}
        {items.length > 0 ? (
          <ul className="sch-month-notices-list">
            {items.map(ex => (
              <li key={ex.id} className="sch-month-notices-item">
                {ex.institutions?.name ? (
                  <span className="sch-month-notices-inst">{ex.institutions.name}</span>
                ) : null}
                <span className="sch-month-notices-text">{formatExceptionNotice(ex)}</span>
              </li>
            ))}
          </ul>
        ) : !holidayDataMissing ? (
          <p className="sch-payroll-month-notices-empty">등록된 안내사항이 없습니다.</p>
        ) : null}
      </div>
    </section>
  );
}
