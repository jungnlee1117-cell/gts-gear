import { formatWon } from "./constants.js";
import { buildThresholdSplitSteps } from "./thresholdSplitSettlement.js";

export default function ThresholdSplitBreakdown({ calc, className = "" }) {
  const steps = buildThresholdSplitSteps(calc);
  if (!steps.length) return null;

  return (
    <ol className={`sch-threshold-steps${className ? ` ${className}` : ""}`}>
      {steps.map((step, idx) => (
        <li
          key={`${step.label}-${idx}`}
          className={step.highlight ? "sch-threshold-steps__item--highlight" : ""}
        >
          <span className="sch-threshold-steps__label">{step.label}</span>
          {step.amount != null ? (
            <span className="sch-threshold-steps__amount">
              {step.label.includes("차감") && step.amount > 0 ? "−" : ""}
              {formatWon(step.amount)}
            </span>
          ) : null}
          {step.hint ? (
            <span className="sch-threshold-steps__hint">{step.hint}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
