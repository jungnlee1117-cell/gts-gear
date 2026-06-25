import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import {
  findMonthlyCrossLetterDuplicates,
  formatWeekRange,
  isAirProductName,
  lettersConflictingForItem,
  normalizeItemName,
  resolveItemRecord,
  ROTATION_LETTERS,
  yearMonthFirstDay,
  yearMonthKey,
} from "./itemRotation.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const TARGET_TYPES = ["유치원", "어린이집"];
const WEEKS = [1, 2, 3, 4, 5];

const DS = {
  primary: "#059669",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  warn: "#b45309",
  warnBg: "#fffbeb",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
};

const card = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e8ecee",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

const CAT_OPTIONS = [
  ["AIR", "에어교구"], ["BALL", "공류"], ["BAL", "밸런스"], ["SPORT", "스포츠"],
  ["TOOL", "도구류"], ["MAT", "매트/기구"], ["GROUP", "단체놀이"], ["ETC", "기타교구"],
];

function guessCategory(name) {
  if (/에어/i.test(name)) return "AIR";
  if (/징검|매트|터널|쿠션|밸런스/i.test(name)) return "BAL";
  if (/공|볼/i.test(name)) return "BALL";
  if (/라켓|축구|하키|펜싱|줄넘/i.test(name)) return "SPORT";
  return "ETC";
}

