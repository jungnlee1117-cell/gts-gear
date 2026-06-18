import { ChevronLeft, BookOpen, ShieldCheck, Lightbulb, User, Mic, Star } from "lucide-react";
import { situations } from "./situationData.js";
import { activities as flowTipsActivities } from "./tipsData.js";
import { PRONUNCIATION_TIPS } from "./pronunciationTipsData.js";
import { childTypes } from "./childTypesData.js";

const VETERAN_TIPS_COUNT = flowTipsActivities.filter(a => a.cat === "veteran").length;

export const PROGRAM_SIDEBAR_MENU = [
  { id: "gear-scripts", icon: BookOpen, label: "교구 대본", sub: "교구별 3단계 대본", nav: "gear-scripts" },
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

export function navigateEnglishProgram(nav) {
  const path = NAV_PATHS[nav];
  if (!path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function EnglishProgramSidebar({ activeId, onBack, onNavigate }) {
  const handleNav = (nav) => {
    if (onNavigate) {
      onNavigate(nav);
      return;
    }
    navigateEnglishProgram(nav);
  };

  return (
    <aside className="eng-program-sidebar">
      <button type="button" className="eng-program-sidebar-back" onClick={onBack}>
        <ChevronLeft size={14} strokeWidth={2.5}/>
        뒤로가기
      </button>

      <nav className="eng-program-sidebar-nav" aria-label="영어 프로그램 메뉴">
        {PROGRAM_SIDEBAR_MENU.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
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
              <span className="eng-program-sidebar-text">
                <span className="eng-program-sidebar-label">{item.label}</span>
                {item.sub ? <span className="eng-program-sidebar-sub">{item.sub}</span> : null}
              </span>
              {item.count != null ? (
                <span className="eng-program-sidebar-count">{item.count}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="eng-program-sidebar-tip">
        <div className="eng-program-sidebar-tip-title">활용 팁</div>
        <p>Foundation · Interactive · Inquiry 레벨에 맞춰 대본과 활동을 조합하세요.</p>
      </div>
    </aside>
  );
}
