import { useState } from "react";
import ScheduleHub from "./schedule/ScheduleHub.jsx";
import ScheduleSidebar from "./ScheduleSidebar.jsx";
import PlatformMainButton from "./PlatformMainButton.jsx";
import TeacherMonthlyScheduleView from "./schedule/TeacherMonthlyScheduleView.jsx";
import InstitutionScheduleView from "./schedule/InstitutionScheduleView.jsx";
import PayrollTeacherView from "./schedule/PayrollTeacherView.jsx";
import PayrollAdminView from "./schedule/PayrollAdminView.jsx";
import InstitutionListView from "./schedule/InstitutionListView.jsx";
import InstitutionBulkRevenueView from "./schedule/InstitutionBulkRevenueView.jsx";
import InstitutionDetailView from "./schedule/InstitutionDetailView.jsx";
import HomeVisitScheduleView from "./schedule/HomeVisitScheduleView.jsx";
import EventsScheduleView from "./schedule/EventsScheduleView.jsx";
import ScheduleChangeAlertsView from "./schedule/ScheduleChangeAlertsView.jsx";
import MonthlySettlementView from "./schedule/MonthlySettlementView.jsx";
import TeacherPayRatesView from "./schedule/TeacherPayRatesView.jsx";
import { isScheduleAdmin } from "./schedule/roles.js";
import { isScheduleSuperAdmin } from "./schedule/managerScope.js";

export default function ScheduleApp({ me, onBack }) {
  const admin = isScheduleAdmin(me);
  const [view, setView] = useState(() => (admin ? "hub" : "payroll"));
  const [detailId, setDetailId] = useState(null);

  const goHub = () => {
    if (admin) {
      setView("hub");
      setDetailId(null);
    } else {
      onBack?.();
    }
  };

  const roleLabel = me?.role === "superadmin"
    ? "슈퍼관리자"
    : me?.role === "admin"
      ? "지역 관리자"
      : "선생님";

  const renderView = () => {
    switch (view) {
      case "teacher-monthly":
        return <TeacherMonthlyScheduleView me={me} onBack={goHub}/>;
      case "institution-schedule":
        return <InstitutionScheduleView me={me} onBack={goHub}/>;
      case "home-visit":
        return <HomeVisitScheduleView me={me} onBack={goHub}/>;
      case "events":
        return <EventsScheduleView me={me} onBack={goHub}/>;
      case "change-alerts":
        return admin ? <ScheduleChangeAlertsView onBack={goHub}/> : null;
      case "payroll":
        return admin ? (
          <PayrollAdminView
            me={me}
            onBack={goHub}
            onOpenInstitution={id => { setDetailId(id); setView("institution-detail"); }}
            onOpenSettlement={() => setView("settlement")}
            onOpenPayRates={() => setView("pay-rates")}
          />
        ) : (
          <PayrollTeacherView me={me}/>
        );
      case "settlement":
        return <MonthlySettlementView me={me} onBack={() => setView("payroll")}/>;
      case "pay-rates":
        return isScheduleSuperAdmin(me)
          ? <TeacherPayRatesView me={me} onBack={() => setView("payroll")}/>
          : null;
      case "institutions":
        return (
          <InstitutionListView
            me={me}
            onBack={goHub}
            onOpenDetail={id => { setDetailId(id); setView("institution-detail"); }}
            onOpenBulkRevenue={() => setView("institution-bulk-revenue")}
          />
        );
      case "institution-bulk-revenue":
        return (
          <InstitutionBulkRevenueView
            me={me}
            onBack={() => setView("institutions")}
          />
        );
      case "institution-detail":
        return (
          <InstitutionDetailView
            me={me}
            institutionId={detailId}
            onBack={() => { setDetailId(null); setView(admin ? "institutions" : "payroll"); }}
          />
        );
      default:
        return <ScheduleHub me={me} onSelect={setView}/>;
    }
  };

  return (
    <div className="schedule-app schedule-app--with-sidebar">
      <ScheduleSidebar
        me={me}
        view={view}
        onGoMain={onBack}
        onSelect={setView}
        onGoHub={goHub}
      />
      <div className="sch-body">
        <header className="sch-header">
          <div className="sch-header-left">
            <PlatformMainButton onClick={onBack} className="sch-header-main-btn"/>
          </div>
          <div className={`sch-user${!admin ? " sch-user--inline" : ""}`}>
            {!admin ? (
              <span className="sch-user-name">{me?.name} {roleLabel}</span>
            ) : (
              <>
                <span className="sch-user-name">{me?.name}</span>
                <span className="sch-user-role">{roleLabel}</span>
              </>
            )}
          </div>
        </header>
        <main className="sch-main">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
