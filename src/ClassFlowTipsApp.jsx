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
  const [activeCat, setActiveCat] = useState("greeting");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [favorites, setFavorites] = useState(loadFavorites);

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
    () => activities.find(a => a.id === selectedId) ?? filtered[0] ?? null,
    [selectedId, filtered],
  );

  useEffect(() => {
    if (filtered.length > 0 && !filtered.find(a => a.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const activeLabel = TIP_CATEGORIES.find(c => c.id === activeCat)?.label ?? "";

  return (
    <div className="flow-tips">
      <header className="ft-header">
        <button type="button" className="ft-back" onClick={onBack}>
          <ChevronLeft size={18} strokeWidth={GTS_ICON_STROKE}/>
          뒤로가기
        </button>
        <div className="ft-header-text">
          <h1 className="ft-header-title">수업 흐름 팁</h1>
          <p className="ft-header-sub">실전 수업 활동 라이브러리 · {counts.all}개 활동</p>
        </div>
      </header>

      <div className="ft-cat-bar-wrap">
        <div className="ft-cat-bar" role="tablist" aria-label="수업 흐름 카테고리">
          {TIP_CATEGORIES.map(cat => {
            const CatIcon = CAT_ICONS[cat.id];
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCat === cat.id}
                className={`ft-cat-pill${activeCat === cat.id ? " active" : ""}`}
                onClick={() => {
                  setActiveCat(cat.id);
                  setSearch("");
                  setTypeFilter("all");
                }}
              >
                {CatIcon && <CatIcon size={15} strokeWidth={GTS_ICON_STROKE}/>}
                <span>{cat.label}</span>
                <span className="ft-cat-pill-count">{counts[cat.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ft-layout">
        {/* 좌측: 카테고리 메뉴 */}
        <aside className="ft-sidebar">
          <nav className="ft-side-nav" aria-label="카테고리">
            {TIP_CATEGORIES.map(cat => {
              const CatIcon = CAT_ICONS[cat.id];
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`ft-side-item${activeCat === cat.id ? " active" : ""}`}
                  onClick={() => {
                    setActiveCat(cat.id);
                    setSearch("");
                    setTypeFilter("all");
                  }}
                >
                  {CatIcon && <CatIcon size={18} strokeWidth={GTS_ICON_STROKE}/>}
                  <span className="ft-side-item-label">{cat.label}</span>
                  <span className="ft-side-item-count">{counts[cat.id]}</span>
                </button>
              );
            })}
          </nav>
          <div className="ft-side-tip">
            <Lightbulb size={16} strokeWidth={GTS_ICON_STROKE}/>
            <p>아이들 컨디션에 맞춰 활동을 조합하세요. 에너지가 높으면 활동형, 낮으면 리듬·음악 활동을 추천합니다.</p>
          </div>
        </aside>

        {/* 중앙: 활동 리스트 */}
        <section className="ft-list-panel">
          <div className="ft-list-toolbar">
            <div className="ft-search-wrap">
              <Search size={17} strokeWidth={GTS_ICON_STROKE}/>
              <input
                type="search"
                className="ft-search"
                placeholder={`${activeLabel} 활동 검색...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="ft-filter-wrap">
              <label className="ft-filter-label" htmlFor="ft-type-filter">유형</label>
              <div className="ft-select-wrap">
                <select
                  id="ft-type-filter"
                  className="ft-select"
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                >
                  <option value="all">전체</option>
                  {TYPE_TAGS.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <ChevronDown size={16} strokeWidth={GTS_ICON_STROKE} className="ft-select-icon"/>
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
                        <Star size={18} strokeWidth={GTS_ICON_STROKE}/>
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {/* 우측: 활동 상세 */}
        <section className="ft-detail-panel" aria-live="polite">
          {selected ? (
            <div className="ft-detail">
              <div className="ft-detail-head">
                <div className="ft-detail-head-top">
                  <IconBox size="lg">
                    <ActivityIcon name={selected.icon} size={24}/>
                  </IconBox>
                  <div className="ft-detail-head-text">
                    <h2 className="ft-detail-title">{selected.title}</h2>
                    <TagList tags={selected.tags}/>
                  </div>
                  <button
                    type="button"
                    className={`ft-fav-btn ft-fav-btn--lg${favorites.includes(selected.id) ? " on" : ""}`}
                    onClick={e => toggleFavorite(selected.id, e)}
                    aria-label="즐겨찾기"
                  >
                    <Star size={22} strokeWidth={GTS_ICON_STROKE}/>
                  </button>
                </div>
                <p className="ft-detail-desc">{selected.description}</p>
              </div>

              <div className="ft-detail-section">
                <div className="ft-section-head">
                  <IconBox size="sm">
                    <ListOrdered size={18} strokeWidth={GTS_ICON_STROKE}/>
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

              <div className="ft-detail-section">
                <div className="ft-section-head">
                  <IconBox size="sm">
                    <CheckCircle2 size={18} strokeWidth={GTS_ICON_STROKE}/>
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
                    <Lightbulb size={18} strokeWidth={GTS_ICON_STROKE}/>
                  </IconBox>
                  <h3 className="ft-section-title">활용 팁</h3>
                </div>
                <ul className="ft-bullets">
                  {selected.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>

              <div className="ft-info-grid">
                <div className="ft-info-item">
                  <Clock size={18} strokeWidth={GTS_ICON_STROKE}/>
                  <div>
                    <span className="ft-info-label">소요시간</span>
                    <span className="ft-info-value">{selected.info.duration}</span>
                  </div>
                </div>
                <div className="ft-info-item">
                  <Users size={18} strokeWidth={GTS_ICON_STROKE}/>
                  <div>
                    <span className="ft-info-label">추천연령</span>
                    <span className="ft-info-value">{selected.info.age}</span>
                  </div>
                </div>
                <div className="ft-info-item">
                  <Layers size={18} strokeWidth={GTS_ICON_STROKE}/>
                  <div>
                    <span className="ft-info-label">활동유형</span>
                    <span className="ft-info-value">{selected.info.type}</span>
                  </div>
                </div>
                <div className="ft-info-item">
                  <Package size={18} strokeWidth={GTS_ICON_STROKE}/>
                  <div>
                    <span className="ft-info-label">준비물</span>
                    <span className="ft-info-value">{selected.info.materials}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="ft-detail-empty">
              <p>활동을 선택하면 상세 내용이 표시됩니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
