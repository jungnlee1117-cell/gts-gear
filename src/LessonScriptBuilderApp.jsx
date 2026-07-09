import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  FileText,
  Layers,
  Printer,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import EnglishProgramLayout from "./EnglishProgramLayout.jsx";
import { PE_ADMIN } from "./peMedia/peMediaUtils.js";
import { useEnglishProgramNavigate } from "./useEnglishProgramNavigate.js";
import {
  getGameActivities,
  getWarmupActivities,
  getWarmupSets,
  LESSON_SCRIPT_LEVELS,
} from "./lessonScriptBuilderData.js";
import { LESSON_DIFFICULTIES, difficultyToLevelId } from "./lessonScriptDifficulty.js";
import { composeLessonScript } from "./lessonScriptCompose.js";
import {
  RECOMMEND_AGE_GROUPS,
  RECOMMEND_ATMOSPHERES,
  RECOMMEND_DURATIONS,
  RECOMMEND_KID_COUNTS,
  recommendLessonCombination,
} from "./lessonScriptRecommend.js";
import { GEAR_CATALOG } from "./gearScriptMeta.js";
import {
  deleteSavedLessonScript,
  getSavedLessonScript,
  listSavedLessonScripts,
  saveLessonScript,
} from "./lessonScriptStorage.js";
import { AlternativePhraseButton, EditableScriptBlock } from "./LessonScriptBuilderParts.jsx";
import { useLessonScriptAdminData } from "./useLessonScriptData.js";

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

function altSectionKeyFor(section) {
  if (section.sectionType === "safety") return section.editableKey;
  if (section.sectionType === "game") return "game";
  if (section.sectionType === "warmup-activity") return "warmup-activity";
  return section.sectionType || section.editableKey;
}

function PreviewSection({
  section,
  difficultyId,
  customTexts,
  safetyOverrides,
  onCustomTextChange,
  onSafetyChange,
}) {
  if (section.parts?.length) {
    return (
      <div className="lsb-preview-section">
        <h3 className="lsb-preview-section__title">{section.title}</h3>
        {section.subtitle ? <p className="lsb-preview-section__sub">{section.subtitle}</p> : null}
        {section.parts.map(part => (
          <div key={part.partId || part.label} className="lsb-preview-part">
            <div className="lsb-preview-part__head">
              <h4 className="lsb-preview-part__label">{part.label}</h4>
              <AlternativePhraseButton
                sectionKey={part.partId}
                difficultyId={difficultyId}
                onSelect={text => onCustomTextChange?.(part.partId, text)}
              />
            </div>
            <EditableScriptBlock
              text={customTexts[part.partId] ?? part.text}
              onChange={val => onCustomTextChange?.(part.partId, val)}
              rows={3}
            />
          </div>
        ))}
      </div>
    );
  }

  const editableKey = section.editableKey;
  const isSafety = section.sectionType === "safety";
  const displayText = isSafety
    ? (safetyOverrides[editableKey] ?? section.text)
    : (editableKey && customTexts[editableKey] != null ? customTexts[editableKey] : section.text);

  const applyAltText = (text) => {
    if (isSafety) onSafetyChange?.(editableKey, text);
    else onCustomTextChange?.(editableKey, text);
  };

  return (
    <div className="lsb-preview-section">
      <div className="lsb-preview-part__head">
        <h3 className="lsb-preview-section__title">{section.title}</h3>
        {editableKey ? (
          <AlternativePhraseButton
            sectionKey={altSectionKeyFor(section)}
            contextId={section.contextId}
            difficultyId={difficultyId}
            onSelect={applyAltText}
          />
        ) : null}
      </div>
      {section.subtitle && !section.title.includes(section.subtitle) ? (
        <p className="lsb-preview-section__sub">{section.subtitle}</p>
      ) : null}
      {editableKey ? (
        <EditableScriptBlock
          text={displayText}
          onChange={val => {
            if (isSafety) onSafetyChange?.(editableKey, val);
            else onCustomTextChange?.(editableKey, val);
          }}
          rows={isSafety ? 2 : 4}
        />
      ) : (
        <pre className="lsb-preview-part__text">{section.text}</pre>
      )}
    </div>
  );
}

