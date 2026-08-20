import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ClipboardList, CloudUpload, FileSpreadsheet, Users, Wallet } from "lucide-react";
import { CONTRACT_TYPES, formatMinutes, formatWon, grossToNetPay, yearMonthKey, yearMonthLastDay } from "./constants.js";
import {
  fetchPayrollEntries,
  fetchScheduleExceptions,
  fetchWeeklySchedule,
  loadPayrollDashboard,
} from "./api.js";
import PayrollDebugPanel from "./PayrollDebugPanel.jsx";
import PayrollTeacherView from "./PayrollTeacherView.jsx";
import TempTeacherPayrollDetail, { TempTeacherPayrollTableRow } from "./TempTeacherPayrollDetail.jsx";
import AdditionalPaymentRequestsAdminSection from "./AdditionalPaymentRequestsAdminSection.jsx";
import { AdminTeacherNotesSection } from "./TeacherNotesPanel.jsx";
import { groupNotesByTeacher } from "./teacherNotes.js";
import { sortInstitutionDashboardRows } from "./institutionSort.js";
import {
  expandFixedPayoutDashboardRows,
  filterInstitutionRowsForManager,
  fixedPayoutManagerSliceGross,
  fixedPayoutManagerSliceVat,
  isFixedPayoutGtsSlice,
  isFixedPayoutManagerSlice,
  isManagerFixedPayout,
  isPartnerManagerRow,
  managerFixedPayoutNet,
} from "./fixedPayoutDisplay.js";
import {
  canSeeAllInstitutions,
  canViewInstitutionRevenue,
  isScheduleRegionalManager,
  isScheduleSuperAdmin,
  resolveLockedManagerFilter,
  resolveManagerFilterIds,
} from "./managerScope.js";
import {
  expandScopedTeacherRows,
  filterTeacherAdditionalForScope,
  formatInstructorCostBreakdown,
  sumScopedAdditionalPayments,
} from "./institutionTeacherPay.js";
import {
  resolveSettlementContractType,
} from "./thresholdSplitSettlement.js";
import { filterTempTeacherRowsForScope } from "./temporaryTeachers.js";
import {
  downloadPayrollTaxReport,
  payrollTaxSnapshotRows,
  savePayrollTaxSnapshot,
  uploadPayrollTaxReportToDrive,
} from "./payrollTaxReport.js";

const MANAGER_FILTER_OPTIONS = [
  { id: "all", label: "전체" },
  { id: "yang", label: "양의인(레이첼)" },
  { id: "oh", label: "오정석(마이크)" },
  { id: "hq", label: "본사" },
];

function contractTypeLabel(institution) {
  const key = resolveSettlementContractType(institution);
  return CONTRACT_TYPES[key] ?? key;
}

function institutionInstructorCostAmount(row, me) {
  if (isFixedPayoutManagerSlice(row)) return 0;
  const type = resolveSettlementContractType(row.institution);
  if (type === "manager_personal") return 0;
  if (type === "partner_billing") {
    const amt = Number(row.partner_invoice_amount) || 0;
    if (isPartnerManagerRow(row, me)) return -amt;
    return amt;
  }
  return Number(row.instructor_cost) || 0;
}

function sumInstitutionRows(rows, me) {
  const superAdmin = isScheduleSuperAdmin(me);
  const t = {
    revenue: 0,
    vat: 0,
    income_tax: 0,
    instructor_cost: 0,
    net_profit: 0,
    manager_share: 0,
    gts_share: 0,
  };
  for (const row of rows) {
    const type = resolveSettlementContractType(row.institution);
    const partner = type === "partner_billing";
    const managerSlice = isFixedPayoutManagerSlice(row);

    if (managerSlice) {
      t.revenue += fixedPayoutManagerSliceGross(row);
      t.vat += fixedPayoutManagerSliceVat(row);
      t.manager_share += Number(row.manager_payout_net ?? row.manager_share)
        || managerFixedPayoutNet(row.fixed_payout);
      continue;
    }

    t.revenue += Number(row.revenue) || 0;
    t.instructor_cost += institutionInstructorCostAmount(row, me);

    if (partner) {
      t.manager_share += Number(row.manager_share) || 0;
      continue;
    }

    t.vat += Number(row.vat) || 0;
    t.net_profit += Number(row.net_profit) || 0;
    t.manager_share += Number(row.manager_share) || 0;
    if (superAdmin || !isFixedPayoutGtsSlice(row)) {
      t.gts_share += Number(row.gts_share) || 0;
    }
    if (type !== "manager_personal" && type !== "manager_fixed_payout" && type !== "manager_threshold_split") {
      t.income_tax += Number(row.income_tax) || 0;
    }
  }
  return t;
}

