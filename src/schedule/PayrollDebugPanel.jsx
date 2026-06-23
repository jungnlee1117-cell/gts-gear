import { useMemo, useRef, useState } from "react";
import { formatMinutes } from "./constants.js";
import { buildPayrollDebugReport } from "./payrollDebug.js";
import {
  aggregateDailyMinutes,
  buildRawPayrollEntryRows,
  buildScheduleTheoryDaily,
  buildThreeWayComparison,
  mapToDailyRows,
  parseReferencePayrollCsv,
  referenceRowsToMap,
} from "./payrollCompare.js";

const FILTER_OPTIONS = [
  { id: "all", label: "전체" },
  { id: "included", label: "집계 포함" },
  { id: "excluded", label: "집계 제외" },
  { id: "unconfirmed", label: "미확인" },
  { id: "mismatch", label: "비교 불일치" },
];

const COMPARE_FILTER = [
  { id: "all", label: "전체" },
  { id: "mismatch", label: "불일치만" },
  { id: "missing_system", label: "시스템 누락" },
  { id: "extra_system", label: "시스템만 있음" },
  { id: "minutes_diff", label: "분 불일치" },
];

/** 손계산 기준: 점심(12:00~12:40) 제외, 4주+α (정규 2960 / 방과후 850) */
const MANUAL_REFERENCE_ROWS = buildManualReferenceJune2026();

/** 구글시트 엑셀 역추적: 정규 2960(손계산과 동일), 방과후 640 = 월·목만 85분×8회 − 6/25 40분 */
const SHEET_REFERENCE_ROWS = buildSheetReferenceJune2026();

function buildManualReferenceJune2026() {
  const rows = [];
  const weekBlocks = [
    ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"],
    ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11"],
    ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18"],
    ["2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25"],
  ];
  const regularByDow = { 1: 205, 2: 205, 3: 120, 4: 205 };
  const afterByDow = { 1: 85, 2: 85, 4: 85 };
  const skipAfterTues = new Set(["2026-06-09", "2026-06-16"]);

  for (const block of weekBlocks) {
    for (const dateStr of block) {
      const dow = new Date(`${dateStr}T12:00:00`).getDay();
      if (regularByDow[dow]) {
        rows.push({ dateStr, payType: "정규", minutes: regularByDow[dow], institutionName: "", source: "manual" });
      }
      if (afterByDow[dow] && !skipAfterTues.has(dateStr)) {
        rows.push({ dateStr, payType: "방과후", minutes: afterByDow[dow], institutionName: "", source: "manual" });
      }
    }
  }
  // 4주 합 2940+850=3790; 손계산 총 2960+850 → 정규 +20 (6/29 월요일 일부 반영)
  rows.push({ dateStr: "2026-06-29", payType: "정규", minutes: 20, institutionName: "", source: "manual" });
  return rows;
}

function buildSheetReferenceJune2026() {
  const regular = buildManualReferenceJune2026().filter(r => r.payType === "정규");
  const afterDates = [
    "2026-06-01", "2026-06-04", "2026-06-08", "2026-06-11",
    "2026-06-15", "2026-06-18", "2026-06-22", "2026-06-25",
  ];
  const after = afterDates.map(dateStr => ({
    dateStr,
    payType: "방과후",
    minutes: dateStr === "2026-06-25" ? 45 : 85,
    institutionName: "",
    source: "sheet",
  }));
  return [...regular, ...after];
}

function TotalsBar({ label, totals, highlight }) {
  return (
    <div className={`sch-payroll-debug-total-card${highlight ? " sch-payroll-debug-total-card--grand" : ""}`}>
      <div className="sch-payroll-debug-total-label">{label}</div>
      <div className="sch-payroll-debug-total-value">
        정규 {formatMinutes(totals.정규 || 0)} · 방과후 {formatMinutes(totals.방과후 || 0)}
      </div>
      <div className="sch-payroll-debug-total-sub">
        합계 {formatMinutes((totals.정규 || 0) + (totals.방과후 || 0))}
      </div>
    </div>
  );
}

