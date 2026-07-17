import { useLayoutEffect, useRef, useState } from "react";
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

function resizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
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
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [text]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return undefined;

    const onResize = () => resizeTextarea(el);
    window.addEventListener("resize", onResize);

    // 왼쪽 패널 접기/펼치기로 미리보기 너비만 바뀔 때도 재측정
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(onResize)
      : null;
    ro?.observe(el);

    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="lsb-editable-block">
      <textarea
        ref={textareaRef}
        className="lsb-editable-textarea"
        rows={rows}
        value={text}
        onChange={e => {
          onChange(e.target.value);
          resizeTextarea(e.target);
        }}
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
