import { useMemo, useState } from "react";
import { useGearCategories } from "./GearCategoriesContext.jsx";
import { getCategoryMeta } from "./gearCategoryData.js";
import {
  cartLineKey,
  setComponentAvailQty,
  setAvailComponentCount,
  setHasAnyAvail,
} from "./itemSets.js";

const DS = {
  primary: "#16a34a",
  primaryLight: "#f0fdf4",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  inputBorder: "#e2e8f0",
};

const card = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "16px 18px",
  marginBottom: 14,
};

function CatTag({ cat, categoryMap }) {
  const m = getCategoryMeta(cat, categoryMap);
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 99,
      background: `${m.color}18`,
      color: m.color,
      border: `1px solid ${m.color}33`,
    }}>
      {m.label}
    </span>
  );
}

function QuantityInput({ value, min, max, onChange, disabled }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      onChange={e => onChange(parseInt(e.target.value, 10) || min)}
      style={{
        width: "100%",
        padding: "9px 11px",
        fontSize: 14,
        borderRadius: 10,
        border: `1px solid ${DS.inputBorder}`,
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
      }}
    />
  );
}

export default function ItemSetDetailPage({
  set,
  ris,
  rets,
  cart,
  setCart,
  onBack,
  backLabel = "교구 둘러보기",
  me,
  PageShell,
  PageHeader,
  PAGE_META,
  Btn,
  panelCard,
  parseActivityPhotos,
  ItemActivityGallery,
  ImageLightbox,
  GearQrDisplay,
  CategoryIconFallback,
}) {
  const { categoryMap } = useGearCategories();
  const [selections, setSelections] = useState(() =>
    (set?.components || []).map(c => ({
      name: c.name,
      selected: false,
      quantity: 1,
    })),
  );
  const [photoLightbox, setPhotoLightbox] = useState(false);
  const [activityLightbox, setActivityLightbox] = useState(null);
  const activityPhotos = useMemo(() => parseActivityPhotos?.(set) || [], [set, parseActivityPhotos]);

  const componentCount = set?.components?.length || 0;
  const availCount = setAvailComponentCount(set, ris, rets);
  const anyAvail = setHasAnyAvail(set, ris, rets);

  const cartKeysForSet = useMemo(() => {
    const keys = new Set();
    (cart || []).forEach(c => {
      if (c.set_id === set.id) keys.add(cartLineKey(c));
    });
    return keys;
  }, [cart, set.id]);

  const toggleSelect = (name) => {
    setSelections(prev => prev.map(s =>
      s.name === name ? { ...s, selected: !s.selected } : s,
    ));
  };

  const setQuantity = (name, quantity) => {
    setSelections(prev => prev.map(s =>
      s.name === name ? { ...s, quantity } : s,
    ));
  };

  const addComponentsToCart = (rows) => {
    if (!rows.length) {
      alert("담을 품목을 선택하세요.");
      return;
    }
    setCart(prev => {
      let next = [...prev];
      for (const row of rows) {
        const entry = {
          set_id: set.id,
          component_name: row.name,
          quantity: row.quantity,
          due_date: "",
        };
        const key = cartLineKey(entry);
        const idx = next.findIndex(c => cartLineKey(c) === key);
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantity: row.quantity };
        } else {
          next.push(entry);
        }
      }
      return next;
    });
    alert(`${rows.length}개 품목이 장바구니에 담겼습니다.`);
  };

  const handleAddSelected = () => {
    const rows = [];
    for (const sel of selections) {
      if (!sel.selected) continue;
      const comp = set.components.find(c => c.name === sel.name);
      const av = setComponentAvailQty(set.id, sel.name, comp?.total_quantity, ris, rets);
      if (av <= 0) {
        alert(`${sel.name}은(는) 현재 대여 불가입니다.`);
        return;
      }
      const qty = Math.min(Math.max(1, sel.quantity || 1), av);
      rows.push({ name: sel.name, quantity: qty });
    }
    addComponentsToCart(rows);
  };

  const handleRentFullSet = () => {
    const rows = [];
    for (const comp of set.components) {
      const av = setComponentAvailQty(set.id, comp.name, comp.total_quantity, ris, rets);
      if (av <= 0) continue;
      rows.push({ name: comp.name, quantity: av });
    }
    if (!rows.length) {
      alert("대여 가능한 품목이 없습니다.");
      return;
    }
    if (rows.length < set.components.length) {
      const missing = set.components
        .filter(c => setComponentAvailQty(set.id, c.name, c.total_quantity, ris, rets) <= 0)
        .map(c => c.name)
        .join(", ");
      if (!confirm(`일부 품목(${missing})은 재고가 없어 제외하고 담습니다. 계속할까요?`)) return;
    }
    addComponentsToCart(rows);
  };

  const ytId = (url) => {
    if (!url) return null;
    const m = url.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };
  const vid = ytId(set.youtube_url);

  return (
    <PageShell>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "#fff",
          border: "1px solid #e8ecee",
          borderRadius: 10,
          color: DS.primary,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          padding: "8px 14px",
          marginBottom: 20,
          fontFamily: "inherit",
        }}
      >
        ← {backLabel}
      </button>

      <PageHeader me={me} subtitle={PAGE_META?.["set-detail"]?.sub || "세트 교구 상세"} />

      <div style={card}>
        {set.photo_url ? (
          <>
            <button
              type="button"
              onClick={() => setPhotoLightbox(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 260,
                marginBottom: 14,
                padding: 12,
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                cursor: "zoom-in",
                fontFamily: "inherit",
                overflow: "hidden",
              }}
            >
              <img
                src={set.photo_url}
                alt={set.name}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </button>
            {photoLightbox && ImageLightbox && (
              <ImageLightbox src={set.photo_url} alt={set.name} onClose={() => setPhotoLightbox(false)} />
            )}
          </>
        ) : CategoryIconFallback ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0", marginBottom: 14 }}>
            <CategoryIconFallback category={set.category} size={120} />
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            padding: "3px 8px",
            borderRadius: 6,
            background: "#ede9fe",
            color: "#7c3aed",
          }}>
            세트형
          </span>
          <CatTag cat={set.category} categoryMap={categoryMap} />
          <span style={{ fontFamily: "monospace", fontSize: 10, color: DS.textMuted }}>{set.code}</span>
          {set.branch && (
            <span style={{ fontSize: 10, color: DS.textSecondary, background: "#f8fafc", padding: "2px 8px", borderRadius: 99 }}>
              {set.branch}
            </span>
          )}
        </div>

        <div style={{ fontSize: 20, fontWeight: 900, color: DS.textPrimary, marginBottom: 4 }}>{set.name}</div>
        {set.alias && <div style={{ fontSize: 12, color: DS.textMuted, marginBottom: 10 }}>({set.alias})</div>}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
          marginBottom: 16,
        }}>
          <div style={{ background: anyAvail ? "#dcfce7" : "#fee2e2", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: anyAvail ? "#16a34a" : "#dc2626" }}>{availCount}/{componentCount}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: anyAvail ? "#16a34a" : "#dc2626", opacity: 0.8 }}>품목 대여 가능</div>
          </div>
          <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#334155" }}>{componentCount}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>구성 품목</div>
          </div>
        </div>

        {Btn && (
          <Btn full color={anyAvail ? DS.primary : "#cbd5e1"} disabled={!anyAvail} onClick={handleRentFullSet}>
            {anyAvail ? "전체 세트 한번에 대여" : "세트 전체 대여 불가"}
          </Btn>
        )}
      </div>

      {set.description && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DS.textSecondary, marginBottom: 7 }}>설명</div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: DS.textPrimary, whiteSpace: "pre-wrap" }}>{set.description}</div>
        </div>
      )}

      {activityPhotos.length > 0 && ItemActivityGallery && (
        <div style={card}>
          <ItemActivityGallery photos={activityPhotos} onPhotoClick={setActivityLightbox} />
        </div>
      )}
      {activityLightbox && ImageLightbox && (
        <ImageLightbox src={activityLightbox.src} alt={activityLightbox.alt} onClose={() => setActivityLightbox(null)} />
      )}

      <div style={{ ...card, padding: "18px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: DS.textPrimary, marginBottom: 4 }}>하위 품목 선택</div>
        <div style={{ fontSize: 12, color: DS.textSecondary, marginBottom: 14 }}>
          원하는 품목을 선택하고 수량을 지정한 뒤 장바구니에 담으세요. 품목별 재고가 개별 관리됩니다.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(set.components || []).map(comp => {
            const av = setComponentAvailQty(set.id, comp.name, comp.total_quantity, ris, rets);
            const sel = selections.find(s => s.name === comp.name);
            const inCart = cartKeysForSet.has(cartLineKey({ set_id: set.id, component_name: comp.name }));
            const unavailable = av <= 0;

            return (
              <div
                key={comp.id || comp.name}
                style={{
                  ...panelCard,
                  marginBottom: 0,
                  padding: "14px 16px",
                  borderLeft: `3px solid ${unavailable ? "#dc2626" : sel?.selected ? DS.primary : "#e2e8f0"}`,
                  opacity: unavailable ? 0.72 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(sel?.selected)}
                    disabled={unavailable}
                    onChange={() => toggleSelect(comp.name)}
                    style={{ marginTop: 4, width: 18, height: 18, accentColor: DS.primary }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: DS.textPrimary }}>{comp.name}</div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: unavailable ? "#dc2626" : "#16a34a",
                      }}>
                        {unavailable ? "대여불가" : `대여 가능 ${av}개`}
                        <span style={{ color: DS.textMuted, fontWeight: 500 }}> / 전체 {comp.total_quantity}개</span>
                      </div>
                    </div>
                    {!unavailable && sel?.selected && (
                      <div style={{ marginTop: 10, maxWidth: 140 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: DS.textSecondary, display: "block", marginBottom: 4 }}>
                          수량 (최대 {av})
                        </label>
                        <QuantityInput
                          value={sel.quantity || 1}
                          min={1}
                          max={av}
                          onChange={q => setQuantity(comp.name, q)}
                        />
                      </div>
                    )}
                    {inCart && (
                      <div style={{ fontSize: 11, color: DS.primary, fontWeight: 700, marginTop: 6 }}>장바구니에 담김</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {Btn && (
          <div style={{ marginTop: 16 }}>
            <Btn full onClick={handleAddSelected}>선택 품목 장바구니 담기</Btn>
          </div>
        )}
      </div>

      {set.usage_description && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DS.textSecondary, marginBottom: 7 }}>사용 방법</div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: DS.textPrimary, whiteSpace: "pre-wrap" }}>{set.usage_description}</div>
        </div>
      )}

      {set.safety_notes && (
        <div style={{ ...card, borderLeft: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", marginBottom: 7 }}>안전 주의사항</div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: DS.textPrimary, whiteSpace: "pre-wrap" }}>{set.safety_notes}</div>
        </div>
      )}

      {vid && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DS.textSecondary, marginBottom: 9 }}>사용법 영상</div>
          <div style={{ borderRadius: 12, overflow: "hidden" }}>
            <iframe
              width="100%"
              height="195"
              src={`https://www.youtube.com/embed/${vid}`}
              frameBorder="0"
              allowFullScreen
              title="사용법 영상"
              style={{ display: "block" }}
            />
          </div>
        </div>
      )}

      {GearQrDisplay && set.code && (
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DS.textSecondary, marginBottom: 12 }}>세트 QR 코드</div>
          <div style={{ display: "inline-block", padding: 10, background: "#fff", borderRadius: 12, border: "1px solid #e8ecee" }}>
            <GearQrDisplay item={{ id: set.id, code: set.code }} size={140} />
          </div>
        </div>
      )}
    </PageShell>
  );
}
