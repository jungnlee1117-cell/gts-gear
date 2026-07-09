import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { isItemAdmin } from "./authRoles.js";
import { useGearCategories } from "./GearCategoriesContext.jsx";
import { suggestCategoryId } from "./gearCategoryData.js";
import {
  deleteGearCategory,
  insertGearCategory,
  saveGearCategoryOrder,
  updateGearCategory,
} from "./gearCategoryApi.js";

const DS = {
  primary: "#059669",
  primaryLight: "#ecfdf5",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  danger: "#dc2626",
  border: "#e8ecee",
};

const card = {
  background: "#fff",
  border: `1px solid ${DS.border}`,
  borderRadius: 14,
  padding: "14px 16px",
};

function countItemsInCategory(items, categoryId) {
  return items.filter(i => i.category === categoryId || (categoryId === "ETC" && i.category === "SPC")).length;
}

export default function GearCategoryManagePage({ me, items = [] }) {
  const { categories, refresh, setCategories } = useGearCategories();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = isItemAdmin(me);
  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

  if (!canManage) {
    return (
      <div style={{ textAlign: "center", padding: "70px 20px" }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: DS.danger }}>접근 권한이 없습니다</div>
      </div>
    );
  }

  const applyLocalOrder = (nextRows) => {
    setCategories(nextRows.map((row, index) => ({ ...row, sort_order: index + 1 })));
  };

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return alert("카테고리 이름을 입력하세요");
    const existingIds = sorted.map(c => c.id);
    const id = suggestCategoryId(label, existingIds);
    if (existingIds.includes(id)) return alert("이미 존재하는 카테고리 코드입니다.");
    setSaving(true);
    try {
      const row = await insertGearCategory({
        id,
        label,
        color: "#64748b",
        icon: "⭐",
        sort_order: sorted.length + 1,
      });
      await refresh();
      setNewLabel("");
      if (!row) await refresh();
    } catch (err) {
      alert(err?.message || "카테고리 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditLabel(cat.label);
  };

  const handleSaveEdit = async (cat) => {
    const label = editLabel.trim();
    if (!label) return alert("카테고리 이름을 입력하세요");
    setSaving(true);
    try {
      await updateGearCategory(cat.id, { label });
      setEditingId(null);
      await refresh();
    } catch (err) {
      alert(err?.message || "수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    const count = countItemsInCategory(items, cat.id);
    if (count > 0) {
      alert(`「${cat.label}」 카테고리에 교구가 ${count}개 있어 삭제할 수 없습니다.`);
      return;
    }
    if (!confirm(`「${cat.label}」 카테고리를 삭제할까요?`)) return;
    setSaving(true);
    try {
      await deleteGearCategory(cat.id);
      await refresh();
    } catch (err) {
      alert(err?.message || "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const moveCategory = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const next = sorted.slice();
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    applyLocalOrder(next);
    setSaving(true);
    try {
      await saveGearCategoryOrder(next.map(c => c.id));
      await refresh();
    } catch (err) {
      alert(err?.message || "순서 변경에 실패했습니다.");
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gear-category-manage">
      <section style={{ ...card, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: DS.textPrimary }}>카테고리 추가</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: DS.textSecondary, lineHeight: 1.5 }}>
          이름만 입력하면 코드는 자동 생성됩니다. (예: 이벤트 → EVENT)
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="카테고리 이름"
            disabled={saving}
            style={{
              flex: "1 1 200px",
              minWidth: 0,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${DS.border}`,
              fontSize: 14,
              fontFamily: "inherit",
            }}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newLabel.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: DS.primary,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            <Plus size={16}/>
            등록
          </button>
        </div>
      </section>

      <section style={{ ...card }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: DS.textPrimary }}>
          카테고리 목록 ({sorted.length})
        </h3>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {sorted.map((cat, index) => {
            const itemCount = countItemsInCategory(items, cat.id);
            const isEditing = editingId === cat.id;
            return (
              <li
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${DS.border}`,
                  background: "#fafafa",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }} aria-hidden>{cat.icon}</span>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  {isEditing ? (
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      disabled={saving}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${DS.border}`,
                        fontSize: 14,
                        fontFamily: "inherit",
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleSaveEdit(cat);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <>
                      <div style={{ fontWeight: 800, fontSize: 14, color: DS.textPrimary }}>{cat.label}</div>
                      <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>
                        코드 {cat.id} · 교구 {itemCount}개
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    aria-label="위로"
                    disabled={saving || index === 0}
                    onClick={() => moveCategory(index, -1)}
                    style={iconBtnStyle}
                  >
                    <ChevronUp size={16}/>
                  </button>
                  <button
                    type="button"
                    aria-label="아래로"
                    disabled={saving || index === sorted.length - 1}
                    onClick={() => moveCategory(index, 1)}
                    style={iconBtnStyle}
                  >
                    <ChevronDown size={16}/>
                  </button>
                  {isEditing ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveEdit(cat)}
                      style={{ ...iconBtnStyle, color: DS.primary, fontWeight: 700, fontSize: 12, width: "auto", padding: "0 10px" }}
                    >
                      저장
                    </button>
                  ) : (
                    <button type="button" aria-label="이름 수정" disabled={saving} onClick={() => startEdit(cat)} style={iconBtnStyle}>
                      <Pencil size={15}/>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="삭제"
                    disabled={saving || itemCount > 0}
                    title={itemCount > 0 ? "교구가 있는 카테고리는 삭제할 수 없습니다" : "삭제"}
                    onClick={() => handleDelete(cat)}
                    style={{ ...iconBtnStyle, color: itemCount > 0 ? DS.textMuted : DS.danger }}
                  >
                    <Trash2 size={15}/>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

const iconBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 8,
  border: `1px solid ${DS.border}`,
  background: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  color: DS.textSecondary,
};