function InstitutionTotalsFoot({ rows, managerFilter, institutionSearch, me }) {
  const totals = useMemo(() => sumInstitutionRows(rows, me), [rows, me]);
  const managerLabel = MANAGER_FILTER_OPTIONS.find(o => o.id === managerFilter)?.label ?? "전체";
  const searchLabel = institutionSearch.trim();

  return (
    <tfoot className="sch-admin-table-foot">
      <tr>
        <td>
          <strong>합계</strong>
          <span className="sch-muted"> · {rows.length}개 원</span>
          {managerFilter !== "all" ? (
            <span className="sch-admin-foot-meta"> · {managerLabel}</span>
          ) : null}
          {searchLabel ? (
            <span className="sch-admin-foot-meta"> · &quot;{searchLabel}&quot;</span>
          ) : null}
        </td>
        <td/>
        <td/>
        <td className="sch-td-num">{formatWon(totals.revenue)}</td>
        <td className="sch-td-num">{formatWon(totals.vat)}</td>
        <td className="sch-td-num">{formatWon(totals.income_tax)}</td>
        <td className="sch-td-num">{formatWon(totals.instructor_cost)}</td>
        <td className="sch-td-num">{formatWon(totals.net_profit)}</td>
        <td className="sch-td-num">
          {isScheduleSuperAdmin(me)
            ? `${formatWon(totals.manager_share)} / ${formatWon(totals.gts_share)}`
            : formatWon(totals.manager_share)}
        </td>
      </tr>
    </tfoot>
  );
}

function InstitutionVatCell({ row }) {
  if (isFixedPayoutManagerSlice(row)) {
    return formatWon(fixedPayoutManagerSliceVat(row));
  }
  const type = resolveSettlementContractType(row.institution);
  if (type === "partner_billing") return "—";
  return formatWon(row.vat);
}

function InstitutionNetProfitCell({ row }) {
  if (isFixedPayoutManagerSlice(row)) return "—";
  const type = resolveSettlementContractType(row.institution);
  if (type === "partner_billing") return "—";
  if (type === "manager_threshold_split") {
    const afterVat = Number(row.revenue_after_vat) || 0;
    if (afterVat <= 1_000_000) return "—";
    return formatWon(row.net_profit);
  }
  return formatWon(row.net_profit);
}

function InstitutionCostCell({ row, me }) {
  if (isFixedPayoutManagerSlice(row)) return "—";
  const type = resolveSettlementContractType(row.institution);
  if (type === "manager_personal") return "—";
  const superAdmin = isScheduleSuperAdmin(me);
  const breakdownLines = formatInstructorCostBreakdown(row.instructorCostBreakdown, { superAdmin });

  if (type === "partner_billing") {
    const amt = Number(row.partner_invoice_amount) || 0;
    if (amt <= 0) return "—";
    if (isPartnerManagerRow(row, me)) {
      return (
        <div className="sch-admin-cell-num">
          <span className="sch-amount--payable">-{formatWon(amt)}</span>
          <p className="sch-admin-cell-hint">GTS에 지급</p>
        </div>
      );
    }
    return formatWon(amt);
  }

  if (type === "manager_threshold_split") {
    const cost = Number(row.instructor_cost) || 0;
    if (cost <= 0) return "—";
    return (
      <div className="sch-admin-cell-num">
        <div>{formatWon(cost)}</div>
        <p className="sch-admin-cell-hint">외부 강사 인건비</p>
      </div>
    );
  }

  if (breakdownLines.length > 0) {
    return (
      <div className="sch-admin-cell-num">
        <div>{formatWon(row.instructor_cost)}</div>
        {breakdownLines.map(line => (
          <p key={line} className="sch-admin-cell-hint">{line}</p>
        ))}
      </div>
    );
  }

  if (type === "manager_fixed_payout") {
    return `고정 ${formatWon(row.fixed_payout)}`;
  }
  return formatWon(row.instructor_cost);
}

function InstitutionIncomeTaxCell({ row }) {
  if (isFixedPayoutManagerSlice(row)) return "—";
  const type = resolveSettlementContractType(row.institution);
  if (
    type === "manager_personal"
    || type === "manager_fixed_payout"
    || type === "manager_threshold_split"
    || type === "partner_billing"
  ) {
    return "—";
  }
  return formatWon(row.income_tax);
}

