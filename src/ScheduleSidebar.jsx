import {
  Calendar, Building2, User, PartyPopper, Wallet, Settings, Bell,
} from "lucide-react";
import PlatformMainButton from "./PlatformMainButton.jsx";
import { filterScheduleMenu } from "./schedule/roles.js";

const ICONS = {
  "teacher-monthly": Calendar,
  "institution-schedule": Building2,
  "home-visit": User,
  events: PartyPopper,
  payroll: Wallet,
  "change-alerts": Bell,
  institutions: Settings,
};

export default function ScheduleSidebar({ me, view, onGoMain, onSelect, onGoHub }) {
  const items = filterScheduleMenu(me);
  const hubViews = new Set(["hub", ...items.map(item => item.id)]);

  return (
    <aside className="sch-sidebar">
      <PlatformMainButton onClick={onGoMain} className="sch-sidebar__main-btn"/>

      <div className="sch-sidebar__brand">
        <span className="sch-sidebar__logo" aria-hidden>G</span>
        <div>
          <div className="sch-sidebar__brand-title">GTS</div>
          <div className="sch-sidebar__brand-sub">스케줄 관리</div>
        </div>
      </div>

      {!hubViews.has(view) ? (
        <button type="button" className="sch-sidebar__back" onClick={onGoHub}>
          ← 스케줄 홈
        </button>
      ) : null}

      <nav className="sch-sidebar__nav" aria-label="스케줄 메뉴">
        {items.map(item => {
          const Icon = ICONS[item.id] || Calendar;
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sch-sidebar__item${isActive ? " active" : ""}`}
              disabled={item.soon}
              onClick={() => !item.soon && onSelect(item.id)}
            >
              <span className="sch-sidebar__icon">
                <Icon size={15} strokeWidth={2}/>
              </span>
              <span className="sch-sidebar__label">{item.title}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
