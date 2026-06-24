import { LayoutGrid } from "lucide-react";

export const PLATFORM_HOME_PATH = "/";

export default function PlatformMainButton({ onClick, className = "" }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      className={`platform-main-btn ${className}`.trim()}
      onClick={onClick}
    >
      <LayoutGrid size={14} strokeWidth={2.2} aria-hidden />
      메인으로
    </button>
  );
}
