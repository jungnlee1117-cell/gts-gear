import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, MessageSquareWarning } from "lucide-react";
import {
  CLASS_INCIDENT_SQL_HINT,
  CLASS_INCIDENT_STATUS,
  fetchClassIncidentReports,
  formatIncidentDate,
} from "./classIncidentReports.js";
import { ClassIncidentStatusBadge } from "./ClassIncidentSlotForm.jsx";
import { ClassIncidentCategoryBadge } from "./ClassIncidentCategoryFields.jsx";
import {
  formatIncidentPreview,
  isSafetyIncident,
  sortIncidentRowsForAdmin,
} from "./classIncidentCategories.js";

export default function ClassIncidentAdminSection({
  yearMonth,
  onOpenAll,
  defaultCollapsed = true,
  sectionId = "sch-admin-section-incidents",
  onStatsChange,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [rows, setRows] = useState([]);
  const [missingTable, setMissingTable] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchClassIncidentReports({ yearMonth, limit: 200 });
      setMissingTable(!!result.missingTable);
      setRows(result.rows || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === CLASS_INCIDENT_STATUS.needs_review).length,
    [rows],
  );
  const pendingSafetyCount = useMemo(
    () => rows.filter((r) => r.status === CLASS_INCIDENT_STATUS.needs_review && isSafetyIncident(r)).length,
    [rows],
  );
  const previewRows = useMemo(
    () => sortIncidentRowsForAdmin(rows).slice(0, 12),
    [rows],
  );

  const byTeacherId = useMemo(() => {
    const map = {};
    for (const row of rows) {
      const id = row.teacher_id;
      if (!id) continue;
      if (!map[id]) map[id] = { total: 0, pending: 0 };
      map[id].total += 1;
      if (row.status === CLASS_INCIDENT_STATUS.needs_review) map[id].pending += 1;
    }
    return map;
  }, [rows]);

  useEffect(() => {
    onStatsChange?.({
      pendingCount,
      total: rows.length,
      byTeacherId,
      missingTable,
    });
  }, [pendingCount, rows.length, byTeacherId, missingTable, onStatsChange]);

  return (
    <section
      id={sectionId}
      className="sch-admin-dash-section sch-admin-dash-section--notes"
    >
      <button
        type="button"
        className="sch-admin-section-toggle"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <div className="sch-admin-section-head-main">
          <span className="sch-admin-section-icon sch-admin-section-icon--notes" aria-hidden>
            <MessageSquareWarning size={18} />
          </span>
          <div className="sch-admin-section-toggle-text">
            <h3 className="sch-admin-dash-section-title">수업 특이사항</h3>
            <p className="sch-muted sch-admin-dash-section-desc">
              이번 달 선생님이 남긴 보고 · 확인 필요 {pendingCount}건
              {pendingSafetyCount > 0 ? ` · 안전사고 ${pendingSafetyCount}건` : ""}
            </p>
          </div>
        </div>
        <div className="sch-admin-section-badges">
          <span className="sch-admin-count-badge">{rows.length}건</span>
          {pendingSafetyCount > 0 ? (
            <span className="sch-incident-cat-badge sch-incident-cat-badge--safety">안전사고 {pendingSafetyCount}</span>
          ) : pendingCount > 0 ? (
            <span className="sch-admin-section-alert-dot" aria-hidden />
          ) : null}
          <span className={`sch-admin-section-chevron${collapsed ? "" : " sch-admin-section-chevron--open"}`}>
            <ChevronDown size={18} aria-hidden />
          </span>
        </div>
      </button>

      {!collapsed ? (
        <div className="sch-incident-admin-body">
          {loading ? (
            <p className="sch-muted">불러오는 중...</p>
          ) : missingTable ? (
            <p className="sch-muted">{CLASS_INCIDENT_SQL_HINT}</p>
          ) : !rows.length ? (
            <p className="sch-muted">이번 달 특이사항이 없습니다.</p>
          ) : (
            <ul className="sch-incident-admin-list">
              {previewRows.map((row) => (
                <li
                  key={row.id}
                  className={`sch-incident-admin-row${isSafetyIncident(row) ? " sch-incident-admin-row--safety" : ""}`}
                >
                  <ClassIncidentStatusBadge status={row.status} />
                  <ClassIncidentCategoryBadge
                    category={row.incident_category}
                    subtype={row.incident_subtype}
                  />
                  <span className="sch-incident-admin-date">{formatIncidentDate(row.class_date)}</span>
                  <span className="sch-incident-admin-teacher">{row.teachers?.name || "선생님"}</span>
                  <span className="sch-incident-admin-inst">{row.institutions?.name || "원 미지정"}</span>
                  <span className="sch-incident-admin-body">{formatIncidentPreview(row)}</span>
                </li>
              ))}
            </ul>
          )}
          {onOpenAll ? (
            <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" onClick={onOpenAll}>
              월별 모아보기 →
            </button>
          ) : null}
        </div>
      ) : (
        <p className="sch-muted sch-admin-section-collapsed-hint">
          접혀 있습니다. 클릭하면 이번 달 특이사항을 볼 수 있습니다.
        </p>
      )}
    </section>
  );
}
