import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { getGearCatalog } from "./gearScriptMeta.js";
import { generateLessonScriptWithAi } from "./lessonScriptAiGenerate.js";
import { lessonScriptSupabase } from "./lessonScriptSupabase.js";
import {
  AI_ACTIVITY_TYPES,
  AI_ATMOSPHERES,
  AI_TARGET_AGES,
  createEmptyAiInput,
  createEmptyAiResult,
} from "./lessonScriptAiTypes.js";
import {
  ActivityMetaEditor,
  AdminModal,
  VariantBlockEditor,
} from "./LessonScriptDataAdminForms.jsx";

const TYPE_LABELS = {
  [AI_ACTIVITY_TYPES.WARMUP]: "준비운동",
  [AI_ACTIVITY_TYPES.GAME]: "게임 활동",
  [AI_ACTIVITY_TYPES.GEAR]: "교구 수업",
};

export default function LessonScriptAiGenerateModal({
  activityType,
  gearContext = null,
  onClose,
  onApply,
}) {
  const [step, setStep] = useState("input");
  const [input, setInput] = useState(() => ({
    ...createEmptyAiInput(activityType),
    gear: gearContext?.gearLabel || "",
    gearLabel: gearContext?.gearLabel || "",
    levelLabel: gearContext?.levelLabel || "",
  }));
  const [result, setResult] = useState(createEmptyAiResult());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!input.activityName?.trim()) {
      alert("활동명을 입력해 주세요.");
      return;
    }
    if (!input.goal?.trim()) {
      alert("활동 목표를 입력해 주세요.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const { data: { session } } = await lessonScriptSupabase.auth.getSession();
      const generated = await generateLessonScriptWithAi(input, session?.access_token);
      setResult({
        ...createEmptyAiResult(),
        ...generated,
        activityName: generated.activityName || input.activityName.trim(),
      });
      setStep("preview");
    } catch (err) {
      setError(err?.message || "생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const updateResultScripts = (block) => {
    setResult(prev => ({
      ...prev,
      scripts: { default: block.default, alternatives: block.alternatives },
    }));
  };

  const updateResultSafety = (block) => {
    setResult(prev => ({
      ...prev,
      safetyMemo: { default: block.default, alternatives: block.alternatives },
    }));
  };

  if (step === "input") {
    return (
      <AdminModal
        title={`AI로 ${TYPE_LABELS[activityType] || "대본"} 자동 생성`}
        onClose={onClose}
        onSave={handleGenerate}
        saveLabel={generating ? "생성 중…" : "AI 대본 생성"}
        saving={generating}
        wide
      >
        <p className="lsda-muted">
          최소 정보만 입력하면 활동 설명·영어 대본·대체 멘트·안전 멘트·태그 등을 자동 생성합니다.
          생성 후 확인·수정한 뒤 저장하세요.
        </p>

        <label className="lsda-field">
          <span>활동명 *</span>
          <input
            className="lsda-input"
            value={input.activityName}
            onChange={e => setInput({ ...input, activityName: e.target.value })}
            placeholder="예: Shuttle Run, Peanut Butter Game"
          />
        </label>

        <div className="lsda-form-grid">
          <label className="lsda-field">
            <span>대상 연령</span>
            <select className="lsda-select" value={input.targetAge} onChange={e => setInput({ ...input, targetAge: e.target.value })}>
              {AI_TARGET_AGES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="lsda-field">
            <span>수업 분위기</span>
            <select className="lsda-select" value={input.atmosphere} onChange={e => setInput({ ...input, atmosphere: e.target.value })}>
              {AI_ATMOSPHERES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <label className="lsda-field">
          <span>활동 목표 *</span>
          <textarea
            className="lsda-textarea"
            rows={2}
            value={input.goal}
            onChange={e => setInput({ ...input, goal: e.target.value })}
            placeholder="예: 전신 워밍업, 협응력 향상, 영어 지시어 따라하기"
          />
        </label>

        <label className="lsda-field">
          <span>사용하는 교구</span>
          {activityType === AI_ACTIVITY_TYPES.GEAR && gearContext ? (
            <input className="lsda-input" value={input.gear} disabled/>
          ) : (
            <input
              className="lsda-input"
              value={input.gear}
              onChange={e => setInput({ ...input, gear: e.target.value })}
              placeholder="예: 콘, 밸런스보드, 없음"
              list="lsda-gear-suggestions"
            />
          )}
          <datalist id="lsda-gear-suggestions">
            {getGearCatalog().map(g => <option key={g.id} value={g.label}/>)}
          </datalist>
        </label>

        <label className="lsda-field">
          <span>주의사항</span>
          <textarea
            className="lsda-textarea"
            rows={2}
            value={input.precautions}
            onChange={e => setInput({ ...input, precautions: e.target.value })}
            placeholder="예: 충돌 주의, 미끄러운 바닥 피하기, 한 번에 1명씩"
          />
        </label>

        {error ? <p className="lsda-error">{error}</p> : null}
        {generating ? (
          <p className="lsda-muted lsda-generating">
            <Loader2 size={14} className="lsda-spin"/>
            대본을 생성하고 있습니다…
          </p>
        ) : null}
      </AdminModal>
    );
  }

  return (
    <div className="lsda-backdrop" onClick={onClose}>
      <div className="lsda-modal lsda-modal--wide lsda-modal--ai" onClick={e => e.stopPropagation()}>
        <header className="lsda-modal__head">
          <h2>
            <Sparkles size={18}/>
            생성 결과 확인 · {result.activityName}
            <span className="lsda-ai-source">{result.source === "ai" ? "AI" : "로컬 생성"}</span>
          </h2>
          <button type="button" className="lsda-modal__close" onClick={onClose}>닫기</button>
        </header>

        <div className="lsda-modal__body lsda-ai-preview">
          <ActivityMetaEditor
            value={result.meta}
            onChange={meta => setResult(prev => ({ ...prev, meta }))}
          />

          <section className="lsda-ai-section">
            <h3>영어 대본 (난이도별 + 대체 멘트)</h3>
            <VariantBlockEditor
              value={{
                label: result.activityName,
                default: result.scripts.default,
                alternatives: result.scripts.alternatives,
              }}
              onChange={updateResultScripts}
              showLabel={false}
            />
          </section>

          <section className="lsda-ai-section">
            <h3>안전 멘트</h3>
            <VariantBlockEditor
              value={{
                label: `${result.activityName} 안전 멘트`,
                default: result.safetyMemo.default,
                alternatives: result.safetyMemo.alternatives,
              }}
              onChange={updateResultSafety}
            />
          </section>

          {activityType === AI_ACTIVITY_TYPES.GEAR ? (
            <section className="lsda-ai-section">
              <h3>교구 수업 전체 대본</h3>
              <textarea
                className="lsda-textarea lsda-textarea--tall"
                rows={14}
                value={result.gearLessonText || ""}
                onChange={e => setResult(prev => ({ ...prev, gearLessonText: e.target.value }))}
              />
            </section>
          ) : null}
        </div>

        <footer className="lsda-modal__foot">
          <button type="button" className="lsda-btn lsda-btn--ghost" onClick={() => setStep("input")}>
            <Wand2 size={14}/>
            입력 다시하기
          </button>
          <button type="button" className="lsda-btn lsda-btn--ghost" onClick={onClose}>취소</button>
          <button
            type="button"
            className="lsda-btn lsda-btn--primary"
            onClick={() => onApply(result)}
          >
            편집 폼에 적용
          </button>
        </footer>
      </div>
    </div>
  );
}
