import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { getDifficultyText } from "./lessonScriptDifficulty.js";
import { getAllAlternatives } from "./lessonScriptBuilderData.js";

export function AlternativePhraseButton({
  sectionKey,
  contextId = null,
  difficultyId,
  onSelect,
  label = "대체 멘트 보기",
}) {
  const [open, setOpen] = useState(false);
  const options = getAllAlternatives(sectionKey, contextId);

  if (!options.length) return null;

  return (
    <>
      <button
        type="button"
        className="lsb-alt-btn"
        onClick={() => setOpen(true)}
      >
        <RefreshCw size={13}/>
        {label}
      </button>
      {open ? (
        <div className="lsb-alt-backdrop" onClick={() => setOpen(false)}>
          <div className="lsb-alt-modal" onClick={e => e.stopPropagation()}>
            <header className="lsb-alt-modal__head">
              <h3>대체 멘트 선택</h3>
              <button type="button" className="lsb-alt-modal__close" onClick={() => setOpen(false)}>
                <X size={18}/>
              </button>
            </header>
            <ul className="lsb-alt-list">
              {options.map((variant, idx) => {
                const text = getDifficultyText(variant, difficultyId);
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      className="lsb-alt-option"
                      onClick={() => {
                        onSelect(text);
                        setOpen(false);
                      }}
                    >
                      <span className="lsb-alt-option__num">멘트 {idx + 1}</span>
                      <span className="lsb-alt-option__text">{text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function EditableScriptBlock({
  text,
  onChange,
  altSectionKey,
  altContextId,
  difficultyId,
  onAltSelect,
  rows = 3,
}) {
  return (
    <div className="lsb-editable-block">
      <textarea
        className="lsb-editable-textarea"
        rows={rows}
        value={text}
        onChange={e => onChange(e.target.value)}
      />
      {onAltSelect ? (
        <AlternativePhraseButton
          sectionKey={altSectionKey}
          contextId={altContextId}
          difficultyId={difficultyId}
          onSelect={onAltSelect}
        />
      ) : null}
    </div>
  );
}
