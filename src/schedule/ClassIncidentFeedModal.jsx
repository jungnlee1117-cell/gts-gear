import { useEffect, useState } from "react";
import {
  CLASS_INCIDENT_PREVIEW_LIMIT,
  CLASS_INCIDENT_SQL_HINT,
  CLASS_INCIDENT_STATUS_LABEL,
  fetchClassIncidentReports,
  formatIncidentDate,
  formatIncidentWhen,
} from "./classIncidentReports.js";
import { ClassIncidentCategoryBadge } from "./ClassIncidentCategoryFields.jsx";
import { formatIncidentPreview, isSafetyIncident, sortIncidentRowsForAdmin } from "./classIncidentCategories.js";

export default function ClassIncidentFeedModal({ onClose, onViewAll }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchClassIncidentReports({
          status: "needs_review",
          limit: CLASS_INCIDENT_PREVIEW_LIMIT,
        });
        if (cancelled) return;
        setMissingTable(!!result.missingTable);
        setRows(sortIncidentRowsForAdmin(result.rows || []));
      } catch (err) {
        if (!cancelled) setError(err?.message || "특이사항을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="hub-modal-backdrop" onClick={onClose}>
      <div className="hub-modal inventory-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hub-modal__head">
          <h3 className="hub-modal__title">수업 특이사항</h3>
          <button type="button" className="hub-modal__close" onClick={onClose}>닫기</button>
        </div>
        <div className="hub-modal__body">
          {loading ? (
            <div className="hub-panel-card__empty">불러오는 중...</div>
          ) : missingTable ? (
            <div className="hub-panel-card__empty">{CLASS_INCIDENT_SQL_HINT}</div>
          ) : error ? (
            <div className="hub-panel-card__empty">{error}</div>
          ) : !rows.length ? (
            <div className="hub-panel-card__empty">확인이 필요한 특이사항이 없습니다.</div>
          ) : (
            <div className="inventory-log-list">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={`inventory-log-row${isSafetyIncident(row) ? " inventory-log-row--safety" : ""}`}
                >
                  <div className="inventory-log-row__main">
                    <div className="inventory-log-row__title">
                      <span className="inventory-log-row__name">
                        {row.teachers?.name || "선생님"}
                      </span>
                      {row.institutions?.name ? (
                        <span className="inventory-log-row__code">{row.institutions.name}</span>
                      ) : null}
                    </div>
                    <span className="sch-incident-card-badges">
                      <ClassIncidentCategoryBadge
                        category={row.incident_category}
                        subtype={row.incident_subtype}
                      />
                      <span className="sch-incident-badge sch-incident-badge--needs_review">
                        {CLASS_INCIDENT_STATUS_LABEL.needs_review}
                      </span>
                    </span>
                  </div>
                  <p className="sch-incident-preview">{formatIncidentPreview(row)}</p>
                  <div className="inventory-log-row__meta">
                    {[formatIncidentDate(row.class_date), formatIncidentWhen(row.created_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="inventory-log-modal__footer">
          <button type="button" className="hub-panel-card__view-all" onClick={onViewAll}>
            전체 보기 &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
