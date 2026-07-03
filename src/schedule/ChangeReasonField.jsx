import {
  CHANGE_REASON_CUSTOM,
  CHANGE_REASON_PRESETS,
} from "./changeReasonOptions.js";

export default function ChangeReasonField({
  preset,
  customText,
  onPresetChange,
  onCustomChange,
  required = true,
}) {
  return (
    <>
      <label className="sch-field">
        <span>변동 사유 {required ? "*" : "(선택)"}</span>
        <select
          className="sch-input"
          value={preset}
          onChange={e => onPresetChange(e.target.value)}
          required={required}
        >
          <option value="">사유 선택</option>
          {CHANGE_REASON_PRESETS.map(reason => (
            <option key={reason} value={reason}>{reason}</option>
          ))}
          <option value={CHANGE_REASON_CUSTOM}>직접 입력</option>
        </select>
      </label>
      {preset === CHANGE_REASON_CUSTOM ? (
        <label className="sch-field">
          <span>사유 직접 입력</span>
          <input
            type="text"
            className="sch-input"
            value={customText}
            onChange={e => onCustomChange(e.target.value)}
            placeholder="변동 사유를 입력하세요"
            required={required}
          />
        </label>
      ) : null}
    </>
  );
}
