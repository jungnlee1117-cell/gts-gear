import { Plus, Trash2 } from "lucide-react";
import {
  cloneDifficultyText,
  cloneVariantBlock,
  createEmptyDifficultyText,
  DIFFICULTY_FIELDS,
} from "./lessonScriptDataTypes.js";

export function DifficultyTextEditor({ value, onChange, label = "기본 멘트" }) {
  const current = value || createEmptyDifficultyText();
  return (
    <fieldset className="lsda-fieldset">
      <legend>{label}</legend>
      <div className="lsda-diff-grid">
        {DIFFICULTY_FIELDS.map(field => (
          <label key={field.id} className="lsda-field">
            <span>{field.label}</span>
            <textarea
              className="lsda-textarea"
              rows={3}
              value={current[field.id] || ""}
              onChange={e => onChange({ ...current, [field.id]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function VariantBlockEditor({ value, onChange, showLabel = true }) {
  const block = cloneVariantBlock(value);

  const updateDefault = (next) => {
    onChange({ ...block, default: next });
  };

  const updateAlternative = (index, next) => {
    const alternatives = [...block.alternatives];
    alternatives[index] = next;
    onChange({ ...block, alternatives });
  };

  const addAlternative = () => {
    onChange({
      ...block,
      alternatives: [...block.alternatives, createEmptyDifficultyText()],
    });
  };

  const removeAlternative = (index) => {
    onChange({
      ...block,
      alternatives: block.alternatives.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="lsda-variant-editor">
      {showLabel ? (
        <label className="lsda-field">
          <span>표시 이름</span>
          <input
            className="lsda-input"
            value={block.label || ""}
            onChange={e => onChange({ ...block, label: e.target.value })}
          />
        </label>
      ) : null}
      <DifficultyTextEditor value={block.default} onChange={updateDefault} label="기본 멘트 (난이도별)" />
      <div className="lsda-alt-section">
        <div className="lsda-alt-section__head">
          <h4>대체 멘트</h4>
          <button type="button" className="lsda-btn lsda-btn--ghost lsda-btn--sm" onClick={addAlternative}>
            <Plus size={14}/>
            대체 멘트 추가
          </button>
        </div>
        {block.alternatives.length === 0 ? (
          <p className="lsda-muted">등록된 대체 멘트가 없습니다.</p>
        ) : (
          block.alternatives.map((alt, index) => (
            <div key={index} className="lsda-alt-card">
              <div className="lsda-alt-card__head">
                <strong>대체 멘트 {index + 1}</strong>
                <button
                  type="button"
                  className="lsda-icon-btn"
                  aria-label="대체 멘트 삭제"
                  onClick={() => removeAlternative(index)}
                >
                  <Trash2 size={14}/>
                </button>
              </div>
              <DifficultyTextEditor
                value={alt}
                onChange={next => updateAlternative(index, next)}
                label={`대체 멘트 ${index + 1}`}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminModal({
  title,
  onClose,
  onSave,
  children,
  wide = false,
  saveLabel = "저장",
  saving = false,
}) {
  return (
    <div className="lsda-backdrop" onClick={onClose}>
      <div
        className={`lsda-modal${wide ? " lsda-modal--wide" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <header className="lsda-modal__head">
          <h2>{title}</h2>
          <button type="button" className="lsda-modal__close" onClick={onClose}>닫기</button>
        </header>
        <div className="lsda-modal__body">{children}</div>
        <footer className="lsda-modal__foot">
          <button type="button" className="lsda-btn lsda-btn--ghost" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="lsda-btn lsda-btn--primary" onClick={onSave} disabled={saving}>
            {saveLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function TagListEditor({ label, value = [], onChange, placeholder }) {
  const text = (value || []).join(", ");
  return (
    <label className="lsda-field">
      <span>{label}</span>
      <input
        className="lsda-input"
        value={text}
        placeholder={placeholder || "쉼표로 구분"}
        onChange={e => onChange(
          e.target.value.split(",").map(s => s.trim()).filter(Boolean),
        )}
      />
    </label>
  );
}

export function ActivityMetaEditor({ value, onChange }) {
  const meta = value || {};
  const set = (key, val) => onChange({ ...meta, [key]: val });

  return (
    <div className="lsda-meta-editor">
      <h3 className="lsda-meta-editor__title">활동 메타 정보</h3>
      <label className="lsda-field">
        <span>활동 설명</span>
        <textarea className="lsda-textarea" rows={3} value={meta.description || ""} onChange={e => set("description", e.target.value)}/>
      </label>
      <label className="lsda-field">
        <span>세팅 방법</span>
        <textarea className="lsda-textarea" rows={3} value={meta.setup || ""} onChange={e => set("setup", e.target.value)}/>
      </label>
      <label className="lsda-field">
        <span>진행 순서</span>
        <textarea className="lsda-textarea" rows={4} value={meta.progressSteps || ""} onChange={e => set("progressSteps", e.target.value)}/>
      </label>
      <div className="lsda-form-grid">
        <label className="lsda-field">
          <span>추천 연령</span>
          <input className="lsda-input" value={meta.recommendedAge || ""} onChange={e => set("recommendedAge", e.target.value)}/>
        </label>
        <label className="lsda-field">
          <span>권장 시간</span>
          <input className="lsda-input" value={meta.recommendedDuration || ""} onChange={e => set("recommendedDuration", e.target.value)}/>
        </label>
        <label className="lsda-field">
          <span>적정 인원</span>
          <input className="lsda-input" value={meta.appropriateSize || ""} onChange={e => set("appropriateSize", e.target.value)}/>
        </label>
        <label className="lsda-field">
          <span>에너지 레벨</span>
          <input className="lsda-input" value={meta.energyLevel || ""} onChange={e => set("energyLevel", e.target.value)}/>
        </label>
        <label className="lsda-field">
          <span>규칙 난이도</span>
          <input className="lsda-input" value={meta.ruleDifficulty || ""} onChange={e => set("ruleDifficulty", e.target.value)}/>
        </label>
      </div>
      <TagListEditor label="신체 목표 태그" value={meta.physicalGoalTags} onChange={v => set("physicalGoalTags", v)}/>
      <TagListEditor label="분위기 태그" value={meta.atmosphereTags} onChange={v => set("atmosphereTags", v)}/>
      <TagListEditor label="추천 상황" value={meta.recommendedSituations} onChange={v => set("recommendedSituations", v)}/>
      <TagListEditor label="피해야 하는 상황" value={meta.avoidSituations} onChange={v => set("avoidSituations", v)}/>
    </div>
  );
}

export function ItemListRow({ title, subtitle, badges = [], onEdit, onDelete, onAi, deleteLabel = "삭제" }) {
  return (
    <li className="lsda-item">
      <div className="lsda-item__main">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {badges.length ? (
          <div className="lsda-item__badges">
            {badges.map(b => <span key={b} className="lsda-badge">{b}</span>)}
          </div>
        ) : null}
      </div>
      <div className="lsda-item__actions">
        {onAi ? (
          <button type="button" className="lsda-btn lsda-btn--ghost lsda-btn--sm" onClick={onAi}>AI</button>
        ) : null}
        <button type="button" className="lsda-btn lsda-btn--ghost lsda-btn--sm" onClick={onEdit}>수정</button>
        {onDelete ? (
          <button type="button" className="lsda-btn lsda-btn--danger lsda-btn--sm" onClick={onDelete}>{deleteLabel}</button>
        ) : null}
      </div>
    </li>
  );
}

export function validateVariantBlock(block) {
  const hasDefault = block?.default && (block.default.easy || block.default.medium || block.default.hard);
  if (!hasDefault) return "기본 멘트(쉬움/보통/어려움 중 1개 이상)를 입력해 주세요.";
  return "";
}

export function normalizeVariantBlock(block) {
  const cloned = cloneVariantBlock(block);
  cloned.alternatives = cloned.alternatives
    .map(cloneDifficultyText)
    .filter(alt => alt.easy || alt.medium || alt.hard);
  return cloned;
}
