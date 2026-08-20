import { AlertCircle, Lock } from "lucide-react";

export function ProfileGrid({ children, cols = 2, className = "" }) {
  return <div className={`my-profile-grid my-profile-grid--${cols}${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function ProfileValue({ children, revealed = false }) {
  const text = children == null || children === "" ? "—" : children;
  return <div className={`my-profile-value${revealed ? " my-profile-value--revealed" : ""}`}>{text}</div>;
}

export function MaskedValue({ value, revealed = false, locked = false }) {
  const text = value == null || value === "" ? "—" : value;
  return (
    <div className={`my-profile-value my-profile-value--masked${revealed ? " my-profile-value--revealed" : ""}`}>
      <span>{text}</span>
      {locked && !revealed ? <Lock size={14} strokeWidth={2} aria-hidden="true" /> : null}
    </div>
  );
}

export function InfoCell({ icon: Icon, label, children, className = "" }) {
  return (
    <div className={`my-profile-info-cell${className ? ` ${className}` : ""}`}>
      <div className="my-profile-info-meta">
        {Icon ? <Icon size={15} strokeWidth={1.75} className="my-profile-info-icon" aria-hidden="true" /> : null}
        <span className="my-profile-label">{label}</span>
      </div>
      {children}
    </div>
  );
}

export function IdentityBadge({ children, tone = "neutral" }) {
  return (
    <span className={`my-profile-id-badge my-profile-id-badge--${tone}`}>
      {children}
    </span>
  );
}

export function MissingInfoAlert({ label, onRegister, registerLabel = "등록하기" }) {
  return (
    <div className="my-profile-missing-alert" role="status">
      <AlertCircle size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>{label}</span>
      {onRegister ? (
        <button
          type="button"
          className="my-profile-missing-alert-action"
          onClick={onRegister}
          aria-label={`${label} ${registerLabel}`}
        >
          {registerLabel}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  compact = false,
  actionLabel,
  onAction,
}) {
  if (compact) {
    return (
      <div className="my-profile-empty-inline">
        {Icon ? <Icon size={22} strokeWidth={1.6} className="my-profile-empty-inline-icon" aria-hidden="true" /> : null}
        <p>
          {title}
          {hint ? ` ${hint}` : ""}
        </p>
        {actionLabel && onAction ? (
          <button type="button" className="my-profile-empty-inline-action" onClick={onAction} aria-label={actionLabel}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="my-profile-empty-state">
      {Icon ? <Icon size={44} strokeWidth={1.2} className="my-profile-empty-icon" aria-hidden="true" /> : null}
      <p>{title}</p>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

export default function FormField({
  label,
  children,
  readOnly = false,
  full = false,
  error = "",
}) {
  return (
    <div className={`my-profile-field${full ? " my-profile-field--full" : ""}${readOnly ? " my-profile-field--readonly" : ""}`}>
      <span className="my-profile-label">{label}</span>
      {children}
      {error ? <p className="my-profile-field-error">{error}</p> : null}
    </div>
  );
}
