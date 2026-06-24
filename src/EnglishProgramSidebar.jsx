import { ChevronLeft, BookOpen, ShieldCheck, Lightbulb, User, Mic, Star } from "lucide-react";
import { useMemo } from "react";
import PlatformMainButton from "./PlatformMainButton.jsx";
import { situations } from "./situationData.js";
import { activities as flowTipsActivities } from "./tipsData.js";
import { PRONUNCIATION_TIPS } from "./pronunciationTipsData.js";
import { childTypes } from "./childTypesData.js";
import { matchGearId } from "./gearScriptMeta.js";
import { useGearItems } from "./useGearItems.js";

const VETERAN_TIPS_COUNT = flowTipsActivities.filter(a => a.cat === "veteran").length;

export const PROGRAM_SIDEBAR_MENU = [
  { id: "gear-scripts", icon: BookOpen, label: "교구 대본", nav: "gear-scripts" },
  { id: "situations", icon: ShieldCheck, label: "상황별 대처", count: situations.length, nav: "situations" },
  { id: "flow-tips", icon: Lightbulb, label: "수업 흐름 팁", count: flowTipsActivities.length, nav: "flow-tips" },
  { id: "pronunciation", icon: Mic, label: "발음 팁", count: PRONUNCIATION_TIPS.length, nav: "pronunciation" },
  { id: "child-types", icon: User, label: "아이 유형 가이드", count: childTypes.length, nav: "child-types" },
  { id: "veteran", icon: Star, label: "베테랑 노하우", count: VETERAN_TIPS_COUNT, nav: "veteran" },
];

const NAV_PATHS = {
  "gear-scripts": "/english-script",
  situations: "/situation-manual",
  "flow-tips": "/class-flow-tips",
  pronunciation: "/pronunciation-tips",
  "child-types": "/child-types",
  veteran: "/class-flow-tips?cat=veteran",
};

export { NAV_PATHS };

export function navigateEnglishProgram(nav) {
  const path = NAV_PATHS[nav];
  if (!path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function roleLabel(me) {
  if (!me) return "선생님";
  if (me.role === "admin" || me.role === "superadmin") return "관리자";
  if (me.is_item_admin) return "교구 관리자";
  return "선생님";
}

export default function EnglishProgramSidebar({ activeId, onBack, onGoMain, onNavigate, me }) {
  const { items } = useGearItems();
  const registeredScriptCount = useMemo(
    () => items.filter(item => matchGearId(item)).length,
    [items],
  );

  const handleNav = (nav) => {
    if (onNavigate) {
      onNavigate(nav);
      return;
    }
    navigateEnglishProgram(nav);
  };

  return (
    <aside className="eng-program-sidebar">
      <PlatformMainButton onClick={onGoMain} className="eng-program-sidebar-main-btn"/>

      <div className="eng-program-sidebar-brand">
        <span className="eng-program-sidebar-logo" aria-hidden>G</span>
        <div>
          <div className="eng-program-sidebar-brand-title">GTS</div>
          <div className="eng-program-sidebar-brand-sub">영어 수업 라이브러리</div>
        </div>
      </div>

      <button type="button" className="eng-program-sidebar-back" onClick={onBack}>
        <ChevronLeft size={14} strokeWidth={2.5}/>
        뒤로가기
      </button>

      <nav className="eng-program-sidebar-nav" aria-label="영어 프로그램 메뉴">
        {PROGRAM_SIDEBAR_MENU.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
          const count = item.id === "gear-scripts" ? registeredScriptCount : item.count;
          return (
            <button
              key={item.id}
              type="button"
              className={`eng-program-sidebar-item${isActive ? " active" : ""}`}
              onClick={() => {
                if (isActive) return;
                handleNav(item.nav);
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="eng-program-sidebar-icon">
                <Icon size={15} strokeWidth={2}/>
              </span>
              <span className="eng-program-sidebar-label">{item.label}</span>
              {count != null ? (
                <span className="eng-program-sidebar-count">{count}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {me ? (
        <div className="eng-program-sidebar-user">
          <div className="eng-program-sidebar-user-avatar">{me.name?.[0] || "?"}</div>
          <div className="eng-program-sidebar-user-text">
            <div className="eng-program-sidebar-user-name">{me.name}님</div>
            <div className="eng-program-sidebar-user-role">{roleLabel(me)}</div>
          </div>
        </div>
      ) : null}

      <div className="eng-program-sidebar-tip">
        <div className="eng-program-sidebar-tip-title">활용 팁</div>
        <p>Foundation · Interactive 2단계 레벨에 맞춰 대본과 활동을 조합하세요.</p>
        <button type="button" className="eng-program-sidebar-tip-btn">
          사용법 가이드 보기 →
        </button>
      </div>
    </aside>
  );
}