function InstitutionShareCell({ row, me }) {
  if (isFixedPayoutManagerSlice(row)) {
    const net = Number(row.manager_payout_net ?? row.manager_share)
      || managerFixedPayoutNet(row.fixed_payout);
    return formatWon(net);
  }
  const type = resolveSettlementContractType(row.institution);
  if (type === "partner_billing") {
    const share = Number(row.manager_share) || 0;
    if (share === 0) return "—";
    if (isScheduleSuperAdmin(me)) {
      return `${formatWon(share)} / —`;
    }
    return formatWon(share);
  }
  if (type === "manager_personal") {
    return isScheduleSuperAdmin(me)
      ? `${formatWon(row.manager_share)} / —`
      : formatWon(row.manager_share);
  }
  if (isFixedPayoutGtsSlice(row) || type === "manager_fixed_payout") {
    return isScheduleSuperAdmin(me) ? `— / ${formatWon(row.gts_share)}` : "—";
  }
  if (type === "manager_threshold_split") {
    const afterVat = Number(row.revenue_after_vat) || 0;
    return (
      <div className="sch-admin-cell-num">
        {isScheduleSuperAdmin(me) ? (
          <div>{formatWon(row.manager_share)} / {formatWon(row.gts_share)}</div>
        ) : (
          <div>{formatWon(row.manager_share)}</div>
        )}
        {afterVat <= 1_000_000 ? (
          <p className="sch-admin-cell-hint">100만 이하 전액 담당자</p>
        ) : (
          <p className="sch-admin-cell-hint">100만 + 초과분 5:5</p>
        )}
      </div>
    );
  }
  if (isScheduleSuperAdmin(me)) {
    return `${formatWon(row.manager_share)} / ${formatWon(row.gts_share)}`;
  }
  return formatWon(row.manager_share);
}

function InstitutionRevenueInputCell({ row }) {
  if (isFixedPayoutManagerSlice(row)) {
    const gross = fixedPayoutManagerSliceGross(row);
    if (gross > 0) {
      return <span className="sch-admin-status-ok">{formatWon(gross)}</span>;
    }
    return <span className="sch-admin-status-warn">미입력</span>;
  }
  if (row.institution.contract_type === "partner_billing") return "—";
  if (row.hasRevenue) {
    return <span className="sch-admin-status-ok">{formatWon(row.revenue)}</span>;
  }
  return <span className="sch-admin-status-warn">미입력</span>;
}

