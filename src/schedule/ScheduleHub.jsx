import {
  Calendar, Building2, User, PartyPopper, Wallet, Settings, Bell, UserPlus,
} from "lucide-react";
import { filterScheduleMenu, isScheduleAdmin } from "./roles.js";
import { useUnreadChangeAlertCount } from "./ScheduleChangeAlertsView.jsx";

const ICONS = {
  calendar: Calendar,
  building: Building2,
  user: User,
  party: PartyPopper,
  wallet: Wallet,
  settings: Settings,
  bell: Bell,
  userplus: UserPlus,
};

export default function ScheduleHub({ me, onSelect }) {
  const items = filterScheduleMenu(me);
  const unreadAlerts = useUnreadChangeAlertCount(isScheduleAdmin(me));

  return (
    <>
      <div className="sch-hero">
        <h1 className="sch-page-title">스케줄 관리</h1>
        <p className="sch-page-desc">선생님 일정, 수업시간 입력, 급여·원 정산을 한곳에서 관리합니다.</p>
      </div>
      <div className="sch-grid">
        {items.map(item => {
          const Icon = ICONS[item.id === "institution-schedule" ? "building"
            : item.id === "home-visit" ? "user"
            : item.id === "events" ? "party"
            : item.id === "payroll" ? "wallet"
            : item.id === "change-alerts" ? "bell"
            : item.id === "temporary-teachers" ? "userplus"
            : "settings"];
          const badge = item.id === "change-alerts" && unreadAlerts > 0 ? unreadAlerts : null;
          return (
            <button
              key={item.id}
              type="button"
              className={`sch-card${item.soon ? " sch-card--soon" : ""}`}
              style={{ "--sch-accent": item.color }}
              onClick={() => !item.soon && onSelect(item.id)}
              disabled={item.soon}
            >
              <div className="sch-card-icon"><Icon size={22} strokeWidth={1.75}/></div>
              <div className="sch-card-title">{item.title}</div>
              <div className="sch-card-desc">{item.desc}</div>
              {badge ? <span className="sch-card-badge sch-card-badge--alert">{badge}건 미확인</span> : null}
              {item.soon ? <span className="sch-card-badge">준비 중</span> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}
