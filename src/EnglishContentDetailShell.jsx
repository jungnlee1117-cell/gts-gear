import { ChevronLeft } from "lucide-react";

export default function EnglishContentDetailShell({
  title,
  subtitle,
  onBack,
  backLabel = "뒤로가기",
  children,
  className = "",
}) {
  return (
    <div className={`eng-detail-page eng-program-page ${className}`.trim()}>
      <header className="eng-detail-page__header">
        <button type="button" className="eng-detail-page__back" onClick={onBack}>
          <ChevronLeft size={20} strokeWidth={2.5} aria-hidden/>
          {backLabel}
        </button>
        <div className="eng-detail-page__head-text">
          <h1 className="eng-detail-page__title">{title}</h1>
          {subtitle ? <p className="eng-detail-page__subtitle">{subtitle}</p> : null}
        </div>
      </header>
      <main className="eng-detail-page__body">
        {children}
      </main>
    </div>
  );
}
