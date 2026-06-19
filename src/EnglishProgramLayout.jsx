import EnglishProgramSidebar from "./EnglishProgramSidebar.jsx";

export default function EnglishProgramLayout({
  activeId,
  onBack,
  onNavigate,
  children,
  className = "",
  mainClassName = "",
}) {
  return (
    <div className={`eng-script-app eng-program-layout ${className}`.trim()}>
      <EnglishProgramSidebar
        activeId={activeId}
        onBack={onBack}
        onNavigate={onNavigate}
      />
      <div className={`eng-program-main ${mainClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
}
