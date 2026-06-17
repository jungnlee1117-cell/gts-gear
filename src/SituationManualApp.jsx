import { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronDown, AlertTriangle, Lightbulb,
} from "lucide-react";
import { CATEGORIES, situations } from "./situationData.js";

const LEVEL_LABEL = {
  new: "신입",
  all: "공통",
};

function itemKey(item) {
  return `${item.cat}-${item.title}`;
}

export default function SituationManualApp({ onBack }) {
  const [activeCat, setActiveCat] = useState("all");
  const [openKey, setOpenKey] = useState(null);

  const counts = useMemo(() => {
    const map = { all: situations.length };
    for (const cat of CATEGORIES) {
      map[cat.id] = situations.filter(s => s.cat === cat.id).length;
    }
    return map;
  }, []);

  const activeCategory = CATEGORIES.find(c => c.id === activeCat);

  const filtered = useMemo(
    () => (activeCat === "all" ? situations : situations.filter(s => s.cat === activeCat)),
    [activeCat],
  );

  const toggleCard = (item) => {
    const key = itemKey(item);
    setOpenKey(prev => (prev === key ? null : key));
  };

  return (
    <div className="sit-manual">
      <header className="sit-manual-header">
        <button type="button" className="sit-manual-back" onClick={onBack}>
          <ChevronLeft size={18} strokeWidth={2.5}/>
          뒤로가기
        </button>
        <div className="sit-manual-header-text">
          <h1 className="sit-manual-title">상황별 대처</h1>
          <p className="sit-manual-subtitle">현장에서 바로 쓰는 대응 매뉴얼</p>
        </div>
      </header>

      <div className="sit-manual-tabs-wrap">
        <div className="sit-manual-tabs" role="tablist" aria-label="상황 카테고리">
          <button
            type="button"
            role="tab"
            aria-selected={activeCat === "all"}
            className={`sit-manual-tab${activeCat === "all" ? " active" : ""}`}
            onClick={() => {
              setActiveCat("all");
              setOpenKey(null);
            }}
          >
            전체
            <span className="sit-manual-tab-count">{counts.all}</span>
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCat === cat.id}
              className={`sit-manual-tab${activeCat === cat.id ? " active" : ""}`}
              onClick={() => {
                setActiveCat(cat.id);
                setOpenKey(null);
              }}
            >
              {cat.label}
              <span className="sit-manual-tab-count">{counts[cat.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {activeCategory && (
        <p className="sit-manual-cat-desc">{activeCategory.desc}</p>
      )}
      {activeCat === "all" && (
        <p className="sit-manual-cat-desc">9개 카테고리, {counts.all}가지 현장 상황별 대응 방법</p>
      )}

      <main className="sit-manual-main">
        {filtered.length === 0 ? (
          <p className="sit-manual-empty">해당 카테고리의 상황이 없습니다.</p>
        ) : (
          filtered.map(item => {
            const key = itemKey(item);
            const isOpen = openKey === key;
            const catLabel = CATEGORIES.find(c => c.id === item.cat)?.label ?? "";

            return (
              <article
                key={key}
                className={`sit-manual-card${isOpen ? " open" : ""}`}
              >
                <button
                  type="button"
                  className="sit-manual-card-trigger"
                  onClick={() => toggleCard(item)}
                  aria-expanded={isOpen}
                >
                  <span className="sit-manual-card-icon" aria-hidden>{item.icon}</span>
                  <span className="sit-manual-card-head">
                    <span className="sit-manual-card-meta">
                      <span className="sit-manual-card-cat">{catLabel}</span>
                      <span className={`sit-manual-card-level sit-manual-card-level--${item.level}`}>
                        {LEVEL_LABEL[item.level] ?? item.level}
                      </span>
                    </span>
                    <span className="sit-manual-card-title">{item.title}</span>
                    <span className="sit-manual-card-preview">{item.preview}</span>
                  </span>
                  <ChevronDown
                    size={20}
                    className="sit-manual-card-chevron"
                    aria-hidden
                  />
                </button>

                {isOpen && (
                  <div className="sit-manual-card-body">
                    <section className="sit-manual-block sit-manual-block--steps">
                      <div className="sit-manual-steps-grid">
                        <h3 className="sit-manual-section-title">대처 순서</h3>
                        <ol className="sit-manual-timeline">
                          {item.steps.map(step => (
                            <li key={step.n} className="sit-manual-step">
                              <span className="sit-manual-step-num" aria-hidden>{step.n}</span>
                              <div className="sit-manual-step-card">
                                <p className="sit-manual-step-main">{step.text}</p>
                                {step.sub && <p className="sit-manual-step-sub">{step.sub}</p>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </section>

                    {(item.warn || item.tip) && (
                      <section className="sit-manual-block sit-manual-block--notes">
                        <h3 className="sit-manual-section-title">주의사항</h3>
                        {item.warn && (
                          <div className="sit-manual-callout sit-manual-callout--warn">
                            <AlertTriangle size={16}/>
                            <p>{item.warn}</p>
                          </div>
                        )}
                        {item.tip && (
                          <div className="sit-manual-callout sit-manual-callout--tip">
                            <Lightbulb size={16}/>
                            <p>{item.tip}</p>
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}