export default function PayrollDebugPanel({
  weeklySlots,
  homeVisitPatterns = [],
  entries,
  exceptions = [],
  year,
  month,
  teacherName,
  defaultOpen = false,
  embedded = false,
}) {
  const [activeTab, setActiveTab] = useState("compare");
  const [filter, setFilter] = useState("all");
  const [payTypeFilter, setPayTypeFilter] = useState("all");
  const [compareFilter, setCompareFilter] = useState("mismatch");
  const [referenceSource, setReferenceSource] = useState("manual");
  const [referenceRows, setReferenceRows] = useState(MANUAL_REFERENCE_ROWS);
  const [referenceLabel, setReferenceLabel] = useState("손계산 (2960/850)");
  const fileRef = useRef(null);

  const report = useMemo(
    () => buildPayrollDebugReport({ weeklySlots, homeVisitPatterns, entries, exceptions, year, month }),
    [weeklySlots, homeVisitPatterns, entries, exceptions, year, month],
  );

  const rawEntries = useMemo(
    () => buildRawPayrollEntryRows(entries, weeklySlots),
    [entries, weeklySlots],
  );

  const systemDaily = useMemo(
    () => aggregateDailyMinutes(rawEntries, { includedOnly: true }),
    [rawEntries],
  );

  const theoryDaily = useMemo(
    () => buildScheduleTheoryDaily({
      weeklySlots,
      exceptions,
      year,
      month,
      excludeLunchSlot: true,
    }),
    [weeklySlots, exceptions, year, month],
  );

  const referenceDaily = useMemo(
    () => referenceRowsToMap(referenceRows),
    [referenceRows],
  );

  const comparison = useMemo(
    () => buildThreeWayComparison({
      systemDaily,
      referenceDaily,
      theoryDaily,
    }),
    [systemDaily, referenceDaily, theoryDaily],
  );

  const filteredCompareRows = useMemo(() => {
    let list = comparison.rows;
    if (compareFilter === "mismatch") list = list.filter(r => r.hasMismatch);
    else if (compareFilter !== "all") list = list.filter(r => r.status === compareFilter);
    if (payTypeFilter !== "all") list = list.filter(r => r.payType === payTypeFilter);
    return list;
  }, [comparison.rows, compareFilter, payTypeFilter]);

  const filteredScheduleRows = useMemo(() => {
    let list = report.rows;
    if (payTypeFilter !== "all") list = list.filter(r => r.payType === payTypeFilter);
    if (filter === "included") list = list.filter(r => r.includedInTotal);
    else if (filter === "excluded") list = list.filter(r => !r.includedInTotal);
    else if (filter === "unconfirmed") list = list.filter(r => r.excludeReason === "미확인");
    return list;
  }, [report.rows, filter, payTypeFilter]);

  const filteredRawRows = useMemo(() => {
    let list = rawEntries;
    if (payTypeFilter !== "all") list = list.filter(r => r.payType === payTypeFilter);
    if (filter === "included") list = list.filter(r => r.includedInTotal);
    else if (filter === "excluded") list = list.filter(r => !r.includedInTotal);
    return list;
  }, [rawEntries, filter, payTypeFilter]);

  const payTypesInReport = useMemo(() => {
    const set = new Set([...report.rows, ...rawEntries].map(r => r.payType));
    return ["all", ...Array.from(set)];
  }, [report.rows, rawEntries]);

  const { summary, calculationSteps, weeklyPattern } = report;
  const { summary: cmpSummary } = comparison;

  const handleReferenceUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseReferencePayrollCsv(String(reader.result || ""));
        if (!parsed.length) {
          alert("CSV에서 유효한 행을 찾지 못했습니다. class_date,pay_type,minutes 형식을 확인해 주세요.");
          return;
        }
        setReferenceRows(parsed);
        setReferenceSource("upload");
        setReferenceLabel(`업로드: ${file.name}`);
      } catch (err) {
        console.error(err);
        alert("CSV 파싱 실패");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const useManualReference = () => {
    setReferenceRows(MANUAL_REFERENCE_ROWS);
    setReferenceSource("manual");
    setReferenceLabel("손계산 (2960/850)");
  };

  const useSheetReference = () => {
    setReferenceRows(SHEET_REFERENCE_ROWS);
    setReferenceSource("sheet");
    setReferenceLabel("구글시트 엑셀 (2960/640)");
  };

  const body = (
    <div className="sch-payroll-debug-body">
      <p className="sch-muted sch-payroll-debug-rule">
        집계 규칙: {summary.aggregationRule} · DB payroll_entries {rawEntries.length}건
      </p>

      <div className="sch-payroll-debug-totals sch-payroll-debug-totals--quad">
        <TotalsBar label="시스템 (확정)" totals={cmpSummary.systemTotals} highlight />
        <TotalsBar label={referenceLabel} totals={cmpSummary.referenceTotals} />
        <TotalsBar label="스케줄 이론 (점심 제외)" totals={cmpSummary.theoryTotals} />
        <TotalsBar
          label="차이 (시스템 − 원본)"
          totals={{
            정규: (cmpSummary.systemTotals.정규 || 0) - (cmpSummary.referenceTotals.정규 || 0),
            방과후: (cmpSummary.systemTotals.방과후 || 0) - (cmpSummary.referenceTotals.방과후 || 0),
          }}
        />
      </div>

      <div className="sch-payroll-debug-tabs" role="tablist">
        {[
          { id: "compare", label: "3자 비교" },
          { id: "raw", label: "payroll_entries 원본" },
          { id: "schedule", label: "스케줄×입력" },
          { id: "calc", label: "계산 과정" },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`sch-payroll-debug-tab${activeTab === tab.id ? " sch-payroll-debug-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "compare" ? (
        <>
          <div className="sch-payroll-debug-ref-bar">
            <span className="sch-muted">원본 기준:</span>
            <button
              type="button"
              className={`sch-chip${referenceSource === "manual" ? " active" : ""}`}
              onClick={useManualReference}
            >
              손계산 (2960/850)
            </button>
            <button
              type="button"
              className={`sch-chip${referenceSource === "sheet" ? " active" : ""}`}
              onClick={useSheetReference}
            >
              구글시트 (2960/640)
            </button>
            <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" onClick={() => fileRef.current?.click()}>
              구글시트 CSV 업로드
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleReferenceUpload} />
            {referenceSource === "upload" ? (
              <span className="sch-payroll-debug-ref-name">{referenceLabel}</span>
            ) : null}
          </div>

          {cmpSummary.mismatchCount > 0 ? (
            <section className="sch-payroll-debug-section sch-payroll-debug-alert-box">
              <h4 className="sch-payroll-debug-section-title">불일치 요약 ({cmpSummary.mismatchCount}건)</h4>
              <ul className="sch-payroll-debug-excluded-summary">
                {cmpSummary.missingInSystem.length > 0 ? (
                  <li>
                    <strong>시스템 누락 {cmpSummary.missingInSystem.length}건</strong>
                    {" — "}
                    {cmpSummary.missingInSystem.map(r => `${r.dateStr.slice(5)} ${r.payType} ${r.referenceMinutes}분`).join(", ")}
                  </li>
                ) : null}
                {cmpSummary.extraInSystem.length > 0 ? (
                  <li>
                    <strong>시스템만 있음 {cmpSummary.extraInSystem.length}건</strong>
                    {" — "}
                    {cmpSummary.extraInSystem.map(r => `${r.dateStr.slice(5)} ${r.payType} ${r.systemMinutes}분`).join(", ")}
                  </li>
                ) : null}
                {cmpSummary.minutesDiff.length > 0 ? (
                  <li>
                    <strong>분 불일치 {cmpSummary.minutesDiff.length}건</strong>
                    {" — "}
                    {cmpSummary.minutesDiff.map(r => `${r.dateStr.slice(5)} ${r.payType} (원본 ${r.referenceMinutes ?? "—"} / 시스템 ${r.systemMinutes ?? "—"} / 이론 ${r.theoryMinutes ?? "—"})`).join("; ")}
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          <div className="sch-payroll-debug-filters">
            <div className="sch-chip-row">
              {COMPARE_FILTER.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`sch-chip${compareFilter === opt.id ? " active" : ""}`}
                  onClick={() => setCompareFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select className="sch-input sch-payroll-debug-type-select" value={payTypeFilter} onChange={e => setPayTypeFilter(e.target.value)}>
              {payTypesInReport.map(t => (
                <option key={t} value={t}>{t === "all" ? "구분: 전체" : t}</option>
              ))}
            </select>
          </div>

          <div className="sch-table-wrap sch-payroll-debug-table-wrap">
            <table className="sch-table sch-payroll-debug-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>구분</th>
                  <th>원본(시트/손계산)</th>
                  <th>시스템</th>
                  <th>스케줄 이론</th>
                  <th>상태</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompareRows.length === 0 ? (
                  <tr><td colSpan={7} className="sch-muted">표시할 비교 행이 없습니다.</td></tr>
                ) : filteredCompareRows.map(row => (
                  <tr key={row.key} className={row.hasMismatch ? "sch-payroll-debug-row--excluded" : ""}>
                    <td>{row.dateStr}</td>
                    <td>{row.payType}</td>
                    <td>{row.referenceMinutes != null ? `${row.referenceMinutes}분` : "—"}</td>
                    <td>{row.systemMinutes != null ? `${row.systemMinutes}분` : "—"}</td>
                    <td>{row.theoryMinutes != null ? `${row.theoryMinutes}분` : "—"}</td>
                    <td>{row.status}</td>
                    <td className="sch-payroll-debug-issue">{row.issue ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {activeTab === "raw" ? (
        <>
          <p className="sch-muted">
            DB <code>payroll_entries</code> 테이블 원본 {rawEntries.length}건 (슬롯 시간은 주간 스케줄 조인)
          </p>
          <div className="sch-payroll-debug-filters">
            <div className="sch-chip-row">
              {FILTER_OPTIONS.filter(o => o.id !== "mismatch").map(opt => (
                <button key={opt.id} type="button" className={`sch-chip${filter === opt.id ? " active" : ""}`} onClick={() => setFilter(opt.id)}>
                  {opt.label}
                </button>
              ))}
            </div>
            <select className="sch-input sch-payroll-debug-type-select" value={payTypeFilter} onChange={e => setPayTypeFilter(e.target.value)}>
              {payTypesInReport.map(t => (
                <option key={t} value={t}>{t === "all" ? "구분: 전체" : t}</option>
              ))}
            </select>
          </div>
          <div className="sch-table-wrap sch-payroll-debug-table-wrap">
            <table className="sch-table sch-payroll-debug-table">
              <thead>
                <tr>
                  <th>entry_id</th>
                  <th>날짜</th>
                  <th>기관명</th>
                  <th>구분</th>
                  <th>시작</th>
                  <th>종료</th>
                  <th>슬롯분</th>
                  <th>입력분</th>
                  <th>상태</th>
                  <th>집계</th>
                  <th>slot_id</th>
                </tr>
              </thead>
              <tbody>
                {filteredRawRows.map(row => (
                  <tr
                    key={row.entryId}
                    className={[
                      !row.includedInTotal && "sch-payroll-debug-row--excluded",
                      row.includedInTotal && "sch-payroll-debug-row--manual",
                    ].filter(Boolean).join(" ")}
                  >
                    <td className="sch-payroll-debug-id">{row.entryId?.slice(0, 8)}…</td>
                    <td>{row.dateStr}</td>
                    <td>{row.institutionName}</td>
                    <td>{row.payType}</td>
                    <td>{row.startTime}</td>
                    <td>{row.endTime}</td>
                    <td>{row.scheduledMinutes != null ? `${row.scheduledMinutes}분` : "—"}</td>
                    <td>{row.entryMinutes != null ? `${row.entryMinutes}분` : "—"}</td>
                    <td>{row.entryStatus ?? "—"}</td>
                    <td>{row.includedInTotal ? `포함 ${row.countedMinutes}분` : "제외"}</td>
                    <td className="sch-payroll-debug-id">{row.scheduleSlotId?.slice(0, 8) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sch-muted sch-payroll-debug-footnote">
            일별 집계(확정): {mapToDailyRows(systemDaily).map(r => `${r.dateStr.slice(5)} ${r.payType} ${r.minutes}`).join(" · ")}
          </p>
        </>
      ) : null}

      {activeTab === "schedule" ? (
        <>
          {weeklyPattern.length > 0 ? (
            <section className="sch-payroll-debug-section">
              <h4 className="sch-payroll-debug-section-title">주간 스케줄 패턴 (DB, 점심 12:00~12:40 포함)</h4>
              <div className="sch-table-wrap">
                <table className="sch-table sch-payroll-debug-table sch-payroll-debug-table--compact">
                  <thead>
                    <tr><th>요일</th><th>정규</th><th>방과후</th><th>합계</th></tr>
                  </thead>
                  <tbody>
                    {weeklyPattern.map(row => (
                      <tr key={row.dayOfWeek}>
                        <td>{row.dayLabel}</td>
                        <td>{row.byType.정규 ? `${row.byType.정규}분` : "—"}</td>
                        <td>{row.byType.방과후 ? `${row.byType.방과후}분` : "—"}</td>
                        <td>{row.total}분</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div className="sch-payroll-debug-filters">
            <div className="sch-chip-row">
              {FILTER_OPTIONS.filter(o => o.id !== "mismatch").map(opt => (
                <button key={opt.id} type="button" className={`sch-chip${filter === opt.id ? " active" : ""}`} onClick={() => setFilter(opt.id)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sch-table-wrap sch-payroll-debug-table-wrap">
            <table className="sch-table sch-payroll-debug-table">
              <thead>
                <tr>
                  <th>날짜</th><th>기관명</th><th>구분</th><th>시작</th><th>종료</th>
                  <th>예정분</th><th>입력분</th><th>상태</th><th>집계</th><th>제외 사유</th>
                </tr>
              </thead>
              <tbody>
                {filteredScheduleRows.map(row => (
                  <tr
                    key={`${row.dateStr}-${row.scheduleSlotId ?? row.entryId}-${row.startTime}`}
                    className={[
                      !row.includedInTotal && "sch-payroll-debug-row--excluded",
                      row.excludeReason === "미확인" && "sch-payroll-debug-row--unconfirmed",
                    ].filter(Boolean).join(" ")}
                  >
                    <td>{row.dateStr}</td>
                    <td>{row.institutionName}</td>
                    <td>{row.payType}</td>
                    <td>{row.startTime}</td>
                    <td>{row.endTime}</td>
                    <td>{row.scheduledMinutes != null ? `${row.scheduledMinutes}분` : "—"}</td>
                    <td>{row.entryMinutes != null ? `${row.entryMinutes}분` : "—"}</td>
                    <td>{row.statusLabel}</td>
                    <td>{row.includedInTotal ? `포함 ${row.countedMinutes}분` : "제외"}</td>
                    <td>{row.excludeReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {activeTab === "calc" ? (
        <>
          <section className="sch-payroll-debug-section">
            <h4 className="sch-payroll-debug-section-title">시스템 집계 계산</h4>
            <ul className="sch-payroll-debug-steps">
              {calculationSteps.map(step => (
                <li key={step.payType}>
                  <strong>{step.payType}</strong> {formatMinutes(step.total)}
                  <span className="sch-muted"> ({step.sessionCount}회)</span>
                  <div className="sch-payroll-debug-formula">{step.formula}</div>
                </li>
              ))}
              <li className="sch-payroll-debug-steps-grand">
                <strong>전체</strong> {formatMinutes(summary.totalIncluded)}
                <div className="sch-payroll-debug-formula">{summary.grandTotalFormula}</div>
              </li>
            </ul>
          </section>
          {Object.keys(summary.excludedByReason).length > 0 ? (
            <section className="sch-payroll-debug-section">
              <h4 className="sch-payroll-debug-section-title">집계 제외 요약</h4>
              <ul className="sch-payroll-debug-excluded-summary">
                {Object.entries(summary.excludedByReason).map(([reason, info]) => (
                  <li key={reason}>{reason}: {info.count}회 · 예정 {info.minutes}분</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );

  if (embedded) {
    return <div className="sch-payroll-debug sch-payroll-debug--embedded">{body}</div>;
  }

  return (
    <details className="sch-payroll-debug" open={defaultOpen}>
      <summary className="sch-payroll-debug-summary">
        급여 집계 디버그
        {teacherName ? ` · ${teacherName}` : ""}
      </summary>
      {body}
    </details>
  );
}