export default function LessonScriptBuilderApp({ me, onBack, onGoMain }) {
  const onNavigate = useEnglishProgramNavigate();
  const navigate = useNavigate();
  const { ready: adminDataReady, version: adminDataVersion } = useLessonScriptAdminData();
  const warmupSets = getWarmupSets();
  const warmupActivities = getWarmupActivities();
  const gameActivities = getGameActivities();
  const isAdmin = PE_ADMIN(me);
  const userId = me?.id;

  const [warmupSetId, setWarmupSetId] = useState(warmupSets[0]?.id || "");
  const [warmupActivityId, setWarmupActivityId] = useState("");
  const [gearId, setGearId] = useState("");
  const [gameId, setGameId] = useState("");
  const [levelId, setLevelId] = useState("foundation");
  const [difficultyId, setDifficultyId] = useState("medium");
  const [customTexts, setCustomTexts] = useState({});
  const [safetyOverrides, setSafetyOverrides] = useState({});
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [recommendation, setRecommendation] = useState(null);

  const [recAge, setRecAge] = useState("5-6");
  const [recDuration, setRecDuration] = useState("40");
  const [recKids, setRecKids] = useState("medium");
  const [recAtmosphere, setRecAtmosphere] = useState("normal");
  const [recDifficulty, setRecDifficulty] = useState("medium");

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
      difficultyId,
      customTexts,
      safetyOverrides,
    }),
    [warmupSetId, warmupActivityId, gearId, gameId, levelId, difficultyId, customTexts, safetyOverrides, adminDataVersion],
  );

  const refreshSaved = useCallback(async () => {
    if (!userId) {
      setSavedList([]);
      return;
    }
    setSavedLoading(true);
    try {
      const rows = await listSavedLessonScripts(userId);
      setSavedList(rows);
    } finally {
      setSavedLoading(false);
    }
  }, [userId]);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  const handleDifficultyChange = (next) => {
    setDifficultyId(next);
    setLevelId(difficultyToLevelId(next));
    setCustomTexts({});
    setSafetyOverrides({});
  };

  const handleCustomTextChange = (key, value) => {
    setCustomTexts(prev => ({ ...prev, [key]: value }));
  };

  const handleSafetyChange = (key, value) => {
    setSafetyOverrides(prev => ({ ...prev, [key]: value }));
  };

  const loadSaved = async (id) => {
    const row = await getSavedLessonScript(id, userId);
    if (!row) return;
    setEditingId(row.id);
    setTitle(row.title);
    setWarmupSetId(row.warmupSetId || warmupSets[0]?.id || "");
    setWarmupActivityId(row.warmupActivityId || "");
    setGearId(row.gearId || "");
    setGameId(row.gameId || "");
    setLevelId(row.levelId || "foundation");
    setDifficultyId(row.difficultyId || "medium");
    setCustomTexts(row.customTexts || {});
    setSafetyOverrides(row.safetyOverrides || {});
    setGenerated(true);
    setShowSaved(false);
  };

  const handleRecommend = () => {
    const rec = recommendLessonCombination({
      ageGroup: recAge,
      duration: recDuration,
      kidCount: recKids,
      atmosphere: recAtmosphere,
      difficultyId: recDifficulty,
    });
    setRecommendation(rec);
  };

  const applyRecommendation = () => {
    const rec = recommendation || recommendLessonCombination({
      ageGroup: recAge,
      duration: recDuration,
      kidCount: recKids,
      atmosphere: recAtmosphere,
      difficultyId: recDifficulty,
    });
    if (!recommendation) setRecommendation(rec);
    setWarmupSetId(rec.warmupSetId);
    setWarmupActivityId(rec.warmupActivityId || "");
    setGearId(rec.gearId);
    setGameId(rec.gameId || "");
    setDifficultyId(rec.difficultyId);
    setLevelId(rec.levelId);
    setCustomTexts({});
    setSafetyOverrides({});
    setGenerated(true);
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

  const handleSave = async () => {
    if (!generated) {
      alert("먼저 완성 대본을 생성해 주세요.");
      return;
    }
    if (!userId) {
      alert("로그인 후 저장할 수 있습니다.");
      return;
    }
    setSaving(true);
    try {
      const defaultTitle = gearOptions.find(g => g.id === gearId)?.label;
      const row = await saveLessonScript({
        id: editingId,
        title: title || `${defaultTitle || "수업"} 대본`,
        warmupSetId,
        warmupActivityId: warmupActivityId || null,
        gearId,
        gameId: gameId || null,
        levelId,
        difficultyId,
        customTexts,
        safetyOverrides,
        fullText: composed.fullText,
        sections: composed.sections,
      }, userId);
      setEditingId(row.id);
      setTitle(row.title);
      await refreshSaved();
      alert("저장되었습니다.");
    } catch (err) {
      alert(err?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("이 저장 대본을 삭제할까요?")) return;
    try {
      await deleteSavedLessonScript(id, userId);
      if (editingId === id) setEditingId(null);
      await refreshSaved();
    } catch (err) {
      alert(err?.message || "삭제에 실패했습니다.");
    }
  };

  const handlePrint = () => {
    if (!generated) {
      alert("먼저 완성 대본을 생성해 주세요.");
      return;
    }
    window.print();
  };

  const printTitle = title || gearOptions.find(g => g.id === gearId)?.label || "수업 대본";
  const difficultyLabel = LESSON_DIFFICULTIES.find(d => d.id === difficultyId)?.label;

  if (!adminDataReady) {
    return (
      <EnglishProgramLayout
        activeId="lesson-script-builder"
        onBack={onBack}
        onGoMain={onGoMain}
        onNavigate={onNavigate}
        mainClassName="lsb-main-wrap"
      >
        <div className="lsb-page eng-program-page">
          <p className="lsb-muted">수업 대본 데이터를 불러오는 중…</p>
        </div>
      </EnglishProgramLayout>
    );
  }

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
              난이도·모듈을 선택하고, 추천 조합 또는 대체 멘트로 빠르게 완성하세요.
            </p>
          </div>
          <div className="lsb-header__actions">
            {isAdmin ? (
              <button type="button" className="lsb-btn lsb-btn--ghost" onClick={() => navigate("/admin/lesson-script-data")}>
                데이터 관리
              </button>
            ) : null}
            <button type="button" className="lsb-btn lsb-btn--ghost" onClick={() => setShowSaved(v => !v)}>
              <FileText size={16}/>
              저장 목록
            </button>
          </div>
        </header>

        <section className="lsb-difficulty-panel">
          <h2 className="lsb-panel-title">수업 난이도</h2>
          <div className="lsb-difficulty-row">
            {LESSON_DIFFICULTIES.map(d => (
              <button
                key={d.id}
                type="button"
                className={`lsb-difficulty-card${difficultyId === d.id ? " active" : ""}`}
                onClick={() => handleDifficultyChange(d.id)}
              >
                <strong>{d.label}</strong>
                <span>{d.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="lsb-recommend-panel">
          <div className="lsb-recommend-panel__head">
            <h2 className="lsb-panel-title">
              <Wand2 size={18}/>
              오늘 수업 추천 조합
            </h2>
            <div className="lsb-recommend-actions">
              <button type="button" className="lsb-btn lsb-btn--ghost lsb-btn--sm" onClick={handleRecommend}>
                추천 받기
              </button>
              <button type="button" className="lsb-btn lsb-btn--primary lsb-btn--sm" onClick={applyRecommendation}>
                추천 조합 적용
              </button>
            </div>
          </div>
          <div className="lsb-recommend-form">
            <label className="lsb-field">
              <span>연령</span>
              <select className="lsb-select" value={recAge} onChange={e => setRecAge(e.target.value)}>
                {RECOMMEND_AGE_GROUPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="lsb-field">
              <span>수업 시간</span>
              <select className="lsb-select" value={recDuration} onChange={e => setRecDuration(e.target.value)}>
                {RECOMMEND_DURATIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="lsb-field">
              <span>아이 수</span>
              <select className="lsb-select" value={recKids} onChange={e => setRecKids(e.target.value)}>
                {RECOMMEND_KID_COUNTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="lsb-field">
              <span>수업 분위기</span>
              <select className="lsb-select" value={recAtmosphere} onChange={e => setRecAtmosphere(e.target.value)}>
                {RECOMMEND_ATMOSPHERES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="lsb-field">
              <span>난이도</span>
              <select className="lsb-select" value={recDifficulty} onChange={e => setRecDifficulty(e.target.value)}>
                {LESSON_DIFFICULTIES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>
          {recommendation ? (
            <div className="lsb-recommend-result">
              <p><strong>추천:</strong> {recommendation.summary}</p>
              <ul>
                {recommendation.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          ) : null}
        </section>

        {showSaved ? (
          <section className="lsb-saved-panel">
            <div className="lsb-saved-panel__head">
              <h2>저장된 대본</h2>
              <button type="button" className="lsb-btn lsb-btn--ghost lsb-btn--sm" onClick={() => setShowSaved(false)}>닫기</button>
            </div>
            {savedLoading ? (
              <p className="lsb-muted">불러오는 중…</p>
            ) : savedList.length === 0 ? (
              <p className="lsb-muted">저장된 대본이 없습니다.</p>
            ) : (
              <ul className="lsb-saved-list">
                {savedList.map(row => (
                  <li key={row.id} className="lsb-saved-item">
                    <button type="button" className="lsb-saved-item__main" onClick={() => loadSaved(row.id)}>
                      <strong>{row.title}</strong>
                      <span>{new Date(row.updatedAt).toLocaleString("ko-KR")}</span>
                    </button>
                    <button type="button" className="lsb-saved-item__delete" aria-label="삭제" onClick={() => handleDelete(row.id)}>
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
            <StepSection step={1} title="인사 & 워밍업 세트" desc="입장 · 인사 · 몸풀기 · 착석 (난이도별 표현 자동 적용)">
              {warmupSets.map(set => (
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

            <StepSection step={2} title="준비운동" desc="선택 시 안전 멘트 후 준비운동 → 교구 소개로 이어집니다.">
              <SelectCard selected={!warmupActivityId} onClick={() => setWarmupActivityId("")} title="준비운동 생략" desc="교구 소개로 바로 이동"/>
              {warmupActivities.map(item => (
                <SelectCard
                  key={item.id}
                  selected={warmupActivityId === item.id}
                  onClick={() => setWarmupActivityId(item.id)}
                  title={item.label}
                  desc="대체 멘트 · 난이도별 표현 지원"
                />
              ))}
            </StepSection>

            <StepSection step={3} title="교구 수업" desc="기존 교구 대본 데이터를 불러옵니다.">
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

            <StepSection step={4} title="게임 활동" desc="선택 시 게임 전 안전 멘트가 자동 삽입됩니다.">
              <SelectCard selected={!gameId} onClick={() => setGameId("")} title="게임 생략" desc="교구 수업으로 마무리"/>
              {gameActivities.map(game => (
                <SelectCard
                  key={game.id}
                  selected={gameId === game.id}
                  onClick={() => setGameId(game.id)}
                  title={game.label}
                  desc="대체 멘트 · 난이도별 표현 지원"
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
                <input className="lsb-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 7월 1주차 에어브릿지 수업"/>
              </label>
              <button type="button" className="lsb-btn lsb-btn--secondary" onClick={handleSave} disabled={saving || !userId}>
                <Save size={16}/>
                {saving ? "저장 중…" : "저장하기"}
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
              <p className="lsb-muted">
                난이도: {difficultyLabel} · 안전 멘트 자동 삽입 · 섹션별 수정 가능
              </p>
            </header>
            {composed.sections.length === 0 ? (
              <p className="lsb-muted">모듈을 선택하면 미리보기가 표시됩니다.</p>
            ) : (
              composed.sections.map(section => (
                <PreviewSection
                  key={section.key}
                  section={section}
                  difficultyId={difficultyId}
                  customTexts={customTexts}
                  safetyOverrides={safetyOverrides}
                  onCustomTextChange={handleCustomTextChange}
                  onSafetyChange={handleSafetyChange}
                />
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
            {difficultyLabel ? ` · 난이도 ${difficultyLabel}` : ""}
            {levelId ? ` · ${LESSON_SCRIPT_LEVELS.find(l => l.id === levelId)?.label}` : ""}
          </p>
        </header>
        {composed.sections.map(section => (
          <div key={`print-${section.key}`} className="lsb-preview-section">
            <h3 className="lsb-preview-section__title">{section.title}</h3>
            {section.parts?.length ? (
              section.parts.map(part => (
                <div key={part.partId} className="lsb-preview-part">
                  <h4 className="lsb-preview-part__label">{part.label}</h4>
                  <pre className="lsb-preview-part__text">{customTexts[part.partId] ?? part.text}</pre>
                </div>
              ))
            ) : (
              <pre className="lsb-preview-part__text">
                {section.editableKey && section.sectionType === "safety"
                  ? (safetyOverrides[section.editableKey] ?? section.text)
                  : section.editableKey && customTexts[section.editableKey] != null
                    ? customTexts[section.editableKey]
                    : section.text}
              </pre>
            )}
          </div>
        ))}
      </div>
    </EnglishProgramLayout>
  );
}