function nextItemCode(category, items) {
  const re = new RegExp(`^${category}-(\\d+)$`, "i");
  let max = 0;
  (items || []).forEach(i => {
    const m = i.code?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${category}-${String(max + 1).padStart(3, "0")}`;
}

function QuickRegisterModal({ itemName, items, onSave, onClose }) {
  const [category, setCategory] = useState(() => guessCategory(itemName));
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const code = useMemo(() => nextItemCode(category, items), [category, items]);

  const submit = async () => {
    setSaving(true);
    const row = await onSave({
      code,
      name: normalizeItemName(itemName),
      alias: "",
      category,
      total_quantity: quantity,
      branch: "사무실",
      status: "available",
      description: "",
      photo_url: "",
      youtube_url: "",
      usage_description: "",
      safety_notes: "",
    });
    setSaving(false);
    if (row) onClose(row);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ ...card, width: "100%", maxWidth: 420, padding: 24 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>재고에 교구 등록</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: DS.textSecondary }}>
          「{itemName}」을 교구 재고에 추가합니다.
        </p>
        <label style={{ fontSize: 12, fontWeight: 700, color: DS.textMuted }}>카테고리</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{
          width: "100%", boxSizing: "border-box", marginBottom: 12, padding: "10px 12px",
          borderRadius: 10, border: "1px solid #e5e7eb",
        }}>
          {CAT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label style={{ fontSize: 12, fontWeight: 700, color: DS.textMuted }}>코드 (자동)</label>
        <input value={code} readOnly style={{
          width: "100%", boxSizing: "border-box", marginBottom: 12, padding: "10px 12px",
          borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", fontFamily: "monospace",
        }}/>
        <label style={{ fontSize: 12, fontWeight: 700, color: DS.textMuted }}>수량</label>
        <input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)} style={{
          width: "100%", boxSizing: "border-box", marginBottom: 20, padding: "10px 12px",
          borderRadius: 10, border: "1px solid #e5e7eb",
        }}/>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => onClose(null)} style={{
            flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #e5e7eb",
            background: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
          }}>
            취소
          </button>
          <button type="button" disabled={saving} onClick={submit} style={{
            flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
            background: DS.primary, color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
          }}>
            {saving ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WeekRow({
  weekNumber, row, draft, dateRange, items, conflictLetters, monthKeyLabel,
  highlighted, onDraftChange, onSave, onDelete, saving, onRegister,
}) {
  const name = draft?.item_name ?? row?.item_name ?? "";
  const isAir = draft?.is_air_product ?? row?.is_air_product ?? isAirProductName(name, weekNumber);
  const matched = name ? resolveItemRecord(items, name) : null;
  const hasConflict = conflictLetters.length > 0 && normalizeItemName(name);

  return (
    <div
      id={`gear-rotation-week-${weekNumber}`}
      style={{
      ...card, padding: "14px 16px",
      borderColor: highlighted ? DS.primary : hasConflict ? "#fcd34d" : card.border,
      background: highlighted ? "#ecfdf5" : hasConflict ? DS.warnBg : card.background,
      boxShadow: highlighted ? `0 0 0 2px ${DS.primary}` : card.boxShadow,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 800, color: DS.textPrimary }}>{weekNumber}주차</span>
          {dateRange && <span style={{ fontSize: 11, color: DS.textMuted, marginLeft: 8 }}>{dateRange}</span>}
          {weekNumber === 4 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#0891b2", marginLeft: 6,
              background: "#ecfeff", padding: "2px 6px", borderRadius: 6,
            }}>
              에어
            </span>
          )}
        </div>
        {row?.id && (
          <button type="button" onClick={() => onDelete(row)} disabled={saving} style={{
            background: DS.dangerBg, border: "none", color: DS.danger, fontSize: 12,
            fontWeight: 600, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
          }}>
            삭제
          </button>
        )}
      </div>

      <input
        value={name}
        placeholder="교구명 입력"
        list="gear-rotation-item-options"
        onChange={e => onDraftChange({
          item_name: e.target.value,
          is_air_product: isAirProductName(e.target.value, weekNumber),
          simple_activity: draft?.simple_activity ?? row?.simple_activity ?? "",
        })}
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
          border: `1px solid ${hasConflict ? "#fbbf24" : "#e5e7eb"}`, fontSize: 14, marginBottom: 8,
        }}
      />

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: DS.textSecondary, marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={isAir}
          onChange={e => onDraftChange({
            item_name: name,
            is_air_product: e.target.checked,
            simple_activity: draft?.simple_activity ?? row?.simple_activity ?? "",
          })}
        />
        에어 제품
      </label>

      {name && !matched && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "8px 10px", borderRadius: 10, background: DS.dangerBg, marginBottom: 8, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, color: DS.danger }}>재고에 등록되지 않은 교구입니다</span>
          <button type="button" onClick={() => onRegister(name)} style={{
            border: "none", background: DS.danger, color: "#fff", fontSize: 11, fontWeight: 700,
            padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
          }}>
            재고 등록
          </button>
        </div>
      )}

      {name && matched && (
        <div style={{ fontSize: 11, color: DS.primary, marginBottom: 8 }}>
          ✓ 재고 매칭: {matched.name} ({matched.code})
        </div>
      )}

      {hasConflict && (
        <div style={{ fontSize: 12, color: DS.warn, marginBottom: 8 }}>
          ⚠ {monthKeyLabel} 기준 알파벳 {conflictLetters.join(", ")}에도 같은 교구가 있습니다
        </div>
      )}

      <label style={{ fontSize: 12, fontWeight: 700, color: DS.textMuted, display: "block", marginBottom: 4 }}>
        간단한 활동 (선택)
      </label>
      <textarea
        value={draft?.simple_activity ?? row?.simple_activity ?? ""}
        placeholder="예: 에어징검다리 위를 건너며 중심을 잡아봅니다."
        rows={2}
        onChange={e => onDraftChange({
          item_name: name,
          is_air_product: isAir,
          simple_activity: e.target.value,
        })}
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
          border: "1px solid #e5e7eb", fontSize: 13, marginBottom: 10, resize: "vertical",
          fontFamily: "inherit",
        }}
      />

      <button type="button" onClick={onSave} disabled={saving || !normalizeItemName(name)} style={{
        width: "100%", padding: "9px 0", borderRadius: 10, border: "none",
        background: DS.primary, color: "#fff", fontWeight: 700, cursor: "pointer",
        fontFamily: "inherit", opacity: saving || !normalizeItemName(name) ? 0.6 : 1,
      }}>
        {saving ? "저장 중..." : row?.id ? "수정 저장" : "추가"}
      </button>
    </div>
  );
}

export default function GearRotationManagePage({
  me, items, onSaveItem, onReloadItems, PageHeader, PageShell,
}) {
  const [letter, setLetter] = useState("A");
  const [tab, setTab] = useState("유치원");
  const [monthKey, setMonthKey] = useState(yearMonthKey());
  const [weeklyLists, setWeeklyLists] = useState([]);
  const [rotationSchedule, setRotationSchedule] = useState([]);
  const [monthWeeks, setMonthWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [savingWeek, setSavingWeek] = useState(null);
  const [registerName, setRegisterName] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightWeek, setHighlightWeek] = useState(null);
  const highlightTimerRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ym = yearMonthFirstDay(monthKey);
      const [weeklyRes, schedRes, weeksRes] = await Promise.all([
        supabase.from("item_weekly_lists").select("*").order("letter").order("week_number"),
        supabase.from("item_rotation_schedule").select("year_month, assigned_letter, teacher_id"),
        supabase.from("item_rotation_month_weeks").select("*").eq("year_month", ym).order("week_number"),
      ]);
      if (weeklyRes.error) throw weeklyRes.error;
      if (schedRes.error) throw schedRes.error;
      if (weeksRes.error && weeksRes.error.code !== "42P01") throw weeksRes.error;
      setWeeklyLists(weeklyRes.data || []);
      setRotationSchedule(schedRes.data || []);
      setMonthWeeks(weeksRes.data || []);
      setDrafts({});
    } catch (e) {
      setError(e.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  const itemOptions = useMemo(
    () => [...(items || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko")),
    [items],
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { rotation: [], inventory: [] };

    const rotation = weeklyLists
      .filter(w => {
        const name = (w.item_name || "").toLowerCase();
        const activity = (w.simple_activity || "").toLowerCase();
        return name.includes(q) || activity.includes(q);
      })
      .map(w => ({
        id: w.id,
        letter: w.letter,
        targetType: w.target_type,
        weekNumber: w.week_number,
        itemName: w.item_name,
        simpleActivity: w.simple_activity,
        matched: resolveItemRecord(items, w.item_name),
      }))
      .sort((a, b) =>
        a.letter.localeCompare(b.letter)
        || a.targetType.localeCompare(b.targetType)
        || a.weekNumber - b.weekNumber,
      );

    const inventory = itemOptions
      .filter(i => {
        const name = (i.name || "").toLowerCase();
        const alias = (i.alias || "").toLowerCase();
        const code = (i.code || "").toLowerCase();
        return name.includes(q) || alias.includes(q) || code.includes(q);
      })
      .slice(0, 12);

    return { rotation, inventory };
  }, [searchQuery, weeklyLists, items, itemOptions]);

  const jumpToRotation = (entry) => {
    setLetter(entry.letter);
    setTab(entry.targetType);
    setDrafts({});
    setHighlightWeek(entry.weekNumber);
    setSearchQuery("");
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setTimeout(() => {
      document.getElementById(`gear-rotation-week-${entry.weekNumber}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    highlightTimerRef.current = setTimeout(() => setHighlightWeek(null), 2500);
  };

  const monthDupes = useMemo(
    () => findMonthlyCrossLetterDuplicates(weeklyLists, rotationSchedule, monthKey),
    [weeklyLists, rotationSchedule, monthKey],
  );

  const weeksMap = useMemo(() => {
    const m = new Map();
    monthWeeks.forEach(w => m.set(w.week_number, w));
    return m;
  }, [monthWeeks]);

  const rowsForView = useMemo(() => {
    const map = new Map();
    weeklyLists
      .filter(w => w.letter === letter && w.target_type === tab)
      .forEach(w => map.set(w.week_number, w));
    return WEEKS.map(wn => ({ weekNumber: wn, row: map.get(wn) || null }));
  }, [weeklyLists, letter, tab]);

  const draftKey = (wn) => `${letter}|${tab}|${wn}`;

  const getDraft = (wn, row) => drafts[draftKey(wn)] ?? {
    item_name: row?.item_name ?? "",
    is_air_product: row?.is_air_product ?? false,
    simple_activity: row?.simple_activity ?? "",
  };

  const setDraft = (wn, patch) => {
    const row = rowsForView.find(r => r.weekNumber === wn)?.row;
    const prev = getDraft(wn, row);
    setDrafts(p => ({ ...p, [draftKey(wn)]: { ...prev, ...patch } }));
  };

  const saveWeek = async (weekNumber, row) => {
    const draft = getDraft(weekNumber, row);
    const item_name = normalizeItemName(draft.item_name);
    if (!item_name) return;

    const conflicts = lettersConflictingForItem(weeklyLists, rotationSchedule, monthKey, {
      targetType: tab,
      itemName: item_name,
      excludeLetter: letter,
    });
    if (conflicts.length) {
      const ok = confirm(
        `「${item_name}」은(는) ${monthKey.slice(0, 7)}에 알파벳 ${conflicts.join(", ")}에도 배정되어 있습니다.\n`
        + "같은 달에 재고가 겹칠 수 있습니다. 그래도 저장하시겠습니까?",
      );
      if (!ok) return;
    }

    setSavingWeek(weekNumber);
    const payload = {
      letter,
      week_number: weekNumber,
      target_type: tab,
      item_name,
      is_air_product: draft.is_air_product ?? isAirProductName(item_name, weekNumber),
      simple_activity: (draft.simple_activity || "").trim() || null,
    };

    const res = row?.id
      ? await supabase.from("item_weekly_lists").update(payload).eq("id", row.id).select().single()
      : await supabase.from("item_weekly_lists").insert(payload).select().single();

    setSavingWeek(null);
    if (res.error) {
      alert("저장 오류: " + res.error.message);
      return;
    }

    setWeeklyLists(prev => [...prev.filter(w => w.id !== row?.id), res.data]);
    setDrafts(p => {
      const n = { ...p };
      delete n[draftKey(weekNumber)];
      return n;
    });
  };

  const deleteRow = async (row) => {
    if (!row?.id) return;
    if (!confirm(`「${row.item_name}」 항목을 삭제하시겠습니까?`)) return;
    const { error: delErr } = await supabase.from("item_weekly_lists").delete().eq("id", row.id);
    if (delErr) {
      alert("삭제 오류: " + delErr.message);
      return;
    }
    setWeeklyLists(prev => prev.filter(w => w.id !== row.id));
  };

  const monthLabel = `${monthKey.slice(0, 4)}년 ${parseInt(monthKey.slice(5, 7), 10)}월`;

  return (
    <PageShell>
      <PageHeader me={me} subtitle="알파벳별 주차 교구 목록을 수정합니다. (관리자 전용)"/>

      {registerName && (
        <QuickRegisterModal
          itemName={registerName}
          items={items}
          onSave={onSaveItem}
          onClose={() => {
            setRegisterName(null);
            if (onReloadItems) onReloadItems();
          }}
        />
      )}

      <div style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: DS.textSecondary }}>
          중복 검사 기준 월
          <input
            type="month"
            value={monthKey.slice(0, 7)}
            onChange={e => setMonthKey(e.target.value)}
            style={{ display: "block", marginTop: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
        </label>
        <div style={{ fontSize: 12, color: DS.textMuted, flex: 1, minWidth: 200 }}>
          {monthLabel} 순환 배정 기준으로 다른 알파벳과 교구명이 겹치면 경고합니다.
        </div>
      </div>

      {monthDupes.length > 0 && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 16, background: DS.warnBg, borderColor: "#fcd34d" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: DS.warn, marginBottom: 8 }}>
            {monthLabel} 중복 교구 ({monthDupes.length}건)
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: DS.textSecondary }}>
            {monthDupes.map(d => (
              <li key={`${d.target_type}|${d.item_name}`} style={{ marginBottom: 4 }}>
                [{d.target_type}] <strong>{d.item_name}</strong> — 알파벳 {d.letters.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: DS.textSecondary, marginBottom: 8 }}>
          교구 검색
        </label>
        <div style={{ position: "relative" }}>
          <Search
            size={18}
            aria-hidden
            style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: DS.textMuted, pointerEvents: "none",
            }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="교구명·코드 검색 (예: 에어브릿지, BAL-001)"
            aria-label="교구 검색"
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 40px",
              borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14,
            }}
          />
        </div>
        {searchQuery.trim() ? (
          <div style={{ marginTop: 12 }}>
            {searchResults.rotation.length === 0 && searchResults.inventory.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: DS.textMuted }}>
                「{searchQuery.trim()}」에 맞는 순환 배정·재고 교구가 없습니다.
              </p>
            ) : (
              <>
                {searchResults.rotation.length > 0 ? (
                  <div style={{ marginBottom: searchResults.inventory.length ? 12 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: DS.textMuted, marginBottom: 6 }}>
                      순환 배정 ({searchResults.rotation.length}건)
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                      {searchResults.rotation.map(entry => (
                        <li key={entry.id || `${entry.letter}|${entry.targetType}|${entry.weekNumber}|${entry.itemName}`}>
                          <button
                            type="button"
                            onClick={() => jumpToRotation(entry)}
                            style={{
                              width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10,
                              border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 700, color: DS.textPrimary }}>
                              {entry.itemName}
                            </div>
                            <div style={{ fontSize: 12, color: DS.textSecondary, marginTop: 2 }}>
                              알파벳 {entry.letter} · {entry.targetType} · {entry.weekNumber}주차
                              {entry.matched ? ` · ${entry.matched.code}` : " · 재고 미등록"}
                            </div>
                            {entry.simpleActivity ? (
                              <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 4 }}>
                                {entry.simpleActivity}
                              </div>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {searchResults.inventory.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: DS.textMuted, marginBottom: 6 }}>
                      재고 교구 ({searchResults.inventory.length}건{searchResults.inventory.length >= 12 ? "+" : ""})
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {searchResults.inventory.map(item => (
                        <li key={item.id}>
                          <span style={{
                            display: "inline-block", padding: "6px 10px", borderRadius: 999,
                            background: "#ecfdf5", color: DS.primary, fontSize: 12, fontWeight: 600,
                          }}>
                            {item.name}
                            {item.code ? ` (${item.code})` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: DS.textMuted }}>
            순환 배정된 교구와 재고 목록을 검색합니다. 결과를 누르면 해당 알파벳·주차로 이동합니다.
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {ROTATION_LETTERS.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => { setLetter(l); setDrafts({}); }}
            style={{
              width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 800, fontSize: 15, fontFamily: "inherit",
              background: letter === l ? DS.primary : "#f3f4f6",
              color: letter === l ? "#fff" : DS.textSecondary,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TARGET_TYPES.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setDrafts({}); }}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 14, fontFamily: "inherit",
              background: tab === t ? DS.primary : "#f3f4f6",
              color: tab === t ? "#fff" : DS.textSecondary,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: DS.textSecondary }}>불러오는 중...</div>}
      {!loading && error && (
        <div style={{ ...card, padding: 24, color: DS.danger, textAlign: "center" }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          <datalist id="gear-rotation-item-options">
            {itemOptions.map(opt => (
              <option key={opt.id} value={opt.name}>{opt.code ? `${opt.code}` : opt.name}</option>
            ))}
          </datalist>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rowsForView.map(({ weekNumber, row }) => {
            const mw = weeksMap.get(weekNumber);
            const draft = getDraft(weekNumber, row);
            const conflicts = lettersConflictingForItem(weeklyLists, rotationSchedule, monthKey, {
              targetType: tab,
              itemName: draft.item_name,
              excludeLetter: letter,
            });
            return (
              <WeekRow
                key={weekNumber}
                weekNumber={weekNumber}
                row={row}
                draft={draft}
                dateRange={mw ? formatWeekRange(mw.week_start_date, mw.week_end_date) : null}
                items={items}
                conflictLetters={conflicts}
                monthKeyLabel={monthKey.slice(0, 7)}
                highlighted={highlightWeek === weekNumber}
                saving={savingWeek === weekNumber}
                onDraftChange={patch => setDraft(weekNumber, patch)}
                onSave={() => saveWeek(weekNumber, row)}
                onDelete={deleteRow}
                onRegister={setRegisterName}
              />
            );
          })}
          </div>
        </>
      )}
    </PageShell>
  );
}
