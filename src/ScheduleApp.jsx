import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ScheduleHub from "./schedule/ScheduleHub.jsx";
import ScheduleSidebar from "./ScheduleSidebar.jsx";
import PlatformMainButton from "./PlatformMainButton.jsx";
import TeacherSchedulePage from "./schedule/TeacherSchedulePage.jsx";
import PayrollTeacherView from "./schedule/PayrollTeacherView.jsx";
import PayrollAdminView from "./schedule/PayrollAdminView.jsx";
import InstitutionListView from "./schedule/InstitutionListView.jsx";
import InstitutionBulkRevenueView from "./schedule/InstitutionBulkRevenueView.jsx";
import InstitutionDetailView from "./schedule/InstitutionDetailView.jsx";
import HomeVisitScheduleView from "./schedule/HomeVisitScheduleView.jsx";
import EventsScheduleView from "./schedule/EventsScheduleView.jsx";
import ScheduleChangeAlertsView from "./schedule/ScheduleChangeAlertsView.jsx";
import MonthlySettlementView from "./schedule/MonthlySettlementView.jsx";
import TemporaryTeachersView from "./schedule/TemporaryTeachersView.jsx";
import TeacherPayRatesView from "./schedule/TeacherPayRatesView.jsx";
import { ScheduleAuthContext } from "./schedule/ScheduleAuthContext.jsx";
import { syncScheduleAuthSession, scheduleSupabase } from "./schedule/api.js";
import { isScheduleAdmin } from "./schedule/roles.js";
import { isScheduleSuperAdmin } from "./schedule/managerScope.js";

function ScheduleAccessDenied({ message, onBack }) {
  return (
    <div className="sch-view sch-access-denied">
      <p className="sch-muted">{message}</p>
      <button type="button" className="sch-btn sch-btn--ghost" onClick={onBack}>돌아가기</button>
    </div>
  );
}

const SCHEDULE_VIEWS = new Set([
  "hub", "teacher-monthly", "institution-schedule", "home-visit", "events",
  "change-alerts", "payroll", "settlement", "temporary-teachers", "pay-rates",
  "institutions", "institution-bulk-revenue", "institution-detail",
]);

function defaultScheduleView(admin) {
  return admin ? "hub" : "institution-schedule";
}

export default function ScheduleApp({ me, session, onBack }) {
  const admin = isScheduleAdmin(me);
  const [scheduleAuthReady, setScheduleAuthReady] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const [view, setViewState] = useState(() => {
    if (viewParam && SCHEDULE_VIEWS.has(viewParam)) return viewParam;
    return defaultScheduleView(admin);
  });
  const [detailId, setDetailId] = useState(null);

  const setView = useCallback((next) => {
    setViewState(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const defaultView = defaultScheduleView(admin);
      if (!next || next === defaultView) params.delete("view");
      else params.set("view", next);
      return params;
    }, { replace: true });
  }, [admin, setSearchParams]);

  useEffect(() => {
    if (!viewParam) return;
    if (SCHEDULE_VIEWS.has(viewParam) && viewParam !== view) {
      setViewState(viewParam);
    }
  }, [viewParam, view]);

  useEffect(() => {
    if (!session?.access_token) {
      setScheduleAuthReady(false);
      return;
    }
    let cancelled = false;
    syncScheduleAuthSession(session)
      .then(() => { if (!cancelled) setScheduleAuthReady(true); })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setScheduleAuthReady(false);
      });
    return () => { cancelled = true; };
  }, [session?.access_token, session?.refresh_token]);

  useEffect(() => {
    const { data: { subscription } } = scheduleSupabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession?.access_token) return;
      if (session?.access_token) {
        syncScheduleAuthSession(session).catch(console.error);
      }
    });
    return () => subscription.unsubscribe();
  }, [session?.access_token, session?.refresh_token]);

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
      case "institution-schedule":
        return (
          <TeacherSchedulePage
            me={me}
            onBack={goHub}
            initialTab={view === "teacher-monthly" ? "monthly" : "weekly"}
          />
        );
      case "home-visit":
        return <HomeVisitScheduleView me={me} onBack={goHub}/>;
      case "events":
        return <EventsScheduleView me={me} onBack={goHub}/>;
      case "change-alerts":
        return <ScheduleChangeAlertsView me={me} onBack={goHub}/>;
      case "payroll":
        return admin
          ? (
            <PayrollAdminView
              me={me}
              onBack={goHub}
              onOpenInstitution={id => { setDetailId(id); setView("institution-detail"); }}
              onOpenSettlement={() => setView("settlement")}
              onOpenPayRates={() => setView("pay-rates")}
              onOpenTemporaryTeachers={() => setView("temporary-teachers")}
            />
          )
          : <PayrollTeacherView me={me}/>;
      case "settlement":
        return admin
          ? <MonthlySettlementView me={me} onBack={() => setView("payroll")}/>
          : (
            <ScheduleAccessDenied
              message="월별 정산은 관리자만 이용할 수 있습니다."
              onBack={goHub}
            />
          );
      case "temporary-teachers":
        return admin
          ? <TemporaryTeachersView me={me} onBack={() => setView("payroll")}/>
          : (
            <ScheduleAccessDenied
              message="임시 선생님 등록은 관리자만 이용할 수 있습니다."
              onBack={goHub}
            />
          );
      case "pay-rates":
        return isScheduleSuperAdmin(me)
          ? <TeacherPayRatesView me={me} onBack={() => setView("payroll")}/>
          : (
            <ScheduleAccessDenied
              message="강사 단가 관리는 슈퍼관리자만 이용할 수 있습니다."
              onBack={goHub}
            />
          );
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
        return isScheduleSuperAdmin(me)
          ? (
            <InstitutionBulkRevenueView
              me={me}
              onBack={() => setView("institutions")}
            />
          )
          : (
            <ScheduleAccessDenied
              message="월별 매출 일괄입력은 슈퍼관리자만 이용할 수 있습니다."
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
          <ScheduleAuthContext.Provider value={scheduleAuthReady}>
            {renderView()}
          </ScheduleAuthContext.Provider>
        </main>
      </div>
    </div>
  );
}
