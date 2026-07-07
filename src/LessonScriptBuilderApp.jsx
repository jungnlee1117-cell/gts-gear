import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  FileText,
  Layers,
  Printer,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import EnglishProgramLayout from "./EnglishProgramLayout.jsx";
import { useEnglishProgramNavigate } from "./useEnglishProgramNavigate.js";
import {
  GAME_ACTIVITIES,
  LESSON_SCRIPT_LEVELS,
  WARMUP_ACTIVITIES,
  WARMUP_SETS,
} from "./lessonScriptBuilderData.js";
import { composeLessonScript } from "./lessonScriptCompose.js";
import { GEAR_CATALOG } from "./gearScriptMeta.js";
import {
  deleteSavedLessonScript,
  getSavedLessonScript,
  listSavedLessonScripts,
  saveLessonScript,
} from "./lessonScriptStorage.js";

function StepSection({ step, title, desc, children }) {
  return (
    <section className="lsb-step" aria-labelledby={`lsb-step-${step}`}>
      <header className="lsb-step__head">
        <span className="lsb-step__num">{step}</span>
        <div>
          <h2 id={`lsb-step-${step}`} className="lsb-step__title">{title}</h2>
          {desc ? <p className="lsb-step__desc">{desc}</p> : null}
        </div>
      </header>
      <div className="lsb-step__cards">{children}</div>
    </section>
  );
}

