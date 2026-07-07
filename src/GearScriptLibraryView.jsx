import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Search, Plus, SlidersHorizontal, Clock, MoreVertical,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import EnglishProgramLayout from "./EnglishProgramLayout.jsx";
import { useGearItems } from "./useGearItems.js";
import {
  ITEM_CATEGORIES,
  matchGearId,
  getGearLevelIds,
  normalizeItemCategory,
  resolveItemPhotoPosition,
} from "./gearScriptMeta.js";
import {
  formatLastUsedLabel,
  getGearScriptLastUsed,
  recordGearScriptUsage,
} from "./gearScriptUsage.js";

const PAGE_SIZE = 10;
const CATEGORY_FILTER_KEYS = ["ALL", ...Object.keys(ITEM_CATEGORIES)];

const LEVEL_BADGE_DEFS = [
  { id: "foundation", label: "K" },
  { id: "mid", label: "1" },
  { id: "interactive", label: "2" },
];

function GearCardPhoto({ item }) {
  const [failed, setFailed] = useState(false);
  if (!item?.photo_url || failed) {
    return <div className="eng-lib-card__photo-empty" aria-hidden />;
  }
  return (
    <img
      src={item.photo_url}
      alt={item.name}
      className="eng-lib-card__photo"
      style={{ objectPosition: resolveItemPhotoPosition(item) }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function LevelBadgeRow({ gearId }) {
  const levelIds = gearId ? getGearLevelIds(gearId) : [];
  return (
    <div className="eng-lib-card__levels">
      {LEVEL_BADGE_DEFS.map(badge => {
        const active = badge.id !== "mid" && levelIds.includes(badge.id);
        return (
          <span
            key={badge.label}
            className={`eng-lib-card__level${active ? " eng-lib-card__level--active" : ""}`}
          >
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}

function GearLibraryCard({ item, onSelect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const gearId = matchGearId(item);
  const hasScript = Boolean(gearId);
  const lastUsed = formatLastUsedLabel(getGearScriptLastUsed(item.id));

  const openScript = () => {
    if (!hasScript) return;
    recordGearScriptUsage(item.id);
    onSelect(gearId);
  };

  return (
    <article
      className={`eng-lib-card${hasScript ? "" : " eng-lib-card--unregistered"}`}
      onClick={hasScript ? openScript : undefined}
      onKeyDown={hasScript ? (e) => { if (e.key === "Enter") openScript(); } : undefined}
      role={hasScript ? "button" : undefined}
      tabIndex={hasScript ? 0 : undefined}
    >
      <div className="eng-lib-card__menu-wrap">
        <button
          type="button"
          className="eng-lib-card__menu-btn"
          aria-label="더보기"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
        >
          <MoreVertical size={16}/>
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              className="eng-lib-card__menu-backdrop"
              aria-label="닫기"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
            />
            <div className="eng-lib-card__menu" onClick={e => e.stopPropagation()}>
              {hasScript ? (
                <button type="button" onClick={() => { setMenuOpen(false); openScript(); }}>
                  대본 보기
                </button>
              ) : (
                <button type="button" disabled>대본 준비중</button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="eng-lib-card__media">
        <GearCardPhoto item={item} />
      </div>

      <div className="eng-lib-card__body">
        <h3 className="eng-lib-card__title">{item.name}</h3>
        <LevelBadgeRow gearId={gearId} />
        {lastUsed ? (
          <p className="eng-lib-card__used">
            <Clock size={12} strokeWidth={2.2} aria-hidden />
            {lastUsed}
          </p>
        ) : (
          <p className="eng-lib-card__used eng-lib-card__used--muted">사용 기록 없음</p>
        )}
      </div>
    </article>
  );
}

function GearLibraryPagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pageNums = [];
  for (let p = 1; p <= Math.min(totalPages, 5); p += 1) pageNums.push(p);

  return (
    <nav className="eng-lib-pagination" aria-label="페이지">
      <button
        type="button"
        className="eng-lib-pagination__btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="이전 페이지"
      >
        <ChevronLeft size={16}/>
      </button>
      {pageNums.map(p => (
        <button
          key={p}
          type="button"
          className={`eng-lib-pagination__num${p === page ? " active" : ""}`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      {totalPages > 5 && (
        <>
          <span className="eng-lib-pagination__ellipsis">…</span>
          <button
            type="button"
            className={`eng-lib-pagination__num${totalPages === page ? " active" : ""}`}
            onClick={() => onChange(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        type="button"
        className="eng-lib-pagination__btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="다음 페이지"
      >
        <ChevronRight size={16}/>
      </button>
    </nav>
  );
}

export default function GearScriptLibraryView({ onBack, onGoMain, onSelect, onNavigate, me }) {
  const navigate = useNavigate();
  const { items, loading, error } = useGearItems();
  const [catFilter, setCatFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("registered");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);

  const { registered, unregistered } = useMemo(() => {
    const reg = [];
    const unreg = [];
    for (const item of items) {
      if (matchGearId(item)) reg.push(item);
      else unreg.push(item);
    }
    return { registered: reg, unregistered: unreg };
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts = { ALL: items.length };
    for (const key of Object.keys(ITEM_CATEGORIES)) counts[key] = 0;
    for (const item of items) {
      const key = normalizeItemCategory(item.category);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const base = tab === "registered" ? registered : unregistered;
    let list = [...base];

    if (catFilter !== "ALL") {
      list = list.filter(item => normalizeItemCategory(item.category) === catFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(item =>
        item.name.toLowerCase().includes(q)
        || (item.alias || "").toLowerCase().includes(q),
      );
    }
    if (levelFilter !== "all" && tab === "registered") {
      list = list.filter(item => {
        const gearId = matchGearId(item);
        return gearId && getGearLevelIds(gearId).includes(levelFilter);
      });
    }

    if (sortBy === "recent") {
      list.sort((a, b) => {
        const ta = getGearScriptLastUsed(a.id);
        const tb = getGearScriptLastUsed(b.id);
        if (ta && tb) return new Date(tb) - new Date(ta);
        if (ta) return -1;
        if (tb) return 1;
        return a.name.localeCompare(b.name, "ko");
      });
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }
    return list;
  }, [tab, registered, unregistered, catFilter, search, levelFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    setPage(1);
  }, [tab, catFilter, search, levelFilter, sortBy]);

  const handleSelect = (gearId) => {
    const item = items.find(i => matchGearId(i) === gearId);
    if (item) recordGearScriptUsage(item.id);
    onSelect(gearId);
  };

  return (
    <EnglishProgramLayout
      activeId="gear-scripts"
      onBack={onBack}
      onGoMain={onGoMain}
      onNavigate={onNavigate}
      me={me}
      mainClassName="eng-script-library"
    >
      <main className="eng-lib-main">
        <header className="eng-lib-header">
          <div className="eng-lib-header__text">
            <h1 className="eng-lib-header__title">
              <BookOpen size={22} strokeWidth={2.2} aria-hidden />
              교구 대본
            </h1>
            <p className="eng-lib-header__desc">
              교구에 맞는 영어 수업 대본을 쉽고 빠르게 찾아보세요.
            </p>
          </div>
          <button
            type="button"
            className="eng-lib-header__create"
            onClick={() => navigate("/lesson-script-builder")}
          >
            <Plus size={16} strokeWidth={2.5}/>
            새 대본 만들기
          </button>
        </header>

        <div className="eng-lib-toolbar">
          <div className="eng-lib-search-wrap">
            <Search size={18} className="eng-lib-search-icon" aria-hidden/>
            <input
              type="search"
              className="eng-lib-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="교구명 검색 (예: 에어브릿지, 무지개스톤)"
              aria-label="교구명 검색"
            />
          </div>
          <select
            className="eng-lib-select"
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
            aria-label="레벨 필터"
          >
            <option value="all">전체 레벨</option>
            <option value="foundation">Foundation (K)</option>
            <option value="interactive">Interactive (2)</option>
          </select>
          <button type="button" className="eng-lib-filter-btn" aria-label="필터">
            <SlidersHorizontal size={16}/>
            필터
          </button>
        </div>

        <div className="eng-lib-tabs-row">
          <div className="eng-lib-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "registered"}
              className={`eng-lib-tab${tab === "registered" ? " active" : ""}`}
              onClick={() => setTab("registered")}
            >
              전체 교구 대본
              <span className="eng-lib-tab-badge">{registered.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "unregistered"}
              className={`eng-lib-tab${tab === "unregistered" ? " active" : ""}`}
              onClick={() => setTab("unregistered")}
            >
              미등록 교구 대본
              <span className="eng-lib-tab-badge">{unregistered.length}</span>
            </button>
          </div>
          <select
            className="eng-lib-select eng-lib-sort"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="정렬"
          >
            <option value="recent">최신 사용순</option>
            <option value="name">이름순</option>
          </select>
        </div>

        <div className="eng-lib-cat-filters" role="tablist" aria-label="카테고리">
          {CATEGORY_FILTER_KEYS.map(key => {
            const label = key === "ALL" ? "전체" : (ITEM_CATEGORIES[key]?.label || key);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={catFilter === key}
                className={`eng-lib-cat${catFilter === key ? " active" : ""}`}
                onClick={() => setCatFilter(key)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="eng-lib-loading">
            <Loader2 size={28} className="ab-listen-spin" aria-hidden/>
            <p>교구 목록 불러오는 중...</p>
          </div>
        ) : error ? (
          <p className="eng-lib-empty" role="alert">교구 목록을 불러오지 못했습니다. ({error})</p>
        ) : filteredItems.length === 0 ? (
          <p className="eng-lib-empty">
            {tab === "registered" ? "등록된 교구 대본이 없습니다." : "미등록 교구가 없습니다."}
          </p>
        ) : (
          <>
            <div className="eng-lib-grid">
              {pageItems.map(item => (
                <GearLibraryCard key={item.id} item={item} onSelect={handleSelect} />
              ))}
            </div>
            <GearLibraryPagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </main>
    </EnglishProgramLayout>
  );
}
