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
import { LESSON_DIFFICULTIES } from "./lessonScriptDifficulty.js";
import { composeLessonScript } from "./lessonScriptCompose.js";
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

const SPACE_LABELS = {
  large: "큰 공간",
  medium: "중간 공간",
  small: "작은 공간",
  none: "공간 무관",
};

const GAME_DIFFICULTY_LABELS = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

function activityDescription(item) {
  return [
    item.title_en,
    item.duration_minutes ? `약 ${item.duration_minutes}분` : null,
    item.materials ? `준비물: ${item.materials}` : null,
  ].filter(Boolean).join(" · ");
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
  const [legacyWarmupActivity, setLegacyWarmupActivity] = useState(null);
  const [legacyGame, setLegacyGame] = useState(null);
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

  const gearOptions = useMemo(
    () => GEAR_CATALOG.map(g => ({ id: g.id, label: g.label, desc: g.desc })),
    [],
  );
  const visibleWarmupActivities = useMemo(
    () => legacyWarmupActivity
      ? [legacyWarmupActivity, ...warmupActivities.filter(item => item.id !== legacyWarmupActivity.id)]
      : warmupActivities,
    [legacyWarmupActivity, warmupActivities],
  );
  const visibleGameActivities = useMemo(
    () => legacyGame
      ? [legacyGame, ...gameActivities.filter(item => item.id !== legacyGame.id)]
      : gameActivities,
    [legacyGame, gameActivities],
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
    const savedPreparation = row.sections?.find(section => section.key === "warmup-activity");
    const savedGame = row.sections?.find(section => section.key === "game");
    setLegacyWarmupActivity(
      row.warmupActivityId && !warmupActivities.some(item => item.id === row.warmupActivityId)
        ? { id: row.warmupActivityId, label: savedPreparation?.subtitle || "기존 준비운동", legacy: true }
        : null,
    );
    setLegacyGame(
      row.gameId && !gameActivities.some(item => item.id === row.gameId)
        ? { id: row.gameId, label: savedGame?.subtitle || "기존 게임", legacy: true }
        : null,
    );
    setLevelId(row.levelId || "foundation");
    setDifficultyId(row.difficultyId || "medium");
    setCustomTexts(row.customTexts || {});
    setSafetyOverrides(row.safetyOverrides || {});
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
              인사부터 게임까지 원하는 모듈을 순서대로 직접 선택해 대본을 완성하세요.
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
              <SelectCard
                selected={!warmupActivityId}
                onClick={() => {
                  setWarmupActivityId("");
                  setLegacyWarmupActivity(null);
                }}
                title="준비운동 생략"
                desc="교구 소개로 바로 이동"
              />
              {visibleWarmupActivities.map(item => (
                <SelectCard
                  key={item.id}
                  selected={warmupActivityId === item.id}
                  onClick={() => {
                    setWarmupActivityId(item.id);
                    if (!item.legacy) setLegacyWarmupActivity(null);
                  }}
                  title={item.label}
                  desc={item.legacy ? "기존 저장 대본 호환 콘텐츠" : activityDescription(item)}
                  badge={item.legacy ? "기존" : SPACE_LABELS[item.space_requirement] || "준비운동"}
                />
              ))}
            </StepSection>

            <StepSection step={3} title="교구활동" desc="기존 교구 대본 데이터를 그대로 불러옵니다.">
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

            <StepSection step={4} title="게임" desc="선택 시 게임 전 안전 멘트가 자동 삽입됩니다.">
              <SelectCard
                selected={!gameId}
                onClick={() => {
                  setGameId("");
                  setLegacyGame(null);
                }}
                title="게임 생략"
                desc="교구 수업으로 마무리"
              />
              {visibleGameActivities.map(game => (
                <SelectCard
                  key={game.id}
                  selected={gameId === game.id}
                  onClick={() => {
                    setGameId(game.id);
                    if (!game.legacy) setLegacyGame(null);
                  }}
                  title={game.label}
                  desc={game.legacy ? "기존 저장 대본 호환 콘텐츠" : activityDescription(game)}
                  badge={game.legacy ? "기존" : GAME_DIFFICULTY_LABELS[game.difficulty] || "게임"}
                />
              ))}
            </StepSection>

            <StepSection step={5} title="미리보기 & 저장" desc="오른쪽 미리보기에서 대본을 확인하고 필요한 문구를 수정한 뒤 저장하세요.">
              <div className="lsb-actions">
                <button type="button" className="lsb-btn lsb-btn--primary" onClick={handleGenerate}>
                  <Sparkles size={16}/>
                  미리보기 확정
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
            </StepSection>
          </div>

          <aside className="lsb-preview" aria-live="polite">
            <header className="lsb-preview__head">
              <h2>실시간 미리보기</h2>
              <p className="lsb-muted">
                안전 멘트 자동 삽입 · 섹션별 수정 가능
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