export default function PayrollAdminView({ me, onBack, onOpenInstitution, onOpenSettlement, onOpenPayRates, onOpenTemporaryTeachers }) {
  const superAdmin = isScheduleSuperAdmin(me);
  const showTeacherTab = superAdmin || isScheduleRegionalManager(me);

  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => (showTeacherTab ? "teachers" : "institutions"));
  const [debugTeacher, setDebugTeacher] = useState(null);
  const [debugData, setDebugData] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [managerFilter, setManagerFilter] = useState("all");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [viewingTeacher, setViewingTeacher] = useState(null);
  const [viewingTempTeacher, setViewingTempTeacher] = useState(null);
  const [requestStats, setRequestStats] = useState({
    total: 0,
    pendingTotal: 0,
    pendingExpense: 0,
    pendingAllowance: 0,
  });
  const [taxReportBusy, setTaxReportBusy] = useState("");
  const lastTaxSnapshotSignature = useRef("");

  const handleRequestStatsChange = useCallback((stats) => {
    setRequestStats(stats || {
      total: 0,
      pendingTotal: 0,
      pendingExpense: 0,
      pendingAllowance: 0,
    });
  }, []);

  const scrollToSection = useCallback((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await loadPayrollDashboard(yearMonth);
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!superAdmin || !data?.teacherRows?.length) return;
    const rows = payrollTaxSnapshotRows(data);
    const signature = `${yearMonth}:${rows.map((row) => `${row.teacher_id}:${row.gross_amount}`).join("|")}`;
    if (signature === lastTaxSnapshotSignature.current) return;
    lastTaxSnapshotSignature.current = signature;
    savePayrollTaxSnapshot(yearMonth, data).catch((error) => {
      lastTaxSnapshotSignature.current = "";
      console.warn("[payroll-tax-report] snapshot sync failed", error?.message || error);
    });
  }, [data, superAdmin, yearMonth]);

  const handleTaxReportDownload = useCallback(async () => {
    if (!data || taxReportBusy) return;
    setTaxReportBusy("download");
    try {
      const result = await downloadPayrollTaxReport(yearMonth, data);
      if (result.missing_resident_ids?.length) {
        alert(`엑셀은 생성했지만 주민등록번호 미등록 선생님이 있습니다.\n${result.missing_resident_ids.join(", ")}`);
      }
    } catch (error) {
      alert(error?.message || "세무 엑셀을 생성하지 못했습니다.");
    } finally {
      setTaxReportBusy("");
    }
  }, [data, taxReportBusy, yearMonth]);

  const handleTaxReportDriveUpload = useCallback(async () => {
    if (!data || taxReportBusy) return;
    if (!confirm(`${yearMonth} 사업소득 엑셀을 GTS Google Drive 폴더에 저장하시겠습니까?`)) return;
    setTaxReportBusy("drive");
    try {
      const result = await uploadPayrollTaxReportToDrive(yearMonth, data);
      alert(`${result.filename} 파일을 Google Drive에 저장했습니다.`);
      if (result.web_view_link) window.open(result.web_view_link, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error?.message || "세무 엑셀을 Google Drive에 저장하지 못했습니다.");
    } finally {
      setTaxReportBusy("");
    }
  }, [data, taxReportBusy, yearMonth]);

  useEffect(() => {
    setRequestStats({
      total: 0,
      pendingTotal: 0,
      pendingExpense: 0,
      pendingAllowance: 0,
    });
  }, [yearMonth]);

  const openPayrollDebug = useCallback(async (teacher) => {
    setDebugTeacher(teacher);
    setDebugData(null);
    setDebugLoading(true);
    try {
      const [y, m] = yearMonth.split("-").map(Number);
      const monthStart = `${yearMonth}-01`;
      const monthEnd = yearMonthLastDay(yearMonth);
      const [weeklySlots, entries, exceptions] = await Promise.all([
        fetchWeeklySchedule(null, teacher.id),
        fetchPayrollEntries({ teacherId: teacher.id, yearMonth }),
        fetchScheduleExceptions(null, monthStart, monthEnd),
      ]);
      setDebugData({ weeklySlots, entries, exceptions, year: y, month: m - 1 });
    } catch (e) {
      console.error(e);
      alert("집계 디버그 데이터를 불러오지 못했습니다.");
      setDebugTeacher(null);
    } finally {
      setDebugLoading(false);
    }
  }, [yearMonth]);

  const closePayrollDebug = () => {
    setDebugTeacher(null);
    setDebugData(null);
  };

  const closeTeacherInspect = useCallback(() => {
    setViewingTeacher(null);
    load();
  }, [load]);

  const noteGroups = useMemo(
    () => (data?.teacherNotes ? groupNotesByTeacher(data.teacherNotes) : []),
    [data?.teacherNotes],
  );

  const managerFilterIds = useMemo(
    () => ({
      ...resolveManagerFilterIds(data?.managerMap),
      selfId: me?.id,
    }),
    [data?.managerMap, me?.id],
  );

  const lockedManagerFilter = useMemo(
    () => resolveLockedManagerFilter(me, data?.managerMap),
    [me, data?.managerMap],
  );

  const effectiveManagerFilter = lockedManagerFilter ?? managerFilter;

  const managedInstitutionIds = useMemo(
    () => new Set(
      (data?.institutions || [])
        .filter(i => i.manager_id === me?.id)
        .map(i => i.id),
    ),
    [data?.institutions, me?.id],
  );

  const scopedTeacherRows = useMemo(() => {
    if (isScheduleSuperAdmin(me)) return data?.teacherRows ?? [];
    return expandScopedTeacherRows({
      teacherRows: data?.teacherRows ?? [],
      institutionIds: managedInstitutionIds,
      entries: data?.entries ?? [],
      institutions: data?.institutions ?? [],
    });
  }, [me, data?.teacherRows, data?.entries, data?.institutions, managedInstitutionIds]);

  const displayTeacherRows = useMemo(() => {
    if (isScheduleSuperAdmin(me)) return scopedTeacherRows;
    return scopedTeacherRows.map(row => {
      const scopedAdditional = filterTeacherAdditionalForScope(row.additionalPayments);
      const additionalTotal = sumScopedAdditionalPayments(scopedAdditional);
      const payDelta = (row.additionalTotal || 0) - additionalTotal;
      return {
        ...row,
        additionalPayments: scopedAdditional,
        additionalTotal,
        estimatedPay: Math.max(0, (row.estimatedPay || 0) - payDelta),
      };
    });
  }, [me, scopedTeacherRows, data?.institutions, managedInstitutionIds]);

  const scopedTempTeacherRows = useMemo(
    () => filterTempTeacherRowsForScope(data?.tempTeacherRows ?? [], me, data?.institutions ?? []),
    [data?.tempTeacherRows, data?.institutions, me],
  );

  const missingInputCount = useMemo(
    () => scopedTeacherRows.filter(r => r.inputMissing).length
      + scopedTempTeacherRows.filter(r => r.inputMissing).length,
    [scopedTeacherRows, scopedTempTeacherRows],
  );

  const filteredCanonicalRows = useMemo(() => {
    const rows = data?.institutionRows || [];
    const q = institutionSearch.trim().toLowerCase();
    const filtered = rows.filter(row => {
      if (!filterInstitutionRowsForManager([row], effectiveManagerFilter, managerFilterIds).length) {
        return false;
      }
      if (q && !row.institution.name.toLowerCase().includes(q)) return false;
      return true;
    });
    return filtered;
  }, [data?.institutionRows, institutionSearch, effectiveManagerFilter, managerFilterIds]);

  const missingRevenueCount = useMemo(
    () => filteredCanonicalRows.filter(r => !r.hasRevenue).length,
    [filteredCanonicalRows],
  );

  const displayInstitutionRows = useMemo(() => {
    const expanded = expandFixedPayoutDashboardRows(filteredCanonicalRows, effectiveManagerFilter);
    return sortInstitutionDashboardRows(expanded, data?.managerMap ?? {}, {
      groupByManager: effectiveManagerFilter === "all",
    });
  }, [filteredCanonicalRows, data?.managerMap, effectiveManagerFilter]);

  const institutionFilterActive = effectiveManagerFilter !== "all" || institutionSearch.trim().length > 0;

  return (
    <div className="sch-view sch-payroll-admin-view">
      {!viewingTeacher && !viewingTempTeacher ? (
        <>
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">급여/정산 · 대시보드</h2>
        <div className="sch-header-actions">
          {superAdmin ? (
            <>
              <button
                type="button"
                className="sch-btn sch-btn--ghost"
                disabled={Boolean(taxReportBusy) || !data}
                onClick={handleTaxReportDownload}
              >
                <FileSpreadsheet size={16}/>
                {taxReportBusy === "download" ? "생성 중..." : "세무 엑셀"}
              </button>
              <button
                type="button"
                className="sch-btn sch-btn--ghost"
                disabled={Boolean(taxReportBusy) || !data}
                onClick={handleTaxReportDriveUpload}
              >
                <CloudUpload size={16}/>
                {taxReportBusy === "drive" ? "저장 중..." : "구글 드라이브 저장"}
              </button>
            </>
          ) : null}
          <button type="button" className="sch-btn sch-btn--ghost" onClick={onOpenTemporaryTeachers}>
            임시 선생님
          </button>
          {isScheduleSuperAdmin(me) ? (
            <button type="button" className="sch-btn sch-btn--ghost" onClick={onOpenPayRates}>
              강사 단가 관리
            </button>
          ) : null}
          <button type="button" className="sch-btn sch-btn--ghost" onClick={onOpenSettlement}>
            월별 정산 →
          </button>
        </div>
      </header>

      <div className="sch-toolbar">
        <input type="month" className="sch-input" value={yearMonth} onChange={e => setYearMonth(e.target.value)}/>
      </div>

      {showTeacherTab ? (
        <div className="sch-admin-dash-tabs" role="tablist" aria-label="대시보드 구분">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "teachers"}
            className={`sch-admin-dash-tab${activeTab === "teachers" ? " sch-admin-dash-tab--active" : ""}`}
            onClick={() => setActiveTab("teachers")}
          >
            선생님
            {missingInputCount > 0 ? (
              <span className="sch-admin-dash-tab-badge">{missingInputCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "institutions"}
            className={`sch-admin-dash-tab${activeTab === "institutions" ? " sch-admin-dash-tab--active" : ""}`}
            onClick={() => setActiveTab("institutions")}
          >
            기관
            {missingRevenueCount > 0 ? (
              <span className="sch-admin-dash-tab-badge">{missingRevenueCount}</span>
            ) : null}
          </button>
        </div>
      ) : null}
        </>
      ) : null}

      {viewingTempTeacher ? (
        <TempTeacherPayrollDetail
          row={viewingTempTeacher}
          yearMonth={yearMonth}
          onBack={() => setViewingTempTeacher(null)}
        />
      ) : viewingTeacher ? (
        <PayrollTeacherView
          me={me}
          subjectTeacher={viewingTeacher}
          initialYearMonth={yearMonth}
          adminInspectMode
          onBack={closeTeacherInspect}
        />
      ) : loading || !data ? <p className="sch-muted">불러오는 중...</p> : (
        <>
          {showTeacherTab && activeTab === "teachers" ? (
            <div className="sch-admin-dash-panel" role="tabpanel">
              {superAdmin ? (
                <div className="sch-admin-attention" aria-label="오늘 확인할 것">
                  <div className="sch-admin-attention-head">
                    <ClipboardList size={16} aria-hidden />
                    <strong>오늘 확인할 것</strong>
                  </div>
                  <div className="sch-admin-attention-cards">
                    <button
                      type="button"
                      className={`sch-admin-attention-card${requestStats.pendingExpense > 0 ? " sch-admin-attention-card--alert" : ""}`}
                      onClick={() => scrollToSection("sch-admin-section-requests")}
                    >
                      <span className="sch-admin-attention-card-icon" aria-hidden>
                        <Wallet size={16} />
                      </span>
                      <span className="sch-admin-attention-card-body">
                        <span className="sch-admin-attention-card-label">비용 신청 대기</span>
                        <span className="sch-admin-attention-card-value">
                          <strong>{requestStats.pendingExpense}</strong>건
                        </span>
                      </span>
                      {requestStats.pendingExpense > 0 ? (
                        <span className="sch-admin-section-alert-dot" aria-hidden />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={`sch-admin-attention-card${requestStats.pendingAllowance > 0 ? " sch-admin-attention-card--alert" : ""}`}
                      onClick={() => scrollToSection("sch-admin-section-requests")}
                    >
                      <span className="sch-admin-attention-card-icon" aria-hidden>
                        <AlertCircle size={16} />
                      </span>
                      <span className="sch-admin-attention-card-body">
                        <span className="sch-admin-attention-card-label">추가수당 신청 대기</span>
                        <span className="sch-admin-attention-card-value">
                          <strong>{requestStats.pendingAllowance}</strong>건
                        </span>
                      </span>
                      {requestStats.pendingAllowance > 0 ? (
                        <span className="sch-admin-section-alert-dot" aria-hidden />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={`sch-admin-attention-card${missingInputCount > 0 ? " sch-admin-attention-card--warn" : ""}`}
                      onClick={() => scrollToSection("sch-admin-section-teachers")}
                    >
                      <span className="sch-admin-attention-card-icon" aria-hidden>
                        <Users size={16} />
                      </span>
                      <span className="sch-admin-attention-card-body">
                        <span className="sch-admin-attention-card-label">입력 누락 강사</span>
                        <span className="sch-admin-attention-card-value">
                          <strong>{missingInputCount}</strong>명
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}

              {(() => {
                const teacherSection = (
                  <section
                    key="teachers"
                    id="sch-admin-section-teachers"
                    className={[
                      "sch-admin-dash-section",
                      "sch-admin-dash-section--teachers",
                      missingInputCount > 0 ? "sch-admin-dash-section--warn" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <div className="sch-admin-section-head">
                      <div className="sch-admin-section-head-main">
                        <span className="sch-admin-section-icon sch-admin-section-icon--users" aria-hidden>
                          <Users size={18} />
                        </span>
                        <div>
                          <h3 className="sch-admin-dash-section-title">
                            강사별 입력 현황
                            {missingInputCount > 0 ? (
                              <span className="sch-admin-section-alert-dot" aria-hidden />
                            ) : null}
                          </h3>
                          <p className="sch-muted sch-admin-dash-section-desc">
                            미확인 일수가 있거나 이번 달 입력 이력이 없는 강사는 강조 표시됩니다.
                            {scopedTempTeacherRows.length > 0
                              ? ` 이번 달 근무 임시 선생님 ${scopedTempTeacherRows.length}명이 함께 표시됩니다.`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="sch-admin-section-badges">
                        {missingInputCount > 0 ? (
                          <span className="sch-admin-count-badge sch-admin-count-badge--danger">
                            입력 누락 {missingInputCount}명
                          </span>
                        ) : (
                          <span className="sch-admin-count-badge sch-admin-count-badge--ok">입력 완료</span>
                        )}
                      </div>
                    </div>
                    <div className="sch-table-wrap sch-admin-table-wrap">
                      <table className="sch-table sch-admin-table sch-admin-table--teachers">
                        <thead>
                          <tr>
                            <th>강사</th>
                            <th className="sch-th-num">정규</th>
                            <th className="sch-th-num">방과후</th>
                            <th className="sch-th-num">어린이집</th>
                            <th className="sch-th-num">가정방문</th>
                            <th className="sch-th-num">센터</th>
                            <th className="sch-th-num">센터보조</th>
                            <th className="sch-th-num">예상 급여</th>
                            <th className="sch-th-num">실수령액 (3.3% 제외)</th>
                            <th className="sch-th-num">미확인 일수</th>
                            {superAdmin ? <th className="sch-th-action">디버그</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {displayTeacherRows.map(row => {
                            const alertRow = row.unconfirmedDays > 0 || row.inputMissing;
                            return (
                            <tr
                              key={row.teacher.id}
                              className={alertRow ? "sch-admin-row--alert" : ""}
                            >
                              <td className="sch-td-name">
                                <button
                                  type="button"
                                  className="sch-admin-teacher-link"
                                  onClick={() => setViewingTeacher(row.teacher)}
                                >
                                  <strong>{row.teacher.name}</strong>
                                </button>
                                {alertRow ? (
                                  <span className="sch-admin-row-alert-label">입력 누락</span>
                                ) : null}
                              </td>
                              <td className="sch-td-num sch-td-num--em">{formatMinutes(row.byType.정규 || 0)}</td>
                              <td className="sch-td-num sch-td-num--em">{formatMinutes(row.byType.방과후 || 0)}</td>
                              <td className="sch-td-num sch-td-num--em">{formatMinutes(row.byType.어린이집 || 0)}</td>
                              <td className="sch-td-num sch-td-num--em">{formatMinutes(row.byType.가정방문 || 0)}</td>
                              <td className="sch-td-num sch-td-num--em">{formatMinutes(row.byType.센터 || 0)}</td>
                              <td className="sch-td-num sch-td-num--em">{formatMinutes(row.byType.센터보조 || 0)}</td>
                              <td className="sch-td-num sch-td-money">{formatWon(row.estimatedPay)}</td>
                              <td className="sch-td-num sch-pay-net-cell">
                                <div className="sch-admin-cell-num sch-td-money">
                                  {formatWon(grossToNetPay(row.estimatedPay))}
                                </div>
                                {row.additionalTotal > 0 ? (
                                  <div className="sch-admin-cell-hint">
                                    {(row.additionalPayments || []).map(p => (
                                      <p key={p.id}>{p.reason} <strong>+{Number(p.amount).toLocaleString("ko-KR")}원</strong></p>
                                    ))}
                                  </div>
                                ) : null}
                              </td>
                              <td className="sch-td-num">
                                {row.unconfirmedDays > 0 ? (
                                  <span className="sch-admin-status-badge sch-admin-status-badge--warn">{row.unconfirmedDays}일</span>
                                ) : (
                                  <span className="sch-admin-status-badge sch-admin-status-badge--ok">완료</span>
                                )}
                              </td>
                              {superAdmin ? (
                                <td className="sch-td-action">
                                  <button
                                    type="button"
                                    className="sch-btn sch-btn--ghost sch-btn--sm"
                                    onClick={() => openPayrollDebug(row.teacher)}
                                  >
                                    집계 디버그
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                            );
                          })}
                          {scopedTempTeacherRows.map(row => (
                            <TempTeacherPayrollTableRow
                              key={row.teacher.id}
                              row={row}
                              onSelect={setViewingTempTeacher}
                              superAdmin={superAdmin}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );

                const requestSection = superAdmin ? (
                  <AdditionalPaymentRequestsAdminSection
                    key="requests"
                    yearMonth={yearMonth}
                    reviewerId={me.id}
                    onSaved={load}
                    onStatsChange={handleRequestStatsChange}
                    sectionId="sch-admin-section-requests"
                  />
                ) : null;

                const notesSection = (
                  <AdminTeacherNotesSection
                    key="notes"
                    noteGroups={noteGroups}
                    defaultCollapsed
                    sectionId="sch-admin-section-notes"
                  />
                );

                const ordered = requestStats.pendingTotal > 0
                  ? [requestSection, teacherSection, notesSection]
                  : [teacherSection, requestSection, notesSection];

                return ordered.filter(Boolean);
              })()}
            </div>
          ) : (
            <div className="sch-admin-dash-panel" role="tabpanel">
              <section className="sch-admin-dash-section">
                <h3 className="sch-admin-dash-section-title">원별 정산 현황</h3>
                <p className="sch-muted sch-admin-dash-section-desc">
                  이번 달 매출·회당 횟수 미입력 원은 강조 표시됩니다. 담당자/GTS는 계약유형에 따라 계산됩니다.
                </p>
                <div className="sch-toolbar sch-toolbar--inst-dash">
                  {canSeeAllInstitutions(me) ? (
                    <label className="sch-field sch-field--inline">
                      <span>담당자</span>
                      <select
                        className="sch-select"
                        value={effectiveManagerFilter}
                        onChange={e => setManagerFilter(e.target.value)}
                      >
                        {MANAGER_FILTER_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="sch-muted sch-toolbar-hint">
                      담당 원만 표시됩니다
                      {lockedManagerFilter === "yang" ? " (양의인)" : lockedManagerFilter === "oh" ? " (오정석)" : ""}
                    </p>
                  )}
                  <label className="sch-field sch-field--inline sch-field--grow">
                    <span>원 이름</span>
                    <input
                      type="search"
                      className="sch-input"
                      placeholder="예: 수지"
                      value={institutionSearch}
                      onChange={e => setInstitutionSearch(e.target.value)}
                    />
                  </label>
                  {institutionFilterActive ? (
                    <p className="sch-muted sch-toolbar-hint">
                      {displayInstitutionRows.length}행 · {filteredCanonicalRows.length} / {data.institutionRows.length}개 원
                    </p>
                  ) : null}
                </div>
                <div className="sch-table-wrap sch-admin-table-wrap">
                  <table className="sch-table sch-admin-table sch-admin-table--institutions">
                    <thead>
                      <tr>
                        <th>원</th>
                        <th>담당자</th>
                        <th>계약유형</th>
                        <th className="sch-th-num">매출 입력</th>
                        <th className="sch-th-num">부가세</th>
                        <th className="sch-th-num">종합소득세</th>
                        <th className="sch-th-num">강사료 차감</th>
                        <th className="sch-th-num">순이익</th>
                        <th className="sch-th-num">
                          {isScheduleSuperAdmin(me) ? "담당자 / GTS" : "담당자"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayInstitutionRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="sch-muted">
                            조건에 맞는 원이 없습니다.
                          </td>
                        </tr>
                      ) : displayInstitutionRows.map(row => {
                        const mgrId = row.displayManagerId !== undefined
                          ? row.displayManagerId
                          : row.institution.manager_id;
                        const manager = data.managerMap[mgrId];
                        const settlementType = resolveSettlementContractType(row.institution);
                        const partner = settlementType === "partner_billing";
                        const thresholdSplit = settlementType === "manager_threshold_split";
                        const managerSlice = isFixedPayoutManagerSlice(row);
                        const showRevenueAlert = !row.hasRevenue && !partner && !managerSlice;
                        return (
                          <tr
                            key={row.displayKey ?? row.institution.id}
                            className={showRevenueAlert ? "sch-admin-row--alert" : ""}
                          >
                            <td>
                              <button
                                type="button"
                                className="sch-link-btn"
                                onClick={() => onOpenInstitution(row.institution.id)}
                              >
                                {row.institution.name}
                              </button>
                            </td>
                            <td>{manager?.name || "—"}</td>
                            <td>{contractTypeLabel(row.institution)}</td>
                            <td className="sch-td-num"><InstitutionRevenueInputCell row={row}/></td>
                            <td className="sch-td-num"><InstitutionVatCell row={row}/></td>
                            <td className="sch-td-num"><InstitutionIncomeTaxCell row={row}/></td>
                            <td className="sch-td-num"><InstitutionCostCell row={row} me={me}/></td>
                            <td className="sch-td-num"><InstitutionNetProfitCell row={row}/></td>
                            <td className="sch-td-num"><InstitutionShareCell row={row} me={me}/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {filteredCanonicalRows.length > 0 ? (
                      <InstitutionTotalsFoot
                        rows={displayInstitutionRows}
                        managerFilter={effectiveManagerFilter}
                        institutionSearch={institutionSearch}
                        me={me}
                      />
                    ) : null}
                  </table>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {superAdmin && debugTeacher ? (
        <div className="sch-modal-overlay" onClick={closePayrollDebug}>
          <div
            className="sch-modal sch-modal--wide sch-payroll-debug-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="sch-payroll-debug-modal-header">
              <h3>급여 집계 디버그 · {debugTeacher.name}</h3>
              <button type="button" className="sch-btn sch-btn--ghost" onClick={closePayrollDebug}>
                닫기
              </button>
            </div>
            {debugLoading || !debugData ? (
              <p className="sch-muted">불러오는 중...</p>
            ) : (
              <PayrollDebugPanel
                weeklySlots={debugData.weeklySlots}
                entries={debugData.entries}
                exceptions={debugData.exceptions}
                year={debugData.year}
                month={debugData.month}
                teacherName={debugTeacher.name}
                embedded
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
