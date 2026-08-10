import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

/** "14:30" | "1430" | "9:5" → "HH:MM" or null */
export function parseFlexibleTime(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  if (/^\d{1,2}:\d{1,2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return null;
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length === 3 || digits.length === 4) {
    const padded = digits.padStart(4, "0");
    const h = Number(padded.slice(0, 2));
    const m = Number(padded.slice(2, 4));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  if (digits.length === 1 || digits.length === 2) {
    const h = Number(digits);
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, "0")}:00`;
  }
  return null;
}

/**
 * 단일 시간 입력: 텍스트 숫자 입력 + 시계 아이콘 피커
 */
export default function TimeDualInput({
  value = "",
  onChange,
  disabled = false,
  required = false,
  id,
  placeholder = "14:30",
}) {
  const [text, setText] = useState(value ? String(value).slice(0, 5) : "");
  const pickerRef = useRef(null);

  useEffect(() => {
    setText(value ? String(value).slice(0, 5) : "");
  }, [value]);

  const commit = (raw) => {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) {
      setText("");
      onChange?.("");
      return;
    }
    const parsed = parseFlexibleTime(trimmed);
    if (parsed) {
      setText(parsed);
      onChange?.(parsed);
      return;
    }
    setText(value ? String(value).slice(0, 5) : "");
  };

  const openPicker = () => {
    if (disabled) return;
    const el = pickerRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else el.click();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="sch-time-field">
      <div className="sch-time-field-control">
        <input
          id={id}
          type="text"
          className="sch-input sch-time-field-input"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
            }
          }}
          aria-label="시간 입력"
        />
        <button
          type="button"
          className="sch-time-field-clock"
          disabled={disabled}
          onClick={openPicker}
          title="시계로 선택"
          aria-label="시계로 시간 선택"
        >
          <Clock size={14} strokeWidth={2} aria-hidden />
        </button>
        <input
          ref={pickerRef}
          type="time"
          className="sch-time-field-native"
          tabIndex={-1}
          disabled={disabled}
          value={value ? String(value).slice(0, 5) : ""}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            onChange?.(v);
          }}
          aria-hidden
        />
      </div>
      <p className="sch-time-field-hint">1430 또는 14:30</p>
    </div>
  );
}
