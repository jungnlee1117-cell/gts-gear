import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  PRONUNCIATION_CATEGORIES,
  PRONUNCIATION_TIPS,
  PRONUNCIATION_GENERAL_TIPS,
} from "./pronunciationTipsData.js";

function tipKey(tip, index) {
  return `${tip.cat}-${tip.written}-${index}`;
}

export default function PronunciationTipsApp({ onBack }) {
  const [activeCat, setActiveCat] = useState(PRONUNCIATION_CATEGORIES[0].id);

  const counts = useMemo(() => {
    const map = {};
    for (const cat of PRONUNCIATION_CATEGORIES) {
      map[cat.id] = PRONUNCIATION_TIPS.filter(t => t.cat === cat.id).length;
    }
    return map;
  }, []);

  const filtered = useMemo(
    () => PRONUNCIATION_TIPS.filter(t => t.cat === activeCat),
    [activeCat],
  );

  const activeCategory = PRONUNCIATION_CATEGORIES.find(c => c.id === activeCat);

  return (
    <div className="pron-tips">
      <header className="pron-tips-header">
        <button type="button" className="pron-tips-back" onClick={onBack}>
          <ChevronLeft size={18} strokeWidth={2.5}/>
          뒤로가기
        </button>
        <div className="pron-tips-header-text">
          <h1 className="pron-tips-title">발음 팁</h1>
          <p className="pron-tips-subtitle">자연스러운 영어 발음으로 수업하기</p>
        </div>
      </header>

      <div className="pron-tips-tabs-wrap">
        <div className="pron-tips-tabs" role="tablist" aria-label="발음 팁 카테고리">
          {PRONUNCIATION_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCat === cat.id}
              className={`pron-tips-tab${activeCat === cat.id ? " active" : ""}`}
              onClick={() => setActiveCat(cat.id)}
            >
              <span className="pron-tips-tab-icon" aria-hidden>{cat.icon}</span>
              {cat.label}
              <span className="pron-tips-tab-count">{counts[cat.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {activeCategory ? (
        <p className="pron-tips-cat-desc">{activeCategory.icon} {activeCategory.label} 패턴</p>
      ) : null}

      <main className="pron-tips-main">
        {filtered.length === 0 ? (
          <p className="pron-tips-empty">이 카테고리에 등록된 팁이 없습니다.</p>
        ) : (
          <div className="pron-tips-list">
            {filtered.map((tip, index) => (
              <article key={tipKey(tip, index)} className="pron-tips-card">
                <p className="pron-tips-written">{tip.written}</p>
                <p className="pron-tips-natural">{tip.natural}</p>
                <p className="pron-tips-pron">{tip.pron}</p>
                <p className="pron-tips-note">{tip.note}</p>
                {tip.usedIn ? (
                  <span className="pron-tips-used-in">{tip.usedIn}</span>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <section className="pron-tips-general" aria-label="일반 발음 팁">
          <h2 className="pron-tips-general-title">일반 팁</h2>
          <div className="pron-tips-general-list">
            {PRONUNCIATION_GENERAL_TIPS.map(tip => (
              <div key={tip.title} className="pron-tips-general-item">
                <h3 className="pron-tips-general-item-title">{tip.title}</h3>
                <p className="pron-tips-general-item-desc">{tip.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
