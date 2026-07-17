import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Box, Clock, Calendar } from "lucide-react";
import {
  buildCurrentRentals,
  buildDueReturns,
  buildGearRecommendations,
  buildNextWeekItems,
  fetchTeacherGearExtras,
  formatShortDate,
} from "./teacherGearStatus.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const PREVIEW_ROWS = 3;

const CARD_THEMES = {
  current: { accent: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  due: { accent: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  recommend: { accent: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
};

function GearStatusCard({
  themeKey,
  icon: Icon,
  title,
  count,
  columns,
  rows,
  emptyText,
  onViewAll,
  renderCell,
}) {
  const theme = CARD_THEMES[themeKey];
  const preview = rows.slice(0, PREVIEW_ROWS);

  return (
    <article className="gear-status-card" style={{ borderColor: theme.border }}>
      <div className="gear-status-card__head">
        <div className="gear-status-card__title-row">
          <span className="gear-status-card__icon" style={{ background: theme.bg, color: theme.accent }}>
            <Icon size={18} strokeWidth={2.2} />
          </span>
          <h3 className="gear-status-card__title">{title}</h3>
          <span className="gear-status-card__count" style={{ background: theme.bg, color: theme.accent }}>
            {count}개
          </span>
        </div>
      </div>

      {preview.length === 0 ? (
        <div className="gear-status-card__empty">{emptyText}</div>
      ) : (
        <div className="gear-status-table-wrap">
          <table className="gear-status-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={row.id || row.itemId || `${title}-${i}`}>
                  {columns.map(col => (
                    <td key={col.key}>{renderCell(col.key, row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="gear-status-card__more" onClick={onViewAll}>
        전체 보기 →
      </button>
    </article>
  );
}

export default function TeacherGearStatusSection({
  me,
  items,
  reqs,
  ris,
  rets,
  setPage,
  onItemClick,
}) {
  const [extras, setExtras] = useState(null);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    const refreshDate = () => setTodayKey(new Date().toDateString());
    const timer = window.setInterval(refreshDate, 60 * 1000);
    window.addEventListener("focus", refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);

  const currentRentals = useMemo(
    () => buildCurrentRentals(me, reqs, ris, items, rets),
    [me, reqs, ris, items, rets, todayKey],
  );

  const dueReturns = useMemo(
    () => buildDueReturns(currentRentals),
    [currentRentals],
  );

  const recommendations = useMemo(
    () => buildGearRecommendations(me, reqs, ris, items),
    [me, reqs, ris, items],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingExtras(true);
    fetchTeacherGearExtras(supabase, me)
      .then(data => {
        if (!cancelled) setExtras(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingExtras(false);
      });
    return () => { cancelled = true; };
  }, [me.id]);

  const nextWeek = useMemo(() => {
    if (!extras) return { rows: [], weekRange: null };
    return buildNextWeekItems({
      schedules: extras.schedules,
      weeklyLists: extras.weeklyLists,
      monthWeeks: extras.monthWeeks,
      weeklySlots: extras.weeklySlots,
      items,
      me,
    });
  }, [extras, items]);

  const nextClassItems = useMemo(() => {
    const merged = [];
    const seen = new Set();

    for (const row of nextWeek.rows) {
      if (seen.has(row.itemId || row.itemName)) continue;
      merged.push({
        itemId: row.itemId,
        itemName: row.itemName,
        reason: row.institution ? `${row.institution} · 다음 주 수업` : "다음 주 수업 예정",
        tone: "next",
      });
      seen.add(row.itemId || row.itemName);
    }

    for (const row of recommendations) {
      if (merged.length >= 6) break;
      if (seen.has(row.itemId)) continue;
      merged.push(row);
      seen.add(row.itemId);
    }

    return merged;
  }, [nextWeek.rows, recommendations]);

  const openItem = (itemId) => {
    if (!itemId || !onItemClick) return;
    const item = items.find(i => i.id === itemId);
    if (item) onItemClick(item);
  };

  return (
    <section className="gear-status-section">
      <div className="gear-status-section__intro">
        <h2 className="gear-status-section__title">내 교구 현황</h2>
        <p className="gear-status-section__sub">
          현재 보유·반납 예정·다음 수업 추천 교구를 한눈에 확인하세요.
        </p>
      </div>

      <div className="gear-status-grid gear-status-grid--three">
        <GearStatusCard
          themeKey="current"
          icon={Box}
          title="현재 대여 교구"
          count={currentRentals.length}
          columns={[
            { key: "itemName", label: "교구명" },
            { key: "rentDate", label: "대여일" },
            { key: "dueDate", label: "반납 예정일" },
          ]}
          rows={currentRentals}
          emptyText="현재 대여 중인 교구가 없습니다."
          onViewAll={() => setPage("my-rental-status")}
          renderCell={(key, row) => {
            if (key === "itemName") {
              return (
                <button type="button" className="gear-status-link" onClick={() => openItem(row.itemId)}>
                  {row.itemName}
                </button>
              );
            }
            if (key === "rentDate") return formatShortDate(row.rentDate);
            if (key === "dueDate") return formatShortDate(row.dueDate);
            return row[key];
          }}
        />

        <GearStatusCard
          themeKey="due"
          icon={Clock}
          title="반납해야 할 교구"
          count={dueReturns.length}
          columns={[
            { key: "itemName", label: "교구명" },
            { key: "dueDate", label: "반납 예정일" },
            { key: "status", label: "상태" },
          ]}
          rows={dueReturns}
          emptyText="곧 반납할 교구가 없습니다."
          onViewAll={() => setPage("return-request")}
          renderCell={(key, row) => {
            if (key === "itemName") {
              return (
                <button type="button" className="gear-status-link" onClick={() => openItem(row.itemId)}>
                  {row.itemName}
                </button>
              );
            }
            if (key === "dueDate") {
              return (
                <span className={row.tone === "danger" ? "gear-status-date--danger" : "gear-status-date--warning"}>
                  {formatShortDate(row.dueDate)}
                </span>
              );
            }
            if (key === "status") {
              return (
                <span className={`gear-status-badge gear-status-badge--${row.tone}`}>
                  {row.status}
                </span>
              );
            }
            return row[key];
          }}
        />

        <GearStatusCard
          themeKey="recommend"
          icon={Calendar}
          title="다음 수업 추천 교구"
          count={nextClassItems.length}
          columns={[
            { key: "itemName", label: "교구명" },
            { key: "reason", label: "추천 이유" },
          ]}
          rows={nextClassItems}
          emptyText={
            loadingExtras
              ? "수업 일정을 불러오는 중..."
              : "추천할 교구가 없습니다."
          }
          onViewAll={() => setPage("my-gear-rotation")}
          renderCell={(key, row) => {
            if (key === "itemName") {
              return row.itemId ? (
                <button type="button" className="gear-status-link" onClick={() => openItem(row.itemId)}>
                  {row.itemName}
                </button>
              ) : row.itemName;
            }
            if (key === "reason") {
              return (
                <span className={row.tone === "popular" ? "gear-status-reason--popular" : "gear-status-reason--muted"}>
                  {row.reason}
                </span>
              );
            }
            return row[key];
          }}
        />
      </div>
    </section>
  );
}
