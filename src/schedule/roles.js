import { isScheduleAdmin } from "../authRoles.js";
import { isScheduleSuperAdmin } from "./managerScope.js";

export { isScheduleAdmin };

export function filterScheduleMenu(me) {
  const admin = isScheduleAdmin(me);
  const superAdmin = isScheduleSuperAdmin(me);

  const scheduleTitle = admin ? "선생님 시간표" : "내 시간표";

  return [
    { id: "institution-schedule", title: scheduleTitle, desc: admin ? "주간·월간 수업 일정" : "주간·월간 수업 일정", color: "#8b5cf6", roles: "all" },
    { id: "home-visit", title: "선생님 방문수업 일정", desc: "매주 반복 방문수업 등록·조회", color: "#6366f1", roles: "all" },
    { id: "events", title: "행사 일정", desc: "전체 원 행사·휴원 안내", color: "#ec4899", roles: "all" },
    {
      id: "payroll",
      title: "급여/정산",
      desc: superAdmin
        ? "전체 대시보드 · 월별 정산"
        : admin
          ? "담당 원별 정산 현황"
          : "수업시간 입력 · 급여 확인",
      color: "#22c55e",
      roles: "all",
    },
    {
      id: "change-alerts",
      title: admin ? "수업등록/변경" : "정규 수업",
      desc: admin
        ? "강사 스케줄 변경 알림 · 정규 수업 등록"
        : "담당 기관 정규·방과후 수업 조회",
      color: "#ef4444",
      roles: "all",
    },
    ...(admin ? [
      { id: "institutions", title: "원 관리", desc: "원 마스터 · 시간표 · 계약", color: "#f97316", roles: "admin" },
    ] : []),
  ];
}
