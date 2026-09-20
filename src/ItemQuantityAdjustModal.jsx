import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import {
  QUANTITY_ADJUST_NOTE_PRESETS,
  adjustItemTotalQuantity,
  quantityAdjustErrorMessage,
} from "./itemQuantityAdjust.js";

export function StockAdjustButton({ onClick, label = "전체 수량 수정" }) {
  return (
    <button
      type="button"
      className="stock-adjust-btn"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      <Pencil size={13} strokeWidth={2.4} />
    </button>
  );
}

export default function ItemQuantityAdjustModal({ item, onClose, onSaved }) {
  const current = Number(item?.total_quantity ?? 0) || 0;
  const [qty, setQty] = useState(String(current));
  const [preset, setPreset] = useState(QUANTITY_ADJUST_NOTE_PRESETS[0]);
  const [customNote, setCustomNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev || ""; };
  }, []);

  const parsed = Number.parseInt(String(qty), 10);
  const validQty = Number.isInteger(parsed) && parsed >= 0;
  const unchanged = validQty && parsed === current;
  const note = preset === "기타" ? customNote.trim() : preset;

  const submit = async () => {
    if (!validQty) {
      setError("수량은 0 이상의 정수여야 합니다.");
      return;
    }
    if (unchanged) {
      setError("수량이 이전과 같습니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await adjustItemTotalQuantity({
        itemId: item.id,
        newQuantity: parsed,
        note,
      });
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      setError(quantityAdjustErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="app-modal-backdrop app-modal-backdrop--center app-modal-backdrop--nested"
      onClick={onClose}
    >
      <div
        className="app-modal-sheet app-modal-sheet--center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-modal-sheet__head">
          <div className="app-modal-sheet__title">전체 수량 수정</div>
          <button type="button" className="app-modal-sheet__close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
          {item?.name || "교구"}
        </div>
        {item?.code ? (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14, fontFamily: "ui-monospace, monospace" }}>
            {item.code}
          </div>
        ) : null}

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          background: "#f8fafc",
          marginBottom: 16,
          fontSize: 13,
          color: "#475569",
        }}>
          <span>현재 전체 수량</span>
          <strong style={{ fontSize: 18, color: "#0f172a" }}>{current}</strong>
          <span>→</span>
          <strong style={{ fontSize: 18, color: validQty && !unchanged ? "#059669" : "#94a3b8" }}>
            {validQty ? parsed : "—"}
          </strong>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
          새 전체 수량
        </label>
        <input
          type="number"
          min={0}
          step={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 18,
            fontWeight: 800,
            fontFamily: "inherit",
            marginBottom: 16,
          }}
        />

        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>사유</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {QUANTITY_ADJUST_NOTE_PRESETS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setPreset(label)}
              style={{
                border: preset === label ? "1.5px solid #059669" : "1px solid #e2e8f0",
                background: preset === label ? "#ecfdf5" : "#fff",
                color: preset === label ? "#047857" : "#475569",
                borderRadius: 99,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "기타" ? (
          <textarea
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="사유를 적어 주세요 (선택)"
            rows={2}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
              marginBottom: 12,
            }}
          />
        ) : null}

        <div style={{
          fontSize: 12,
          lineHeight: 1.55,
          color: "#b45309",
          background: "#fffbeb",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 14,
        }}>
          승인 없이 바로 반영됩니다. 교구관리자에게 변경 공지가 갑니다.
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 12, lineHeight: 1.5 }}>{error}</div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={saving || !validQty || unchanged}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 12,
            padding: "13px 16px",
            background: saving || !validQty || unchanged ? "#cbd5e1" : "#059669",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            cursor: saving || !validQty || unchanged ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {saving ? "저장 중..." : `${current} → ${validQty ? parsed : "—"} 반영`}
        </button>
      </div>
    </div>
  );
}
