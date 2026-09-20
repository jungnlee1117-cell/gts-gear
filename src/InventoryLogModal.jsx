import { useEffect, useState } from "react";
import {
  INVENTORY_LOG_PREVIEW_LIMIT,
  fetchItemQuantityAdjustments,
  formatAdjustmentWhen,
} from "./itemQuantityAdjust.js";

export default function InventoryLogModal({ onClose, onViewAll }) {
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
        const result = await fetchItemQuantityAdjustments({ limit: INVENTORY_LOG_PREVIEW_LIMIT });
        if (cancelled) return;
        setMissingTable(!!result.missingTable);
        setRows(result.rows || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || "이력을 불러오지 못했습니다.");
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
          <h3 className="hub-modal__title">교구 재고 변경</h3>
          <button type="button" className="hub-modal__close" onClick={onClose}>닫기</button>
        </div>

        {loading ? (
          <div className="hub-panel-card__empty">불러오는 중...</div>
        ) : missingTable ? (
          <div className="hub-panel-card__empty">재고 변경 이력 테이블이 아직 없습니다.</div>
        ) : error ? (
          <div className="hub-panel-card__empty">{error}</div>
        ) : !rows.length ? (
          <div className="hub-panel-card__empty">아직 수량 변경 이력이 없습니다.</div>
        ) : (
          <div className="inventory-log-list">
            {rows.map((row) => {
              const name = row.items?.name || "삭제된 교구";
              const code = row.items?.code;
              const up = Number(row.new_quantity) > Number(row.old_quantity);
              return (
                <div key={row.id} className="inventory-log-row">
                  <div className="inventory-log-row__main">
                    <div className="inventory-log-row__title">
                      <span className="inventory-log-row__name">{name}</span>
                      {code ? <span className="inventory-log-row__code">{code}</span> : null}
                    </div>
                    <div className="inventory-log-row__change">
                      <span>{row.old_quantity}</span>
                      {" → "}
                      <span className={up ? "is-up" : "is-down"}>{row.new_quantity}</span>
                    </div>
                  </div>
                  <div className="inventory-log-row__meta">
                    {[row.teachers?.name, formatAdjustmentWhen(row.created_at), row.note || null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {onViewAll ? (
          <div className="inventory-log-modal__footer">
            <button
              type="button"
              className="hub-panel-card__view-all"
              onClick={() => {
                onClose();
                onViewAll();
              }}
            >
              전체보기 &gt;
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
