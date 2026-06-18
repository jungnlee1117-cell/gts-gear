import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, Search, Star, ListOrdered, CheckCircle2,
  Lightbulb, Clock, Users, Layers, Package, ChevronDown,
} from "lucide-react";
import { activities, TIP_CATEGORIES, getCategoryCounts } from "./tipsData.js";
import { CAT_ICONS, GTS_ICON_STROKE, TIP_ICONS } from "./tipsIcons.js";

const FAV_KEY = "gts-flow-tips-favorites";
const TYPE_TAGS = ["활동적", "협동", "신체활동", "영어", "집중", "게임형", "이완", "노하우"];

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function ActivityIcon({ name, size = 20 }) {
  const Icon = TIP_ICONS[name] ?? Lightbulb;
  return <Icon size={size} strokeWidth={GTS_ICON_STROKE} aria-hidden />;
}

function IconBox({ children, size = "md" }) {
  return (
    <div className={`ft-icon-box ft-icon-box--${size}`} aria-hidden>
      {children}
    </div>
  );
}

function TagList({ tags }) {
  return (
    <ul className="ft-tags">
      {tags.map(tag => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}

export default function ClassFlowTipsApp({ onBack }) {
  const counts = useMemo(() => getCategoryCounts(), []);
  const [activeCat, setActiveCat] = useState(() => {
    const cat = new URLSearchParams(window.location.search).get("cat");
    return TIP_CATEGORIES.some(c => c.id === cat) ? cat : "greeting";
  });
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [favorites, setFavorites] = useState(loadFavorites);

  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get("cat");
    if (cat && TIP_CATEGORIES.some(c => c.id === cat)) {
      setActiveCat(cat);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = useCallback((id, e) => {
    e?.stopPropagation();
    setFavorites(prev => (
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    ));
  }, []);

  const filtered = useMemo(() => {
    let list = activities.filter(a => a.cat === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q)
        || a.summary.toLowerCase().includes(q)
        || a.tags.some(t => t.toLowerCase().includes(q)),
      );
    }
    if (typeFilter !== "all") {
      list = list.filter(a => a.tags.includes(typeFilter));
    }
    return list;
  }, [activeCat, search, typeFilter]);

  const selected = useMemo(
    () => filtered.find(a => a.id === selectedId) ?? null,
    [selectedId, filtered],
  );

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId(prev => (
      prev && filtered.some(a => a.id === prev) ? prev : filtered[0].id
    ));
  }, [filtered]);

  const activeLabel = TIP_CATEGORIES.find(c => c.id === activeCat)?.label ?? "";

  const handleCatChange = useCallback((catId) => {
    setActiveCat(catId);
    setSearch("");
    setTypeFilter("all");
    setSelectedId(null);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
  }, []);

  const handleTypeFilterChange = useCallback((value) => {
    setTypeFilter(value);
  }, []);

  return (
    <div className="flow-tips-page">
      <header className="ft-topbar">
        <button type="button" className="ft-topbar-back" onClick={onBack}>
          <ChevronLeft size={16} strokeWidth={2.5}/>
          뒤로가기
        </button>
        <div className="ft-topbar-brand">
          <h1 className="ft-topbar-title">수업 흐름 팁</h1>
          <p className="ft-topbar-desc">실전 활동 라이브러리 · {counts.all}개 활동</p>
        </div>
      </header>

      <nav className="ft-tabs-wrap" aria-label="수업 흐름 카테고리">
        <div className="ft-tabs" role="tablist">
          {TIP_CATEGORIES.map(cat => {
            const CatIcon = CAT_ICONS[cat.id];
            const isActive = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ft-tab${isActive ? " active" : ""}`}
                onClick={() => handleCatChange(cat.id)}
              >
                {CatIcon && <CatIcon size={14} strokeWidth={GTS_ICON_STROKE}/>}
                <span>{cat.label}</span>
                <span className="ft-tab-count">{counts[cat.id]}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="ft-workspace">
        <section className="ft-list-col" aria-label="활동 목록">
          <div className="ft-list-toolbar">
            <div className="ft-search-wrap">
              <Search size={16} strokeWidth={GTS_ICON_STROKE}/>
              <input
                type="search"
                className="ft-search"
                placeholder={`${activeLabel} 활동 검색...`}
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="ft-filter-wrap">
              <label className="ft-filter-label" htmlFor="ft-type-filter">유형</label>
              <div className="ft-select-wrap">
                <select
                  id="ft-type-filter"
                  className="ft-select"
                  value={typeFilter}
                  onChange={e => handleTypeFilterChange(e.target.value)}
                >
                  <option value="all">전체</option>
                  {TYPE_TAGS.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <ChevronDown size={14} strokeWidth={GTS_ICON_STROKE} className="ft-select-icon"/>
              </div>
            </div>
          </div>

          <div className="ft-list-head">
            <h2 className="ft-list-title">{activeLabel}</h2>
            <span className="ft-list-count">{filtered.length}개</span>
          </div>

          <ul className="ft-list">
            {filtered.length === 0 ? (
              <li className="ft-list-empty">검색 결과가 없습니다.</li>
            ) : (
              filtered.map((item, idx) => {
                const isActive = selected?.id === item.id;
                const isFav = favorites.includes(item.id);
                return (
                  <li key={item.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`ft-card${isActive ? " active" : ""}`}
                      onClick={() => setSelectedId(item.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                      aria-pressed={isActive}
                    >
                      <span className="ft-card-num">{String(idx + 1).padStart(2, "0")}</span>
                      <IconBox size="sm">
                        <ActivityIcon name={item.icon} size={18}/>
                      </IconBox>
                      <div className="ft-card-body">
                        <span className="ft-card-title">{item.title}</span>
                        <span className="ft-card-summary">{item.summary}</span>
                        <TagList tags={item.tags.slice(0, 3)}/>
                      </div>
                      <button
                        type="button"
                        className={`ft-fav-btn${isFav ? " on" : ""}`}
                        onClick={e => toggleFavorite(item.id, e)}
                        aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
                      >
                        <Star size={17} strokeWidth={GTS_ICON_STROKE}/>
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section
          className="ft-detail-col"
          aria-label="활동 상세"
          aria-live="polite"
        >
          {selected ? (
            <div className="ft-detail" key={selected.id}>
              <div className="ft-detail-head">
                <div className="ft-detail-head-top">
                  <IconBox size="lg">
                    <ActivityIcon name={selected.icon} size={24}/>
                  </IconBox>
                  <div className="ft-detail-head-text">
                    <p className="ft-detail-cat">{activeLabel}</p>
                    <h2 className="ft-detail-title">{selected.title}</h2>
                    <TagList tags={selected.tags}/>
                  </div>
                  <button
                    type="button"
                    className={`ft-fav-btn ft-fav-btn--lg${favorites.includes(selected.id) ? " on" : ""}`}
                    onClick={e => toggleFavorite(selected.id, e)}
                    aria-label="즐겨찾기"
                  >
                    <Star size={20} strokeWidth={GTS_ICON_STROKE}/>
                  </button>
                </div>
                <p className="ft-detail-desc">{selected.description}</p>
              </div>

              <div className="ft-info-grid">
                <div className="ft-info-item">
                  <Clock size={16} strokeWidth={GTS_ICON_STROKE}/>
                  <div>
                    <span className="ft-info-label">소요시간</span>
                    <span className="ft-info-value">{selected.info.duration}</span>
                  </div>
                </div>
                <div className="ft-info-item">
                  <Users size={16} strokeWidth={GTS_ICON_STROKE}/>
                  <div>
                    <span className="ft-info-label">추천연령</span>
                    <span className="ft-info-value">{selected.info.age}</span>
                  </div>
                </div>
                <div className="ft-info-item">
                  <Layers size={16} strokeWidth={GTS_ICON_STROKE}/>
                  <div>
                    <span className="ft-info-label">활동유형</span>
                    <span className="ft-info-value">{selected.info.type}</span>
                  </div>
                </div>
                <div className="ft-info-item">
                  <Package size={16} strokeWidth={GTS_ICON_STROKE}/>
                  <div>
                    <span className="ft-info-label">준비물</span>
                    <span className="ft-info-value">{selected.info.materials}</span>
                  </div>
                </div>
              </div>

              <div className="ft-detail-section">
                <div className="ft-section-head">
                  <IconBox size="sm">
                    <ListOrdered size={16} strokeWidth={GTS_ICON_STROKE}/>
                  </IconBox>
                  <h3 className="ft-section-title">하는 방법</h3>
                </div>
                <ol className="ft-steps">
                  {selected.steps.map((step, i) => (
                    <li key={i} className="ft-step">
                      <span className="ft-step-num">{i + 1}</span>
                      <span className="ft-step-text">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="ft-detail-columns">
                <div className="ft-detail-section">
                  <div className="ft-section-head">
                    <IconBox size="sm">
                      <CheckCircle2 size={16} strokeWidth={GTS_ICON_STROKE}/>
                    </IconBox>
                    <h3 className="ft-section-title">왜 좋은가?</h3>
                  </div>
                  <ul className="ft-bullets">
                    {selected.benefits.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>

                <div className="ft-detail-section ft-detail-section--soft">
                  <div className="ft-section-head">
                    <IconBox size="sm">
                      <Lightbulb size={16} strokeWidth={GTS_ICON_STROKE}/>
                    </IconBox>
                    <h3 className="ft-section-title">활용 팁</h3>
                  </div>
                  <ul className="ft-bullets">
                    {selected.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="ft-detail-empty">
              <Lightbulb size={32} strokeWidth={1.5}/>
              <p>왼쪽에서 활동을 선택하면 상세 내용이 표시됩니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
