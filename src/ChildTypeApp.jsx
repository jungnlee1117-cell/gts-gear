import { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, HelpCircle, Lightbulb, TrendingUp, Ban, ListOrdered,
} from "lucide-react";
import { CHILD_TYPES } from "./childTypesData.js";
import { GTS_ICON_STROKE, TYPE_ICONS } from "./childTypeIcons.js";
import EnglishProgramLayout from "./EnglishProgramLayout.jsx";
import { useEnglishProgramNavigate } from "./useEnglishProgramNavigate.js";

function TypeIcon({ typeId, size = 20 }) {
  const Icon = TYPE_ICONS[typeId];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={GTS_ICON_STROKE} aria-hidden />;
}

function IconBox({ children, size = "md" }) {
  return (
    <div className={`ct-icon-box ct-icon-box--${size}`} aria-hidden>
      {children}
    </div>
  );
}

function TagList({ tags }) {
  return (
    <ul className="ct-tags">
      {tags.map(tag => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="ct-section-head">
      <IconBox size="sm">
        <Icon size={18} strokeWidth={GTS_ICON_STROKE}/>
      </IconBox>
      <h2 className="ct-section-title">{title}</h2>
    </div>
  );
}

function TypeListView({ onSelect }) {
  return (
    <div className="child-type eng-program-page">
      <header className="ct-header ct-header--page">
        <div className="ct-header-text">
          <h1 className="ct-header-title">아이 유형별 가이드</h1>
          <p className="ct-header-sub">현장 선생님을 위한 {CHILD_TYPES.length}가지 유형 매뉴얼</p>
        </div>
      </header>

      <main className="ct-main">
        <div className="ct-list">
          {CHILD_TYPES.map(type => (
            <button
              key={type.id}
              type="button"
              className="ct-card ct-list-card"
              onClick={() => onSelect(type.id)}
            >
              <div className="ct-list-card-top">
                <IconBox size="md">
                  <TypeIcon typeId={type.id} size={20}/>
                </IconBox>
                <div className="ct-list-card-body">
                  <span className="ct-list-card-title">{type.title} 아이</span>
                  <span className="ct-list-card-sub">{type.subtitle}</span>
                </div>
                <ChevronRight size={18} strokeWidth={GTS_ICON_STROKE} className="ct-list-card-arrow"/>
              </div>
              <TagList tags={type.features.slice(0, 3)}/>
              <p className="ct-list-card-meta">난이도 {type.difficulty}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function TypeDetailView({ type, onBack }) {
  return (
    <div className="child-type">
      <header className="ct-header">
        <button type="button" className="ct-back" onClick={onBack}>
          <ChevronLeft size={18} strokeWidth={GTS_ICON_STROKE}/>
          목록으로
        </button>
        <div className="ct-header-text">
          <h1 className="ct-header-title">아이 유형별 가이드</h1>
        </div>
      </header>

      <main className="ct-detail">
        <article className="ct-card ct-hero">
          <div className="ct-hero-top">
            <IconBox size="lg">
              <TypeIcon typeId={type.id} size={24}/>
            </IconBox>
            <div className="ct-hero-text">
              <span className="ct-hero-badge">{type.title}</span>
              <h2 className="ct-hero-title">{type.title} 아이</h2>
              <p className="ct-hero-sub">{type.subtitle}</p>
            </div>
          </div>
          <p className="ct-hero-desc">{type.description}</p>
          <TagList tags={type.features}/>
          <div className="ct-hero-meta">
            <span>발생 빈도 {type.frequency}</span>
            <span>지도 난이도 {type.difficulty}</span>
          </div>
        </article>

        <section className="ct-section">
          <SectionHeader icon={HelpCircle} title="왜 이런 성향이 나타날까요?"/>
          <div className="ct-card ct-card-body">
            <p className="ct-prose">{type.whyText}</p>
            <TagList tags={type.whyTags}/>
          </div>
        </section>

        <section className="ct-section">
          <SectionHeader icon={ListOrdered} title="이렇게 지도하세요"/>
          <ol className="ct-stack">
            {type.steps.map(step => (
              <li key={step.n} className="ct-card ct-step">
                <span className="ct-step-num" aria-hidden>{step.n}</span>
                <div className="ct-step-body">
                  <p className="ct-step-title">{step.title}</p>
                  <p className="ct-step-desc">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ct-section">
          <SectionHeader icon={Lightbulb} title="베테랑 팁"/>
          <ul className="ct-stack">
            {type.tips.map(tip => (
              <li key={tip.title} className="ct-card ct-tip">
                <p className="ct-tip-title">{tip.title}</p>
                <p className="ct-tip-desc">{tip.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="ct-section">
          <SectionHeader icon={TrendingUp} title="한 달 후 기대 변화"/>
          <ul className="ct-card ct-card-body ct-timeline">
            {type.change.map(item => (
              <li key={item.week} className="ct-timeline-item">
                <span className="ct-timeline-week">{item.week}</span>
                <span className="ct-timeline-text">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ct-section ct-section--danger">
          <SectionHeader icon={Ban} title="절대 하지 말아야 할 것"/>
          <ul className="ct-stack">
            {type.never.map(item => (
              <li key={item.title} className="ct-card ct-danger">
                <p className="ct-danger-title">{item.title}</p>
                <p className="ct-danger-desc">{item.desc}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default function ChildTypeApp({ onBack, onGoMain }) {
  const onNavigate = useEnglishProgramNavigate();
  const [selectedId, setSelectedId] = useState(null);

  const selectedType = useMemo(
    () => CHILD_TYPES.find(type => type.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <EnglishProgramLayout activeId="child-types" onBack={onBack} onGoMain={onGoMain} onNavigate={onNavigate}>
      {selectedType ? (
        <TypeDetailView
          type={selectedType}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <TypeListView onSelect={setSelectedId}/>
      )}
    </EnglishProgramLayout>
  );
}
