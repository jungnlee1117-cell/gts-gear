import { useState, useCallback } from "react";
import { Menu, X } from "lucide-react";
import EnglishProgramSidebar, { PROGRAM_SIDEBAR_MENU } from "./EnglishProgramSidebar.jsx";

export default function EnglishProgramLayout({
  activeId,
  onBack,
  onNavigate,
  children,
  className = "",
  mainClassName = "",
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleNavigate = useCallback((nav) => {
    onNavigate?.(nav);
    setMobileNavOpen(false);
  }, [onNavigate]);

  return (
    <div
      className={`eng-script-app eng-program-layout${mobileNavOpen ? " eng-program-layout--nav-open" : ""} ${className}`.trim()}
    >
      <header className="eng-program-mobile-bar">
        <button
          type="button"
          className="eng-program-mobile-menu"
          onClick={() => setMobileNavOpen(open => !open)}
          aria-label={mobileNavOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={mobileNavOpen}
        >
          {mobileNavOpen ? <X size={22} strokeWidth={2}/> : <Menu size={22} strokeWidth={2}/>}
        </button>
        <span className="eng-program-mobile-title">GTS English Program</span>
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          className="eng-program-sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-label="메뉴 닫기"
        />
      ) : null}

      <EnglishProgramSidebar
        activeId={activeId}
        onBack={onBack}
        onNavigate={handleNavigate}
      />

      <div className={`eng-program-main ${mainClassName}`.trim()}>
        {children}
      </div>

      <nav className="eng-program-bottom-nav" aria-label="영어 프로그램 빠른 이동">
        {PROGRAM_SIDEBAR_MENU.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              className={`eng-program-bottom-nav-item${isActive ? " active" : ""}`}
              onClick={() => {
                if (isActive) return;
                handleNavigate(item.nav);
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={2} aria-hidden/>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