function SelectCard({ selected, onClick, title, desc, badge }) {
  return (
    <button
      type="button"
      className={`lsb-card${selected ? " lsb-card--selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {selected ? <Check size={16} className="lsb-card__check" aria-hidden/> : null}
      {badge ? <span className="lsb-card__badge">{badge}</span> : null}
      <span className="lsb-card__title">{title}</span>
      {desc ? <span className="lsb-card__desc">{desc}</span> : null}
    </button>
  );
}

function PreviewSection({ section }) {
  if (section.parts?.length) {
    return (
      <div className="lsb-preview-section">
        <h3 className="lsb-preview-section__title">{section.title}</h3>
        {section.subtitle ? <p className="lsb-preview-section__sub">{section.subtitle}</p> : null}
        {section.parts.map(part => (
          <div key={part.label} className="lsb-preview-part">
            <h4 className="lsb-preview-part__label">{part.label}</h4>
            <pre className="lsb-preview-part__text">{part.text}</pre>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="lsb-preview-section">
      <h3 className="lsb-preview-section__title">{section.title}</h3>
      {section.subtitle ? <p className="lsb-preview-section__sub">{section.subtitle}</p> : null}
      <pre className="lsb-preview-part__text">{section.text}</pre>
    </div>
  );
}

export default function LessonScriptBuilderApp({ onBack, onGoMain }) {
  const onNavigate = useEnglishProgramNavigate();

  const [warmupSetId, setWarmupSetId] = useState(WARMUP_SETS[0]?.id || "");
  const [warmupActivityId, setWarmupActivityId] = useState("");
  const [gearId, setGearId] = useState("");
  const [gameId, setGameId] = useState("");
  const [levelId, setLevelId] = useState("foundation");
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [generated, setGenerated] = useState(false);

  const gearOptions = useMemo(
    () => GEAR_CATALOG.map(g => ({ id: g.id, label: g.label, desc: g.desc })),
    [],
  );

  const composed = useMemo(
    () => composeLessonScript({
      warmupSetId,
      warmupActivityId: warmupActivityId || null,
      gearId: gearId || null,
      gameId: gameId || null,
      levelId,
    }),
    [warmupSetId, warmupActivityId, gearId, gameId, levelId],
  );

  const refreshSaved = useCallback(() => {
    setSavedList(listSavedLessonScripts());
  }, []);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  const loadSaved = (id) => {
    const row = getSavedLessonScript(id);
    if (!row) return;
    setEditingId(row.id);
    setTitle(row.title);
    setWarmupSetId(row.warmupSetId || WARMUP_SETS[0]?.id || "");
    setWarmupActivityId(row.warmupActivityId || "");
    setGearId(row.gearId || "");
    setGameId(row.gameId || "");
    setLevelId(row.levelId || "foundation");
    setGenerated(true);
    setShowSaved(false);
  };

  const handleGenerate = () => {
    if (!warmupSetId) {
      alert("1단계 인사 & 워밍업 세트를 선택해 주세요.");
      return;
    }
    if (!gearId) {
      alert("3단계 교구 수업을 선택해 주세요.");
      return;
    }
    setGenerated(true);
  };

  const handleSave = () => {
    if (!generated) {
      alert("먼저 완성 대본을 생성해 주세요.");
      return;
    }
    const defaultTitle = gearOptions.find(g => g.id === gearId)?.label;
    const row = saveLessonScript({
      id: editingId,
      title: title || `${defaultTitle || "수업"} 대본`,
      warmupSetId,
      warmupActivityId: warmupActivityId || null,
      gearId,
      gameId: gameId || null,
      levelId,
      fullText: composed.fullText,
      sections: composed.sections,
    });
    setEditingId(row.id);
    setTitle(row.title);
    refreshSaved();
    alert("저장되었습니다.");
  };

  const handleDelete = (id) => {
    if (!confirm("이 저장 대본을 삭제할까요?")) return;
    deleteSavedLessonScript(id);
    if (editingId === id) setEditingId(null);
    refreshSaved();
  };

  const handlePrint = () => {
    if (!generated) {
      alert("먼저 완성 대본을 생성해 주세요.");
      return;
    }
    window.print();
  };

  const printTitle = title || gearOptions.find(g => g.id === gearId)?.label || "수업 대본";

  return (
    <EnglishProgramLayout
      activeId="lesson-script-builder"
      onBack={onBack}
      onGoMain={onGoMain}
      onNavigate={onNavigate}
      mainClassName="lsb-main-wrap"
    >
      <div className="lsb-page eng-program-page no-print">
        <header className="lsb-header">
          <div className="lsb-header__text">
            <h1 className="lsb-header__title">
              <Layers size={22} strokeWidth={2.25} aria-hidden/>
              수업 대본 만들기
            </h1>
            <p className="lsb-header__desc">
              1~4단계 모듈을 선택하면 하나의 완성된 수업 대본이 자동으로 만들어집니다.
            </p>
          </div>
          <div className="lsb-header__actions">
            <button
              type="button"
              className="lsb-btn lsb-btn--ghost"
              onClick={() => setShowSaved(v => !v)}
            >
              <FileText size={16}/>
              저장 목록
            </button>
          </div>
        </header>

        {showSaved ? (
          <section className="lsb-saved-panel">
            <div className="lsb-saved-panel__head">
              <h2>저장된 대본</h2>
              <button type="button" className="lsb-btn lsb-btn--ghost lsb-btn--sm" onClick={() => setShowSaved(false)}>
                닫기
              </button>
            </div>
            {savedList.length === 0 ? (
              <p className="lsb-muted">저장된 대본이 없습니다.</p>
            ) : (
              <ul className="lsb-saved-list">
                {savedList.map(row => (
                  <li key={row.id} className="lsb-saved-item">
                    <button type="button" className="lsb-saved-item__main" onClick={() => loadSaved(row.id)}>
                      <strong>{row.title}</strong>
                      <span>{new Date(row.updatedAt).toLocaleString("ko-KR")}</span>
                    </button>
                    <button
                      type="button"
                      className="lsb-saved-item__delete"
                      aria-label="삭제"
                      onClick={() => handleDelete(row.id)}
                    >
                      <Trash2 size={15}/>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <div className="lsb-layout">
          <div className="lsb-selectors">
            <StepSection
              step={1}
              title="인사 & 워밍업 세트"
              desc="입장 · 인사/소개 · 몸풀기 · 착석이 한 세트로 이어집니다."
            >
              {WARMUP_SETS.map(set => (
                <SelectCard
                  key={set.id}
                  selected={warmupSetId === set.id}
                  onClick={() => setWarmupSetId(set.id)}
                  title={set.label}
                  desc={set.desc}
                  badge="세트"
                />
              ))}
            </StepSection>

            <StepSection
              step={2}
              title="준비운동"
              desc="선택 후 교구 소개 대본이 자동으로 이어집니다."
            >
              <SelectCard
                selected={!warmupActivityId}
                onClick={() => setWarmupActivityId("")}
                title="준비운동 생략"
                desc="교구 소개로 바로 이동"
              />
              {WARMUP_ACTIVITIES.map(item => (
                <SelectCard
                  key={item.id}
                  selected={warmupActivityId === item.id}
                  onClick={() => setWarmupActivityId(item.id)}
                  title={item.label}
                  desc={item.text ? "대본 등록됨" : "대본 추가 예정"}
                />
              ))}
            </StepSection>

            <StepSection
              step={3}
              title="교구 수업"
              desc="기존 교구 대본 데이터를 불러옵니다."
            >
              <div className="lsb-level-row">
                {LESSON_SCRIPT_LEVELS.map(level => (
                  <button
                    key={level.id}
                    type="button"
                    className={`lsb-level-btn${levelId === level.id ? " active" : ""}`}
                    onClick={() => setLevelId(level.id)}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
              {gearOptions.map(gear => (
                <SelectCard
                  key={gear.id}
                  selected={gearId === gear.id}
                  onClick={() => setGearId(gear.id)}
                  title={gear.label}
                  desc={gear.desc}
                />
              ))}
            </StepSection>

            <StepSection step={4} title="게임 활동" desc="선택 사항 · 게임별 대본은 추후 추가됩니다.">
              <SelectCard
                selected={!gameId}
                onClick={() => setGameId("")}
                title="게임 생략"
                desc="교구 수업으로 마무리"
              />
              {GAME_ACTIVITIES.map(game => (
                <SelectCard
                  key={game.id}
                  selected={gameId === game.id}
                  onClick={() => setGameId(game.id)}
                  title={game.label}
                  desc={game.text ? "대본 등록됨" : "대본 추가 예정"}
                />
              ))}
            </StepSection>

            <div className="lsb-actions">
              <button type="button" className="lsb-btn lsb-btn--primary" onClick={handleGenerate}>
                <Sparkles size={16}/>
                완성 대본 생성
              </button>
              <label className="lsb-title-field">
                <span>대본 제목</span>
                <input
                  className="lsb-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="예: 7월 1주차 에어브릿지 수업"
                />
              </label>
              <button type="button" className="lsb-btn lsb-btn--secondary" onClick={handleSave}>
                <Save size={16}/>
                저장하기
              </button>
              <button type="button" className="lsb-btn lsb-btn--secondary" onClick={handlePrint}>
                <Printer size={16}/>
                인쇄 / PDF
              </button>
            </div>
          </div>

          <aside className="lsb-preview" aria-live="polite">
            <header className="lsb-preview__head">
              <h2>실시간 미리보기</h2>
              <p className="lsb-muted">선택한 모듈이 아래 순서로 합쳐집니다.</p>
            </header>
            {composed.sections.length === 0 ? (
              <p className="lsb-muted">모듈을 선택하면 미리보기가 표시됩니다.</p>
            ) : (
              composed.sections.map(section => (
                <PreviewSection key={section.key} section={section}/>
              ))
            )}
          </aside>
        </div>
      </div>

      <div className="lsb-print-area print-only" aria-hidden={!generated}>
        <header className="lsb-print-header">
          <h1>{printTitle}</h1>
          <p>
            생성일: {new Date().toLocaleDateString("ko-KR")}
            {levelId ? ` · ${LESSON_SCRIPT_LEVELS.find(l => l.id === levelId)?.label}` : ""}
          </p>
        </header>
        {composed.sections.map(section => (
          <PreviewSection key={`print-${section.key}`} section={section}/>
        ))}
      </div>
    </EnglishProgramLayout>
  );
}
