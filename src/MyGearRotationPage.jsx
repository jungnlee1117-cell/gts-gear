import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import {
  assignedLetterForMonth,
  findCurrentRotationWeekSlot,
  findNextRotationWeekSlot,
  formatCalendarWeekLabel,
  formatCalendarWeekRange,
  formatWeekRange,
  getWeekItemsForLetter,
  resolveItemRecord,
  resolveRotationSchedules,
  rotationWeekLabelForSlot,
  rotationWeekRangeForSlot,
  schoolYearMonths,
  yearMonthFirstDay,
  yearMonthKey,
} from "./itemRotation.js";
import {
  clampToSchoolYear,
  findLessonPlanForKoreanItem,
  monthLabel,
  resolveEnglishFromKorean,
  buildAliasMaps,
  schoolYearStartYear,
} from "./lessonPlan.js";
import { itemPhotoStyle } from "./gearPhoto.js";
import { buildCurrentRentals } from "./teacherGearStatus.js";
import { isScheduleAdmin, isSuperAdmin } from "./authRoles.js";
import TeacherRotationRentalStatusSection from "./TeacherRotationRentalStatusSection.jsx";
import SuperadminMonthlyPlanEditor from "./SuperadminMonthlyPlanEditor.jsx";
import {
  ROTATION_SEARCH_MODES,
  buildTeacherMonthAssignmentSummary,
  searchGearAssignmentsForMonth,
} from "./rotationGearSearch.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const MONTH_SHORT = ["", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const LIST_PREVIEW = 5;

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "rental", label: "대여" },
  { id: "air", label: "에어" },
  { id: "prop", label: "소도구" },
];

const PAGE_TABS = [
  { id: "mine", label: "내 교구" },
  { id: "teachers", label: "선생님 교구" },
];

function parseDay(value) {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function gearTypeBadge(gear) {
  if (gear?.is_air_product) return { label: "에어", tone: "air" };
  return { label: "대여", tone: "rental" };
}

function resolveGearItemEntries(gear, items) {
  if (!gear) return [];
  if (gear.merged) {
    const item = resolveItemRecord(items, gear.item_name);
    return [{ label: null, name: gear.displayName, item }];
  }
  if (gear.parts?.length) {
    return gear.parts.map(p => ({
      label: p.label,
      name: p.name,
      item: resolveItemRecord(items, p.name),
    }));
  }
  const item = resolveItemRecord(items, gear.item_name);
  return [{ label: null, name: gear.displayName, item }];
}

function resolveGearPhotoEntries(gear, items) {
  return resolveGearItemEntries(gear, items).filter(e => e.item?.photo_url);
}

function matchesFilter(filterId, gear, items) {
  if (filterId === "all") return true;
  const entries = resolveGearItemEntries(gear, items);
  return entries.some(({ item }) => {
    if (filterId === "air") return Boolean(gear?.is_air_product);
    if (filterId === "prop") {
      const cat = item?.category;
      return ["TOOL", "STACK", "TARGET", "ETC", "SPC"].includes(cat);
    }
    if (filterId === "rental") return !gear?.is_air_product;
    return true;
  });
}

function weekRentalStatusForGear(weekSlot, gear, items, heldIds) {
  const ids = resolveGearItemEntries(gear, items).map(e => e.item?.id).filter(Boolean);
  if (!ids.length) return { label: "대여 예정", tone: "scheduled" };
  if (ids.some(id => heldIds.has(id))) {
    return { label: "대여 중", tone: "rented" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = parseDay(weekSlot?.week_end_date);
  const start = parseDay(weekSlot?.week_start_date);
  if (end && end < today) return { label: "반납 완료", tone: "done" };
  if (start && start > today) return { label: "대여 예정", tone: "scheduled" };
  return { label: "대여 예정", tone: "scheduled" };
}

function GearPhoto({ item, className, alt }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [item?.id, item?.photo_url]);

  if (!item?.photo_url || failed) return null;

  return (
    <img
      src={item.photo_url}
      alt={alt || item.name}
      className={className}
      onError={() => setFailed(true)}
      style={itemPhotoStyle(item, { width: "100%", height: "100%" })}
    />
  );
}

function SchoolYearTimeline({ months, viewMonth, todayMonth, onSelect }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [viewMonth]);

  return (
    <section className="gear-rotation-months">
      <h2 className="gear-rotation-months__title">학년도 월별 보기</h2>
      <div className="gear-rotation-months__scroll">
        {months.map((m) => {
          const isView = m === viewMonth;
          const isToday = m === todayMonth;
          const [, mo] = m.split("-").map(Number);
          return (
            <button
              key={m}
              ref={isView ? activeRef : undefined}
              type="button"
              className={`gear-rotation-month-btn${isView ? " gear-rotation-month-btn--active" : ""}`}
              onClick={() => onSelect(m)}
            >
              <span className="gear-rotation-month-btn__label">{MONTH_SHORT[mo] || `${mo}월`}</span>
              {isToday && <span className="gear-rotation-month-btn__now">이번 달</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GearPhotoGroup({ entries }) {
  if (!entries.length) return null;

  const countMod = entries.length === 1 ? "single" : "multi";

  return (
    <div className={`gear-rotation-equipment-images gear-rotation-equipment-images--${countMod}`}>
      {entries.map(({ item, label, name }) => (
        <div key={`${label}-${name}`} className="gear-rotation-equipment-image-card">
          {label ? <span className="gear-rotation-photo-label">{label}</span> : null}
          <GearPhoto item={item} alt={name} />
        </div>
      ))}
    </div>
  );
}

function gearNamesForLessonPlan(gear) {
  if (!gear) return [];
  if (gear.merged) return [gear.item_name].filter(Boolean);
  if (gear.parts?.length) return gear.parts.map(p => p.name).filter(Boolean);
  return [gear.item_name || gear.displayName].filter(Boolean);
}

function withObjectParticle(value) {
  const text = String(value || "교구").trim();
  const last = text.charCodeAt(text.length - 1);
  const hasFinalConsonant = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${text}${hasFinalConsonant ? "을" : "를"}`;
}

function fallbackKoreanPlanText(name, ageGroup = "5") {
  const value = String(name || "");
  const objectName = withObjectParticle(value || "교구");
  if (/꽃게.*낚시|낚시.*꽃게/i.test(value)) {
    if (ageGroup === "3_4") return "가까이 놓인 꽃게와 문어를 고리로 천천히 낚아보며 눈과 손의 협응력과 소근육 조절력, 활동에 대한 자신감을 기릅니다.";
    if (ageGroup === "7") return "정해진 시간 안에 서로 다른 점수의 바다 동물을 정확하게 낚아보며 거리 조절 능력과 집중력, 전략적 사고와 협동심을 기릅니다.";
    return "거리와 위치가 다른 꽃게와 문어를 고리로 골라 낚아보며 눈과 손의 협응력과 거리 조절 능력, 집중력과 소근육 조절력을 기릅니다.";
  }
  if (/도넛/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 하나씩 옮겨 같은 색끼리 낮게 쌓아보며 눈과 손의 협응력과 소근육 조절력, 색 인지와 집중력을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 활용해 친구와 높고 안정적인 구조물을 설계하고 완성하며 공간 구성력과 문제 해결력, 협동심과 정교한 신체 조절력을 기릅니다.`;
    return `${objectName} 색과 순서에 맞춰 높이 쌓고 다양한 모양을 구성하며 눈과 손의 협응력과 집중력, 공간 구성력과 신체 조절력을 기릅니다.`;
  }
  if (/에어\s*T\s*터널|에어\s*티\s*터널|T\s*터널|티\s*터널/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 낮게 넘어보고 터널 안을 천천히 기어 통과하며 대근육과 공간 인지력, 균형감각과 새로운 움직임에 대한 자신감을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 빠르게 점프해 넘고 오르기와 통과하기를 연속 과제로 수행하며 순발력과 코어 근력, 민첩성과 전신 협응력을 기릅니다.`;
    return `${objectName} 점프해 넘고 위로 오른 뒤 터널을 통과하는 연속 활동을 통해 하체 근력과 전신 협응력, 균형감각과 공간 인지력을 기릅니다.`;
  }
  if (/에어.*(브릿지|다리)|레인보우.*브릿지/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 손으로 짚고 천천히 건넌 뒤 낮은 곳에서 안전하게 내려오며 균형감각과 대근육, 움직임에 대한 자신감을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 오르내리며 중간 지점에서 자세를 바꾸고 정해진 위치에 착지하는 활동으로 코어 근력과 민첩성, 정교한 균형 조절력을 기릅니다.`;
    return `${objectName} 양팔로 균형을 잡아 끝까지 건너고 반환점을 돌아오는 활동을 통해 하체 근력과 균형감각, 집중력과 신체 조절력을 기릅니다.`;
  }
  if (/에어.*(클라이밍|둥근|동근)|클라이밍.*매트/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 손과 무릎을 이용해 완만한 면을 천천히 오르고 반대편으로 내려오며 대근육과 균형감각, 높이에 대한 자신감을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 여러 방향에서 빠르게 오르고 정상에서 자세를 유지한 뒤 안전하게 내려오며 코어 근력과 민첩성, 판단력을 기릅니다.`;
    return `${objectName} 손과 발을 함께 사용해 정상까지 오른 뒤 몸의 중심을 조절하며 내려오는 활동으로 전신 근력과 협응력, 균형감각을 기릅니다.`;
  }
  if (/에어.*(삼각|사다리)|자이언트.*삼각/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 낮은 발판부터 차례로 손과 발을 옮겨 올라가며 대근육과 눈·손·발의 협응력, 높낮이 인지 능력을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 정해진 순서와 방향에 맞춰 빠르게 오르내리는 도전 활동으로 근지구력과 민첩성, 동작 계획 능력을 기릅니다.`;
    return `${objectName} 발판의 위치를 살피며 한 칸씩 오르고 반대편으로 안전하게 내려오며 전신 협응력과 하체 근력, 공간 인지력을 기릅니다.`;
  }
  if (/에어.*(정글짐|스파이더|지네)/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 사이를 천천히 기어가고 몸을 낮춰 빠져나오며 대근육과 공간 인지력, 새로운 환경에 적응하는 자신감을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 안팎의 여러 경로를 스스로 선택해 빠르게 이동하며 민첩성과 문제 해결력, 전신 협응력과 협동심을 기릅니다.`;
    return `${objectName} 사이의 길을 찾아 기어가고 넘으며 친구와 순서대로 코스를 완성해 공간 인지력과 전신 협응력, 판단력을 기릅니다.`;
  }
  if (/에어.*(트램폴린|바운스)/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 위에서 두 발로 가볍게 뛰고 멈추기를 반복하며 균형감각과 하체 근력, 리듬감과 자신감을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 위에서 점프 높이와 방향을 조절하고 신호에 맞춰 정확히 착지하며 순발력과 코어 근력, 신체 조절력을 기릅니다.`;
    return `${objectName} 위에서 일정한 박자로 연속 점프하고 신호에 맞춰 안전하게 멈추며 하체 근력과 균형감각, 리듬감과 집중력을 기릅니다.`;
  }
  if (/에어.*허들/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 두 발로 낮게 넘어보고 부드럽게 착지하며 기본 점프 능력과 하체 근력, 균형감각을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 높이와 간격에 맞춰 연속으로 뛰어넘고 방향을 전환하며 순발력과 민첩성, 리듬 조절 능력을 기릅니다.`;
    return `${objectName} 일정한 간격으로 연속 점프하고 마지막 지점에 안정적으로 착지하며 하체 근력과 전신 협응력, 거리 조절 능력을 기릅니다.`;
  }
  if (/밸런스|균형|징검|쿠션|스톤/i.test(value)) {
    if (ageGroup === "3_4") return `${value} 위를 천천히 걷고 두 발로 멈춰 균형을 잡아보며 대근육과 균형감각, 기본적인 신체 조절력을 기릅니다.`;
    if (ageGroup === "7") return `${value} 위에서 방향과 자세를 바꾸고 한 발 균형 과제를 수행하며 코어 근력과 집중력, 정교한 신체 조절력을 기릅니다.`;
    return `${value} 위를 다양한 방향으로 걷고 정해진 자세로 멈춰보며 균형감각과 코어 근력, 공간 인지력과 신체 조절력을 기릅니다.`;
  }
  if (/파이프.*공.*나르|공.*파이프|공.*나르/i.test(value)) {
    if (ageGroup === "3_4") return "파이프 위에 탁구공을 올려 중심을 잡고 가까운 거리까지 천천히 옮겨보며 눈과 손의 협응력과 집중력, 섬세한 힘 조절 능력을 기릅니다.";
    if (ageGroup === "7") return "친구들과 여러 개의 파이프를 빠르게 연결해 탁구공을 떨어뜨리지 않고 목표 지점까지 운반하며 정교한 신체 조절력과 문제 해결력, 협동심을 기릅니다.";
    return "파이프 위의 탁구공이 떨어지지 않도록 균형을 잡아 친구에게 전달하고, 파이프를 연결해 목표 지점까지 옮기며 눈과 손의 협응력과 집중력, 협동심을 기릅니다.";
  }
  if (/판.*뒤집|보드.*뒤집/i.test(value)) {
    if (ageGroup === "3_4") return "보드 위에 두 발로 서서 중심을 잡고 같은 색을 찾아 천천히 뒤집어보며 균형감각과 색 인지, 눈과 손의 협응력을 기릅니다.";
    if (ageGroup === "7") return "팀을 나누어 정해진 색의 보드를 빠르게 뒤집고 상대 팀의 움직임에 맞춰 전략적으로 이동하며 민첩성과 판단력, 협동심을 기릅니다.";
    return "보드 위에서 안정적으로 중심을 잡은 뒤 신호에 맞는 색으로 빠르게 뒤집고 팀 대결을 해보며 균형감각과 순발력, 집중력과 협동심을 기릅니다.";
  }
  if (/스펀지.*체조.*볼|체조.*스펀지.*볼/i.test(value)) {
    if (ageGroup === "3_4") return "스펀지 체조볼 위에 손과 발을 올려 천천히 중심을 잡고 낮게 건너가며 대근육과 균형감각, 새로운 움직임에 대한 자신감을 기릅니다.";
    if (ageGroup === "7") return "스펀지 체조볼 위를 균형 있게 건너고 점프로 넘은 뒤 앞·뒤 구르기 동작을 연결하며 코어 근력과 유연성, 전신 협응력과 신체 조절력을 기릅니다.";
    return "스펀지 체조볼 위에서 중심을 잡아 건너고 두 발로 점프해 넘은 뒤 앞 구르기에 도전하며 균형감각과 대근육, 전신 협응력과 자신감을 기릅니다.";
  }
  if (/공|볼|오자미|빈백|바스켓/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 가까운 거리에서 굴리고 두 손으로 받아보며 눈과 손의 협응력과 반응력, 기본적인 대근육 조절력을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 이동하며 정확한 목표로 던지고 빠르게 받아 연결하는 활동을 통해 민첩성과 정확성, 전신 협응력과 판단력을 기릅니다.`;
    return `${objectName} 다양한 거리의 목표로 던지고 받으며 힘과 방향을 조절해 눈과 손의 협응력과 거리 감각, 대근육과 반응력을 기릅니다.`;
  }
  if (/줄넘|점프|허들/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 두 발로 천천히 넘어보고 안전하게 착지하며 하체 근력과 균형감각, 기본 점프 능력을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 연속으로 빠르게 넘고 방향을 전환하는 도전 활동을 통해 하체 근력과 순발력, 민첩성과 리듬감을 기릅니다.`;
    return `${objectName} 앞·뒤·옆으로 리듬감 있게 연속 점프하며 하체 근력과 순발력, 균형감각과 전신 협응력을 기릅니다.`;
  }
  if (/에어|사다리|터널|옥타곤|삼각/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 손으로 충분히 탐색한 뒤 천천히 걷고 기어가며 말랑한 바닥의 변화를 경험해 대근육과 균형감각, 활동에 대한 자신감을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 활용해 점프, 방향 전환, 정지 동작을 연결하고 친구와 코스를 완성하며 민첩성과 근지구력, 판단력과 협동심을 기릅니다.`;
    return `${objectName} 위에서 걷기와 기어가기, 멈추기 동작을 차례로 수행하며 몸의 중심을 조절해 균형감각과 전신 협응력, 집중력을 기릅니다.`;
  }
  if (/컵|도미노|블록|스택/i.test(value)) {
    if (ageGroup === "3_4") return `${objectName} 하나씩 옮기고 낮게 쌓아보며 눈과 손의 협응력과 소근육 조절력, 집중력과 성취감을 기릅니다.`;
    if (ageGroup === "7") return `${objectName} 활용해 친구와 정해진 구조를 빠르고 정확하게 완성하며 공간 구성력과 문제 해결력, 협동심을 기릅니다.`;
    return `${objectName} 순서와 모양에 맞춰 옮기고 쌓으며 눈과 손의 협응력과 집중력, 공간 구성력과 신체 조절력을 기릅니다.`;
  }
  if (ageGroup === "3_4") return `${objectName} 천천히 탐색하고 간단한 이동 동작을 따라 하며 대근육과 균형감각, 기본적인 신체 조절력과 자신감을 기릅니다.`;
  if (ageGroup === "7") return `${objectName} 활용한 복합 움직임 과제를 빠르고 정확하게 수행하며 민첩성과 전신 협응력, 판단력과 협동심을 기릅니다.`;
  return `${objectName} 활용해 방향과 빠르기를 바꾸며 연속 동작을 수행해 전신 협응력과 대근육, 공간 인지력과 신체 조절력을 기릅니다.`;
}

function naturalEnglishEquipmentName(koreanName, registeredEnglishName = "") {
  if (registeredEnglishName && !hasKorean(registeredEnglishName)) return registeredEnglishName;
  const value = String(koreanName || "");
  if (/꽃게.*낚시|낚시.*꽃게/i.test(value)) return "Crab Fishing Game";
  if (/도넛/i.test(value)) return "Donut Rings";
  if (/에어\s*T\s*터널|에어\s*티\s*터널|T\s*터널|티\s*터널/i.test(value)) return "Air T-Tunnel";
  if (/에어.*터널|터널/i.test(value)) return "Air Tunnel";
  if (/에어.*(둥근|동근).*클라이밍/i.test(value)) return "Air Round Climbing Mat";
  if (/에어.*클라이밍|클라이밍.*매트/i.test(value)) return "Air Climbing Mat";
  if (/에어.*장애물|장애물/i.test(value)) return "Air Obstacle Course";
  if (/파이프.*공.*나르|공.*나르/i.test(value)) return "Pipe Ball Relay";
  if (/판.*뒤집/i.test(value)) return "Flip Board Game";
  if (/스펀지.*체조.*볼/i.test(value)) return "Sponge Exercise Balls";
  if (/밸런스|균형|징검|스톤/i.test(value)) return "Balance Stepping Stones";
  if (/오자미|빈백/i.test(value)) return "Bean Bags";
  if (/바스켓/i.test(value)) return "Moving Basket";
  if (/공|볼/i.test(value)) return "Soft Balls";
  if (/줄넘/i.test(value)) return "Jump Rope";
  if (/허들/i.test(value)) return "Hurdles";
  if (/컵/i.test(value)) return "Jumbo Cups";
  if (/도미노/i.test(value)) return "Domino Blocks";
  if (/사다리/i.test(value)) return "Activity Ladder";
  return "Movement Activity Equipment";
}

function fallbackEnglishPlanText(koreanName, englishName) {
  const value = String(koreanName || "");
  const equipment = englishName || naturalEnglishEquipmentName(value);
  if (/꽃게.*낚시|낚시.*꽃게/i.test(value)) {
    return "Children use rings to catch crabs, octopuses, and other sea-animal shapes. This playful fishing activity develops hand-eye coordination, fine motor control, concentration, and distance awareness.";
  }
  if (/도넛/i.test(value)) {
    return "Children carry and stack the donut rings to build towers and create different shapes. The activity develops hand-eye coordination, fine motor control, concentration, and spatial awareness.";
  }
  if (/에어\s*T\s*터널|에어\s*티\s*터널|T\s*터널|티\s*터널/i.test(value)) {
    return "Children jump over, climb onto, and crawl through the Air T-Tunnel in different ways. These movements strengthen the lower body and improve balance, whole-body coordination, and spatial awareness.";
  }
  if (/밸런스|균형|징검|쿠션|스톤/i.test(value)) {
    return `Children step, stop, and balance on the ${equipment} using different body positions. The activity develops core strength, balance, concentration, and body control.`;
  }
  if (/파이프.*공.*나르|공.*파이프|공.*나르/i.test(value)) {
    return "Children balance a table-tennis ball on a pipe, carry it carefully to a partner, and connect several pipes to move the ball to a target. The activity develops hand-eye coordination, concentration, precise force control, and teamwork.";
  }
  if (/판.*뒤집|보드.*뒤집/i.test(value)) {
    return "Children balance on the boards, turn them over to match the correct color, and play a lively team challenge. The activity develops balance, reaction speed, color recognition, decision-making, and teamwork.";
  }
  if (/스펀지.*체조.*볼|체조.*스펀지.*볼/i.test(value)) {
    return "Children balance and step across the sponge exercise balls, jump over them, and practice forward or backward rolls at an appropriate level. The activity develops core strength, flexibility, whole-body coordination, balance, and confidence.";
  }
  if (/공|볼|오자미|빈백|바스켓/i.test(value)) {
    return `Children roll, throw, catch, and aim the ${equipment} at targets from different distances. The activity improves hand-eye coordination, distance control, reaction speed, and gross motor skills.`;
  }
  if (/줄넘|점프|허들/i.test(value)) {
    return `Children jump over and move around the ${equipment} using different directions and rhythms. The activity develops lower-body strength, agility, balance, and whole-body coordination.`;
  }
  if (/에어|사다리|터널|옥타곤|삼각|클라이밍/i.test(value)) {
    return `Children climb, cross, and move safely around the ${equipment} in different ways. The activity develops gross motor strength, balance, whole-body coordination, and spatial awareness.`;
  }
  if (/컵|도미노|블록|스택/i.test(value)) {
    return `Children carry and stack the ${equipment} to build towers and create different structures. The activity develops hand-eye coordination, fine motor control, concentration, and spatial planning.`;
  }
  return `Children explore the ${equipment} through guided movement challenges and simple games. The activity develops coordination, body control, spatial awareness, and confidence.`;
}

function fallbackEnglishKeyExpression(koreanName) {
  const value = String(koreanName || "");
  if (/꽃게.*낚시|낚시.*꽃게/i.test(value)) return "Aim the ring and catch a sea animal!";
  if (/도넛/i.test(value)) return "Stack the rings carefully and build it higher!";
  if (/에어\s*T\s*터널|에어\s*티\s*터널|T\s*터널|티\s*터널/i.test(value)) return "Jump over, climb up, and crawl through!";
  if (/파이프.*공.*나르|공.*나르/i.test(value)) return "Keep the ball steady and work together!";
  if (/판.*뒤집/i.test(value)) return "Move quickly, flip the board, and change direction!";
  if (/스펀지.*체조.*볼|체조.*스펀지.*볼/i.test(value)) return "Balance, jump over, and roll with control!";
  if (/밸런스|균형|징검|쿠션|스톤/i.test(value)) return "Step slowly, stop, and keep your balance!";
  if (/공|볼|오자미|빈백/i.test(value)) return "Aim, throw, and catch with both hands!";
  if (/바스켓/i.test(value)) return "Look at the basket and throw gently!";
  if (/줄넘|점프|허들/i.test(value)) return "Bend your knees, jump, and land softly!";
  if (/에어|사다리|터널|옥타곤|삼각|클라이밍|장애물/i.test(value)) return "Climb carefully, move across, and finish the course!";
  if (/컵|도미노|블록|스택/i.test(value)) return "Carry, stack, and build it together!";
  return "Follow the course, control your body, and finish strong!";
}

function hasKorean(value) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(value || ""));
}

function LessonPlanPanel({ plan }) {
  if (!plan) return null;
  return (
    <details className="gear-rotation-plan">
      <summary className="gear-rotation-plan__summary">수업 계획안</summary>
      <div className="gear-rotation-plan__body">
        {plan.activity_description ? (
          <div className="gear-rotation-plan__block">
            <div className="gear-rotation-plan__label">Activity</div>
            <p className="gear-rotation-plan__text">{plan.activity_description}</p>
          </div>
        ) : null}
        {plan.key_expressions ? (
          <div className="gear-rotation-plan__block">
            <div className="gear-rotation-plan__label">Key Expressions</div>
            <p className="gear-rotation-plan__text">{plan.key_expressions}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function WeekHighlightCard({
  variant, label, dateRange, gear, items, heldIds, lessonPlans, aliases,
  yearMonth, weekNumber, onRent, onOpenGear, readOnly = false,
}) {
  const typeBadge = gearTypeBadge(gear);
  const photoEntries = useMemo(
    () => resolveGearPhotoEntries(gear, items),
    [gear, items],
  );
  const entries = useMemo(
    () => (gear ? resolveGearItemEntries(gear, items) : []),
    [gear, items],
  );
  const rentedCount = entries.filter(e => e.item?.id && heldIds?.has(e.item.id)).length;
  const lessonPlan = useMemo(() => {
    if (!gear || !yearMonth || !weekNumber) return null;
    for (const name of gearNamesForLessonPlan(gear)) {
      const plan = findLessonPlanForKoreanItem(lessonPlans, aliases, yearMonth, weekNumber, name);
      if (plan) return plan;
    }
    return null;
  }, [gear, lessonPlans, aliases, yearMonth, weekNumber]);

  if (!gear) {
    return (
      <article className={`gear-rotation-highlight gear-rotation-highlight--${variant} gear-rotation-highlight--empty`}>
        <p>{label} 교구 정보 없음</p>
      </article>
    );
  }

  return (
    <article className={`gear-rotation-highlight gear-rotation-highlight--${variant}${photoEntries.length ? " gear-rotation-highlight--has-photo" : ""}`}>
      <div className="gear-rotation-highlight__content">
        <div className="gear-rotation-highlight__text">
          <p className="gear-rotation-highlight__period">
            {label}
            {dateRange ? <span>{dateRange}</span> : null}
          </p>
          <div className="gear-rotation-highlight__name-row">
            <h3 className="gear-rotation-highlight__name">{gear.displayName}</h3>
            <span className={`gear-rotation-type-badge gear-rotation-type-badge--${typeBadge.tone}`}>
              {typeBadge.label}
            </span>
          </div>
          {rentedCount > 0 ? (
            <p className="gear-rotation-highlight__rented-summary">대여 중 {rentedCount}종</p>
          ) : null}
          {gear.simple_activity && (
            <p className="gear-rotation-highlight__activity">{gear.simple_activity}</p>
          )}
          <LessonPlanPanel plan={lessonPlan} />
        </div>
        <GearPhotoGroup entries={photoEntries} />
        <div className={`gear-rotation-highlight__actions${variant === "current" && !readOnly ? "" : " gear-rotation-highlight__actions--single"}`}>
          {variant === "current" && !readOnly ? (
            <button type="button" className="gear-rotation-highlight__cta" onClick={() => onRent(gear)}>
              이 교구 대여 신청 →
            </button>
          ) : null}
          <button type="button" className="gear-rotation-highlight__link" onClick={() => onOpenGear(gear)}>
            상세 보기{entries.length > 1 ? ` (${entries.length})` : ""}
          </button>
        </div>
      </div>
    </article>
  );
}

function MonthGearRow({ row, items, status, heldIds, lessonPlans, aliases, viewMonth, onOpenGear }) {
  const typeBadge = gearTypeBadge(row.gear);
  const activityLine = row.gear.simple_activity
    || (row.gear.simpleActivities?.length ? row.gear.simpleActivities.join(" / ") : null);
  const photoEntries = useMemo(
    () => resolveGearPhotoEntries(row.gear, items),
    [row.gear, items],
  );

  const entries = useMemo(
    () => resolveGearItemEntries(row.gear, items),
    [row.gear, items],
  );
  const rentedEntries = entries.filter(e => e.item?.id && heldIds.has(e.item.id));
  const lessonPlan = useMemo(() => {
    for (const name of gearNamesForLessonPlan(row.gear)) {
      const plan = findLessonPlanForKoreanItem(
        lessonPlans, aliases, viewMonth, row.weekNumber, name,
      );
      if (plan) return plan;
    }
    return null;
  }, [row.gear, row.weekNumber, lessonPlans, aliases, viewMonth]);

  return (
    <article className="gear-rotation-row">
      <div className="gear-rotation-row__content">
        <div className="gear-rotation-row__header">
          <div className="gear-rotation-row__dates">
            {row.weekLabel ? (
              <>
                <div>{row.weekLabel}</div>
                {row.dateRange ? <div className="gear-rotation-row__dates-sub">{row.dateRange}</div> : null}
              </>
            ) : (row.dateRange || `${row.weekNumber}주차`)}
          </div>
          <div className="gear-rotation-row__title-row">
            <h4 className="gear-rotation-row__title">{row.gear.displayName}</h4>
            <span className={`gear-rotation-type-badge gear-rotation-type-badge--${typeBadge.tone}`}>
              {typeBadge.label}
            </span>
            <span className={`gear-rotation-status gear-rotation-status--${status.tone}`}>
              {status.label}
            </span>
          </div>
          {activityLine && (
            <p className="gear-rotation-row__meta">활동영역: {activityLine}</p>
          )}
          {rentedEntries.length > 0 ? (
            <p className="gear-rotation-row__rented-hint gear-rotation-row__rented-hint--inline">
              대여 {rentedEntries.length}종
            </p>
          ) : null}
          <LessonPlanPanel plan={lessonPlan} />
        </div>
        <GearPhotoGroup entries={photoEntries} />
        <div className="gear-rotation-row__actions">
          <button type="button" className="gear-rotation-row__link gear-rotation-row__link--btn" onClick={() => onOpenGear(row.gear)}>
            상세 보기{entries.length > 1 ? ` (${entries.length})` : ""}
          </button>
        </div>
      </div>
    </article>
  );
}

function GearItemsDetailModal({ gear, items, heldIds, onClose, onOpenItem }) {
  const entries = resolveGearItemEntries(gear, items);

  return (
    <div className="sch-modal-overlay" onClick={onClose}>
      <div className="sch-modal gear-rotation-gear-modal" onClick={e => e.stopPropagation()}>
        <h3>{gear?.displayName || "교구 상세"}</h3>
        <ul className="gear-rotation-gear-modal-list">
          {entries.map(({ label, name, item }) => {
            const rented = item?.id && heldIds.has(item.id);
            return (
              <li key={`${label}-${name}`} className="gear-rotation-gear-modal-item">
                <div>
                  {label ? <span className="gear-rotation-gear-modal-tag">{label}</span> : null}
                  <strong>{name}</strong>
                  {rented ? <span className="gear-rotation-gear-modal-rented">대여 중</span> : null}
                  {!item ? (
                    <p className="gear-rotation-gear-modal-miss">재고 목록에서 찾을 수 없음</p>
                  ) : null}
                </div>
                {item ? (
                  <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" onClick={() => onOpenItem(item)}>
                    상세 보기
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="sch-form-actions">
          <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function Spinner({ text }) {
  return (
    <div className="gear-rotation-loading">
      <div>⏳</div>
      <p>{text || "불러오는 중..."}</p>
    </div>
  );
}

export default function MyGearRotationPage({
  me,
  items,
  itemSets = [],
  reqs,
  ris,
  rets,
  onDetail,
  onGoRental,
  PageHeader,
  PageShell,
}) {
  const startYear = schoolYearStartYear();
  const todayMonth = yearMonthKey();
  const schoolMonths = useMemo(() => schoolYearMonths(startYear), [startYear]);
  const canUseRotationSearch = isScheduleAdmin(me);
  const canViewRotationRentalStatus = isScheduleAdmin(me);
  const canWritePrivateMonthlyPlan = isSuperAdmin(me);
  const pageTabs = useMemo(
    () => canWritePrivateMonthlyPlan
      ? [...PAGE_TABS, { id: "monthly-plan", label: "월간 계획안 작성" }]
      : PAGE_TABS,
    [canWritePrivateMonthlyPlan],
  );

  const [viewMonth, setViewMonth] = useState(() => clampToSchoolYear(todayMonth, startYear));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [weeklyLists, setWeeklyLists] = useState([]);
  const [allMonthWeeks, setAllMonthWeeks] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [equipmentAliases, setEquipmentAliases] = useState([]);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [gearDetail, setGearDetail] = useState(null);
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [searchMode, setSearchMode] = useState("gear");
  const [gearQuery, setGearQuery] = useState("");
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const [pageTab, setPageTab] = useState("mine");
  const [subjectTeacher, setSubjectTeacher] = useState(() => (
    me ? { id: me.id, name: me.name || "" } : null
  ));

  useEffect(() => {
    if (!me?.id) return;
    setSubjectTeacher((prev) => {
      if (!canUseRotationSearch) return { id: me.id, name: me.name || "" };
      if (!prev?.id || prev.id === me.id) {
        return { id: me.id, name: me.name || "" };
      }
      return prev;
    });
  }, [me?.id, me?.name, canUseRotationSearch]);

  useEffect(() => {
    if (!canUseRotationSearch) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("teachers")
        .select("id, name, role, active")
        .eq("active", true)
        .order("name");
      if (cancelled) return;
      if (err) {
        console.warn("[gear-rotation] teachers load failed", err.message);
        return;
      }
      setTeacherOptions(data || []);
    })();
    return () => { cancelled = true; };
  }, [canUseRotationSearch]);

  useEffect(() => {
    if (!canUseRotationSearch) return;
    let cancelled = false;
    const ymKeys = schoolMonths.map((m) => yearMonthFirstDay(m));
    (async () => {
      const { data, error: err } = await supabase
        .from("item_rotation_schedule")
        .select("year_month, assigned_letter, teacher_id")
        .in("year_month", ymKeys);
      if (cancelled) return;
      if (err && err.code !== "42P01") {
        console.warn("[gear-rotation] all schedules load failed", err.message);
        return;
      }
      setAllSchedules(data || []);
    })();
    return () => { cancelled = true; };
  }, [canUseRotationSearch, schoolMonths]);

  const subject = subjectTeacher?.id
    ? subjectTeacher
    : (me ? { id: me.id, name: me.name || "" } : null);
  const viewingOther = Boolean(
    canUseRotationSearch && subject?.id && me?.id && subject.id !== me.id,
  );

  const filteredTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    const list = teacherOptions;
    if (!q) return list.slice(0, 20);
    return list
      .filter((t) => String(t.name || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [teacherOptions, teacherQuery]);

  const selectSubjectTeacher = (teacher) => {
    if (!teacher?.id) return;
    setSubjectTeacher({ id: teacher.id, name: teacher.name || "" });
    setTeacherQuery(teacher.name || "");
    setTeacherPickerOpen(false);
  };

  const resetToSelf = () => {
    if (!me?.id) return;
    setSubjectTeacher({ id: me.id, name: me.name || "" });
    setTeacherQuery("");
    setTeacherPickerOpen(false);
  };

  const gearSearchResults = useMemo(
    () => searchGearAssignmentsForMonth({
      query: gearQuery,
      viewMonth,
      allSchedules,
      weeklyLists,
      monthWeeks: allMonthWeeks,
      teachers: teacherOptions,
      items,
      startYear,
    }),
    [gearQuery, viewMonth, allSchedules, weeklyLists, allMonthWeeks, teacherOptions, items, startYear],
  );

  const teacherAssignmentSummary = useMemo(
    () => buildTeacherMonthAssignmentSummary({
      teacher: subject,
      viewMonth,
      schedules,
      weeklyLists,
      monthWeeks: allMonthWeeks,
      startYear,
    }),
    [subject, viewMonth, schedules, weeklyLists, allMonthWeeks, startYear],
  );

  const selectTeacherFromGearResult = (entry) => {
    if (entry.teacherNames?.length !== 1) return;
    const teacher = teacherOptions.find((t) => t.name === entry.teacherNames[0]);
    if (!teacher) return;
    selectSubjectTeacher(teacher);
    setSearchMode("teacher");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!subject?.id) return;
      setLoading(true);
      setError("");
      try {
        const ymKeys = schoolMonths.map(m => yearMonthFirstDay(m));
        const subjectId = subject.id;
        const [schedRes, weeklyRes, weeksRes, plansRes, aliasRes] = await Promise.all([
          supabase.from("item_rotation_schedule")
            .select("year_month, assigned_letter, teacher_id")
            .eq("teacher_id", subjectId)
            .in("year_month", ymKeys),
          supabase.from("item_weekly_lists").select("*").order("week_number"),
          supabase.from("item_rotation_month_weeks")
            .select("*")
            .in("year_month", ymKeys)
            .order("week_number"),
          supabase.from("monthly_lesson_plans")
            .select("*")
            .in("year_month", ymKeys)
            .order("week_number"),
          supabase.from("equipment_name_aliases").select("*"),
        ]);

        if (schedRes.error?.code === "42P01") {
          setError("교구 순환 테이블이 아직 생성되지 않았습니다. 관리자에게 문의하세요.");
          return;
        }
        if (schedRes.error) throw schedRes.error;
        if (weeklyRes.error) throw weeklyRes.error;
        if (weeksRes.error && weeksRes.error.code !== "42P01") throw weeksRes.error;
        if (plansRes.error && plansRes.error.code !== "42P01") throw plansRes.error;
        if (aliasRes.error && aliasRes.error.code !== "42P01") throw aliasRes.error;

        if (!cancelled) {
          setSchedules(resolveRotationSchedules(schedRes.data || [], subject, startYear));
          setWeeklyLists(weeklyRes.data || []);
          setAllMonthWeeks(weeksRes.data || []);
          setLessonPlans(plansRes.error?.code === "42P01" ? [] : (plansRes.data || []));
          setEquipmentAliases(aliasRes.error?.code === "42P01" ? [] : (aliasRes.data || []));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subject?.id, subject?.name, schoolMonths, startYear]);

  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    const refreshDate = () => setTodayKey(new Date().toDateString());
    const timer = window.setInterval(refreshDate, 60 * 1000);
    window.addEventListener("focus", refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);

  const heldIds = useMemo(() => {
    if (viewingOther) return new Set();
    const rentals = buildCurrentRentals(me, reqs || [], ris || [], items || [], rets || []);
    return new Set(rentals.map(r => r.itemId).filter(Boolean));
  }, [me, reqs, ris, items, rets, todayKey, viewingOther]);

  const letterForMonth = (monthKey) => assignedLetterForMonth(schedules, subject, monthKey);

  const weeksForMonth = (monthKey) =>
    allMonthWeeks.filter(w => w.year_month?.startsWith(String(monthKey).slice(0, 7)));

  const currentWeekSlot = useMemo(
    () => findCurrentRotationWeekSlot(allMonthWeeks),
    [allMonthWeeks],
  );

  const thisWeekLabel = currentWeekSlot
    ? rotationWeekLabelForSlot(currentWeekSlot)
    : formatCalendarWeekLabel();
  const thisWeekRange = currentWeekSlot
    ? rotationWeekRangeForSlot(currentWeekSlot)
    : formatCalendarWeekRange();

  const currentMonthKey = currentWeekSlot
    ? String(currentWeekSlot.year_month).slice(0, 7)
    : todayMonth;

  const currentLetter = letterForMonth(currentMonthKey);

  const thisWeekGear = useMemo(() => {
    if (!currentLetter || !currentWeekSlot) return null;
    return getWeekItemsForLetter(weeklyLists, currentLetter, currentWeekSlot.week_number);
  }, [currentLetter, currentWeekSlot, weeklyLists]);

  const nextWeekSlot = useMemo(
    () => findNextRotationWeekSlot(allMonthWeeks),
    [allMonthWeeks],
  );

  const nextWeekLabel = nextWeekSlot
    ? rotationWeekLabelForSlot(nextWeekSlot)
    : formatCalendarWeekLabel(new Date(Date.now() + 7 * 86400000));
  const nextWeekRange = nextWeekSlot
    ? rotationWeekRangeForSlot(nextWeekSlot)
    : formatCalendarWeekRange(new Date(Date.now() + 7 * 86400000));

  const nextWeekMonthKey = nextWeekSlot ? String(nextWeekSlot.year_month).slice(0, 7) : null;
  const nextLetter = nextWeekMonthKey ? letterForMonth(nextWeekMonthKey) : null;

  const nextWeekGear = useMemo(() => {
    if (!nextLetter || !nextWeekSlot) return null;
    return getWeekItemsForLetter(weeklyLists, nextLetter, nextWeekSlot.week_number);
  }, [nextLetter, nextWeekSlot, weeklyLists]);

  const viewLetter = letterForMonth(viewMonth);
  const viewMonthWeeks = weeksForMonth(viewMonth);

  const monthWeekRows = useMemo(() => {
    if (!viewLetter) return [];
    const weeksMap = new Map(viewMonthWeeks.map(w => [w.week_number, w]));
    const weekNumbers = viewMonthWeeks.length
      ? [...viewMonthWeeks].sort((a, b) => a.week_number - b.week_number).map(w => w.week_number)
      : [1, 2, 3, 4, 5];
    return weekNumbers.map(wn => {
      const gear = getWeekItemsForLetter(weeklyLists, viewLetter, wn);
      if (!gear) return null;
      const mw = weeksMap.get(wn);
      return {
        weekNumber: wn,
        dateRange: mw ? formatWeekRange(mw.week_start_date, mw.week_end_date) : null,
        weekLabel: mw ? rotationWeekLabelForSlot(mw) : null,
        weekSlot: mw || null,
        gear,
        status: weekRentalStatusForGear(mw, gear, items, heldIds),
      };
    }).filter(Boolean);
  }, [viewLetter, weeklyLists, viewMonthWeeks, items, heldIds]);

  const monthlyPlanGearSuggestions = useMemo(() => {
    const aliasMaps = buildAliasMaps(equipmentAliases);
    if (!viewLetter) return [];
    const planRows = [1, 2, 3, 4, 5].map((weekNumber) => ({
      weekNumber,
      gear: getWeekItemsForLetter(weeklyLists, viewLetter, weekNumber),
    })).filter((row) => row.gear);
    return planRows.map((row) => {
      const gearEntries = resolveGearItemEntries(row.gear, items);
      const options = gearEntries.map((entry) => {
        const item = entry.item || null;
        const koreanName = entry.name || item?.name || "";
        const lessonPlan = findLessonPlanForKoreanItem(
          lessonPlans,
          equipmentAliases,
          viewMonth,
          row.weekNumber,
          koreanName,
        );
        const englishNameCandidate = lessonPlan?.equipment_name_en
          || resolveEnglishFromKorean(koreanName, aliasMaps)
          || "";
        const englishName = naturalEnglishEquipmentName(
          koreanName,
          hasKorean(englishNameCandidate) ? "" : englishNameCandidate,
        );
        const englishActivity = lessonPlan?.activity_description || "";
        const keyExpression = lessonPlan?.key_expressions || "";
        return {
          id: item?.id || `${row.weekNumber}-${koreanName}`,
          name: koreanName,
          photoUrl: item?.photo_url || "",
          activityDescription: fallbackKoreanPlanText(koreanName, "5"),
          activityDescriptions: {
            "3_4": fallbackKoreanPlanText(koreanName, "3_4"),
            "5": fallbackKoreanPlanText(koreanName, "5"),
            "7": fallbackKoreanPlanText(koreanName, "7"),
          },
          englishName,
          englishActivity: englishActivity && !hasKorean(englishActivity)
            ? englishActivity
            : fallbackEnglishPlanText(koreanName, englishName),
          keyExpression: keyExpression && !hasKorean(keyExpression)
            ? keyExpression
            : fallbackEnglishKeyExpression(koreanName),
        };
      }).filter((option) => option.name);
      const first = options[0] || {};
      return {
        weekNumber: row.weekNumber,
        ...first,
        options,
      };
    });
  }, [viewLetter, weeklyLists, items, lessonPlans, equipmentAliases, viewMonth]);

  const filteredRows = useMemo(
    () => monthWeekRows.filter(row => matchesFilter(filter, row.gear, items)),
    [monthWeekRows, filter, items],
  );

  const visibleRows = expanded ? filteredRows : filteredRows.slice(0, LIST_PREVIEW);
  const hasMore = filteredRows.length > LIST_PREVIEW;

  useEffect(() => {
    setExpanded(false);
    setFilter("all");
  }, [viewMonth, subject?.id]);

  const openItemRecord = (item) => {
    if (item) {
      onDetail(item, "my-gear-rotation");
      setGearDetail(null);
    }
  };

  const openGear = (gear) => {
    if (!gear) return;
    const entries = resolveGearItemEntries(gear, items);
    const resolved = entries.filter(e => e.item);
    if (resolved.length === 0) {
      alert(`「${gear.displayName}」 교구를 재고 목록에서 찾지 못했습니다.\n관리자에게 이름 매칭을 요청하세요.`);
      return;
    }
    if (resolved.length === 1) {
      openItemRecord(resolved[0].item);
      return;
    }
    setGearDetail(gear);
  };

  const handleRent = (gear) => {
    openGear(gear);
  };

  return (
    <PageShell>
      <PageHeader
        me={me}
        subtitle="이번 주 교구를 확인하고, 학년도 전체 월별 교구를 살펴볼 수 있습니다."
      />

      {canViewRotationRentalStatus ? (
        <div className="gear-rotation-page-tabs" role="tablist" aria-label="이번달 내 교구">
          {pageTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={pageTab === tab.id}
              className={`gear-rotation-page-tab${pageTab === tab.id ? " is-active" : ""}`}
              onClick={() => setPageTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {pageTab === "mine" ? (
        <>
          {loading && <Spinner text="순환 배정 불러오는 중..." />}
          {!loading && error && (
            <div className="gear-rotation-error">{error}</div>
          )}

          {!loading && !error && (
            <div className="gear-rotation-page">
              <section className="gear-rotation-highlights-grid">
                <WeekHighlightCard
                  variant="current"
                  label={thisWeekLabel}
                  dateRange={thisWeekRange}
                  gear={thisWeekGear}
                  items={items}
                  heldIds={heldIds}
                  lessonPlans={lessonPlans}
                  aliases={equipmentAliases}
                  yearMonth={currentMonthKey}
                  weekNumber={currentWeekSlot?.week_number}
                  onRent={handleRent}
                  onOpenGear={openGear}
                  readOnly={viewingOther}
                />
                <WeekHighlightCard
                  variant="next"
                  label={nextWeekLabel}
                  dateRange={nextWeekRange}
                  gear={nextWeekGear}
                  items={items}
                  heldIds={heldIds}
                  lessonPlans={lessonPlans}
                  aliases={equipmentAliases}
                  yearMonth={nextWeekMonthKey}
                  weekNumber={nextWeekSlot?.week_number}
                  onRent={handleRent}
                  onOpenGear={openGear}
                  readOnly={viewingOther}
                />
              </section>

              {!currentWeekSlot && (
                <p className="gear-rotation-hint">
                  이번 주({thisWeekRange})에 해당하는 순환 주차 데이터가 없습니다.
                </p>
              )}

              {canUseRotationSearch ? (
                <div className="gear-rotation-search-panel">
                  <div className="gear-rotation-search-tabs" role="tablist" aria-label="검색 방식">
                    {ROTATION_SEARCH_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        role="tab"
                        aria-selected={searchMode === mode.id}
                        className={`gear-rotation-search-tab${searchMode === mode.id ? " is-active" : ""}`}
                        onClick={() => setSearchMode(mode.id)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {searchMode === "gear" ? (
                    <div className="gear-rotation-search-body">
                      <div className="gear-rotation-search-field">
                        <Search size={15} aria-hidden />
                        <input
                          type="search"
                          className="gear-rotation-search-field__input"
                          placeholder="교구명 검색 (예: 에어브릿지, 훌라후프)"
                          value={gearQuery}
                          onChange={(e) => setGearQuery(e.target.value)}
                          autoComplete="off"
                          aria-label="교구명 검색"
                        />
                        {gearQuery ? (
                          <button
                            type="button"
                            className="gear-rotation-search-field__clear"
                            onClick={() => setGearQuery("")}
                            aria-label="검색어 지우기"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                      <p className="gear-rotation-search-hint">
                        {monthLabel(viewMonth)} 기준 — 교구가 배정된 알파벳·선생님·주차를 찾습니다.
                      </p>
                      {gearQuery.trim() ? (
                        gearSearchResults.length === 0 ? (
                          <p className="gear-rotation-search-empty" role="status">
                            「{gearQuery.trim()}」에 맞는 {monthLabel(viewMonth)} 배정이 없습니다.
                          </p>
                        ) : (
                          <ul className="gear-rotation-search-results">
                            {gearSearchResults.map((entry) => (
                              <li key={`${entry.letter}|${entry.weekNumber}|${entry.targetType}|${entry.itemName}`}>
                                <button
                                  type="button"
                                  className="gear-rotation-search-result"
                                  onClick={() => selectTeacherFromGearResult(entry)}
                                  disabled={entry.teacherNames.length !== 1}
                                >
                                  <div className="gear-rotation-search-result__title">{entry.itemName}</div>
                                  <div className="gear-rotation-search-result__meta">
                                    알파벳 <strong>{entry.letter}</strong>
                                    {" · "}
                                    {entry.teacherNames.length
                                      ? entry.teacherNames.join(", ")
                                      : "담당 선생님 없음"}
                                    {" · "}
                                    {entry.weekNumber}주차 · {entry.targetType}
                                    {entry.dateRange ? ` · ${entry.dateRange}` : ""}
                                  </div>
                                  {entry.simpleActivity ? (
                                    <div className="gear-rotation-search-result__sub">{entry.simpleActivity}</div>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )
                      ) : null}
                    </div>
                  ) : (
                    <div className="gear-rotation-search-body">
                      <div className="gear-rotation-search-field">
                        <Search size={15} aria-hidden />
                        <input
                          type="search"
                          className="gear-rotation-search-field__input"
                          placeholder="선생님 이름 검색"
                          value={teacherQuery}
                          onChange={(e) => {
                            setTeacherQuery(e.target.value);
                            setTeacherPickerOpen(true);
                          }}
                          onFocus={() => setTeacherPickerOpen(true)}
                          onBlur={() => setTimeout(() => setTeacherPickerOpen(false), 150)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            if (filteredTeachers[0]) selectSubjectTeacher(filteredTeachers[0]);
                          }}
                          autoComplete="off"
                          aria-label="선생님 이름 검색"
                        />
                        {teacherQuery ? (
                          <button
                            type="button"
                            className="gear-rotation-search-field__clear"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setTeacherQuery("");
                              setTeacherPickerOpen(true);
                            }}
                            aria-label="검색어 지우기"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                        {teacherPickerOpen && filteredTeachers.length > 0 ? (
                          <ul className="gear-rotation-search-field__list" role="listbox">
                            {filteredTeachers.map((t) => (
                              <li key={t.id}>
                                <button
                                  type="button"
                                  className={`gear-rotation-search-field__option${subject?.id === t.id ? " is-active" : ""}`}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectSubjectTeacher(t)}
                                >
                                  {t.name}
                                  {t.id === me?.id ? <span>나</span> : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {teacherPickerOpen && teacherQuery.trim() && filteredTeachers.length === 0 ? (
                          <div className="gear-rotation-search-field__empty" role="status">
                            선생님을 찾을 수 없습니다
                          </div>
                        ) : null}
                      </div>

                      <div className="gear-rotation-search-meta">
                        <span>
                          보는 중: <strong>{subject?.name || "—"}</strong>
                          {teacherAssignmentSummary.letter ? (
                            <> · {teacherAssignmentSummary.monthLabel} 알파벳 <strong>{teacherAssignmentSummary.letter}</strong></>
                          ) : null}
                        </span>
                        {viewingOther ? (
                          <button type="button" className="gear-rotation-search-reset" onClick={resetToSelf}>
                            내 교구로
                          </button>
                        ) : null}
                      </div>

                      {teacherAssignmentSummary.letter && teacherAssignmentSummary.rows.length > 0 ? (
                        <ul className="gear-rotation-teacher-summary">
                          {teacherAssignmentSummary.rows.map((row) => (
                            <li key={row.weekNumber} className="gear-rotation-teacher-summary__row">
                              <span className="gear-rotation-teacher-summary__week">
                                {row.weekNumber}주차
                                {row.dateRange ? ` (${row.dateRange})` : ""}
                              </span>
                              <span className="gear-rotation-teacher-summary__gear">{row.gearLabel}</span>
                            </li>
                          ))}
                        </ul>
                      ) : subject?.name ? (
                        <p className="gear-rotation-search-empty">
                          {teacherAssignmentSummary.monthLabel} 순환 배정이 없습니다.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              <SchoolYearTimeline
                months={schoolMonths}
                viewMonth={viewMonth}
                todayMonth={todayMonth}
                onSelect={setViewMonth}
              />

              <section className="gear-rotation-list-section">
                <div className="gear-rotation-list-head">
                  <h2 className="gear-rotation-list-title">
                    {monthLabel(viewMonth)} 전체 교구
                    {viewLetter ? (
                      <span className="gear-rotation-letter-pill">알파벳 {viewLetter}</span>
                    ) : null}
                  </h2>
                  <div className="gear-rotation-filters">
                    {FILTERS.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className={`gear-rotation-filter${filter === f.id ? " gear-rotation-filter--active" : ""}`}
                        onClick={() => setFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!viewLetter && (
                  <div className="gear-rotation-empty">{monthLabel(viewMonth)} 순환 배정이 없습니다.</div>
                )}

                {viewLetter && filteredRows.length === 0 && (
                  <div className="gear-rotation-empty">해당 필터에 맞는 교구가 없습니다.</div>
                )}

                {viewLetter && filteredRows.length > 0 && (
                  <>
                    <div className="gear-rotation-list">
                      {visibleRows.map(row => (
                        <MonthGearRow
                          key={row.weekNumber}
                          row={row}
                          items={items}
                          status={row.status}
                          heldIds={heldIds}
                          lessonPlans={lessonPlans}
                          aliases={equipmentAliases}
                          viewMonth={viewMonth}
                          onOpenGear={openGear}
                        />
                      ))}
                    </div>
                    {hasMore && (
                      <button
                        type="button"
                        className="gear-rotation-expand"
                        onClick={() => setExpanded(v => !v)}
                      >
                        {expanded ? "접기" : "더 많은 교구 보기"}
                        <ChevronDown size={16} className={expanded ? "gear-rotation-expand__icon--up" : ""} />
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </>
      ) : pageTab === "monthly-plan" && canWritePrivateMonthlyPlan ? (
        <SuperadminMonthlyPlanEditor
          supabase={supabase}
          me={me}
          month={viewMonth}
          onMonthChange={(nextMonth) => setViewMonth(clampToSchoolYear(nextMonth, startYear))}
          suggestedActivities={monthlyPlanGearSuggestions}
          programSuggestions={itemSets.map((program) => ({
            id: program.id,
            name: program.name,
            englishName: program.alias || "",
            description: program.usage_description || program.description || "",
            photoUrl: program.photo_url || "",
            requiredGear: (program.components || []).map((component) => component.name).filter(Boolean),
          }))}
        />
      ) : (
        <TeacherRotationRentalStatusSection
          items={items}
          reqs={reqs}
          ris={ris}
          rets={rets}
          weeklyLists={weeklyLists}
          monthWeeks={allMonthWeeks}
          weekSlot={currentWeekSlot}
          weekRangeLabel={thisWeekRange}
        />
      )}

      {gearDetail ? (
        <GearItemsDetailModal
          gear={gearDetail}
          items={items}
          heldIds={heldIds}
          onClose={() => setGearDetail(null)}
          onOpenItem={openItemRecord}
        />
      ) : null}
    </PageShell>
  );
}

/** 대여 기간이 순환 배정과 겹치는지 검사 (다른 강사) */
export async function checkRotationRentalConflicts(client, {
  me, cartItems, items, dispatch_start, dispatch_end, teachers,
}) {
  if (!cartItems?.length || !dispatch_start || !dispatch_end) return [];

  const start = new Date(`${dispatch_start}T12:00:00`);
  const end = new Date(`${dispatch_end}T12:00:00`);
  const months = new Set();
  const d = new Date(start);
  while (d <= end) {
    months.add(yearMonthFirstDay(yearMonthKey(d)));
    d.setMonth(d.getMonth() + 1, 1);
  }

  const { data: schedules } = await client
    .from("item_rotation_schedule")
    .select("teacher_id, year_month, assigned_letter")
    .in("year_month", [...months]);

  if (!schedules?.length) return [];

  const { data: weeklyLists } = await client.from("item_weekly_lists").select("*");
  const { data: monthWeeks } = await client
    .from("item_rotation_month_weeks")
    .select("*")
    .in("year_month", [...months]);

  const teacherMap = new Map((teachers || []).map(t => [t.id, t.name]));
  const conflicts = [];

  for (const ci of cartItems) {
    const item = items.find(i => i.id === ci.item_id);
    if (!item) continue;

    for (const sched of schedules) {
      if (sched.teacher_id === me.id) continue;
      const schedLetter = sched.assigned_letter;
      const ym = sched.year_month;

      const assignedRows = (weeklyLists || []).filter(w => {
        if (w.letter !== schedLetter) return false;
        const resolved = resolveItemRecord(items, w.item_name);
        return w.item_name === item.name || resolved?.id === item.id;
      });
      if (!assignedRows.length) continue;

      const weeksForMonth = (monthWeeks || []).filter(w => w.year_month === ym);
      for (const row of assignedRows) {
        const mw = weeksForMonth.find(w => w.week_number === row.week_number);
        let overlaps = true;
        let weekStart = null;
        let weekEnd = null;
        let dateRange = `${row.week_number}주차`;
        if (mw) {
          weekStart = mw.week_start_date;
          weekEnd = mw.week_end_date;
          const ws = new Date(`${mw.week_start_date}T12:00:00`);
          const we = new Date(`${mw.week_end_date}T12:00:00`);
          dateRange = formatWeekRange(mw.week_start_date, mw.week_end_date) || dateRange;
          overlaps = start <= we && end >= ws;
        }
        if (!overlaps) continue;

        conflicts.push({
          itemId: item.id,
          itemName: item.name,
          teacherId: sched.teacher_id,
          teacherName: teacherMap.get(sched.teacher_id) || "다른 강사",
          dateRange,
          weekStart,
          weekEnd,
          targetType: row.target_type,
          totalQuantity: item.total_quantity ?? 1,
        });
      }
    }
  }

  const seen = new Set();
  return conflicts.filter(c => {
    const k = `${c.itemName}|${c.teacherName}|${c.weekStart || c.dateRange}|${c.weekEnd || ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 예: 2026-07-20 → 7월 20일 */
export function formatKoMonthDay(ymd) {
  if (!ymd) return "";
  const parts = String(ymd).slice(0, 10).split("-").map(Number);
  if (parts.length < 3 || !parts[1] || !parts[2]) return String(ymd);
  return `${parts[1]}월 ${parts[2]}일`;
}

/** ymd 하루 전 (KST 달력 기준, 로컬 noon 파싱) */
export function ymdAddDays(ymd, deltaDays) {
  if (!ymd) return null;
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 순환 충돌 경고 문구 (재고 수와 무관, 확인 후 진행 허용용)
 * actionLabel: "대여" | "예약"
 */
export function formatRotationConflictConfirmMessage(conflicts, { actionLabel = "대여" } = {}) {
  if (!conflicts?.length) return "";
  const lines = conflicts.map(c => {
    const range = (c.weekStart && c.weekEnd)
      ? `${formatKoMonthDay(c.weekStart)} ~ ${formatKoMonthDay(c.weekEnd)}`
      : (c.dateRange || "");
    return `${c.itemName}은(는) ${c.teacherName} 선생님의 ${range} 정규수업(순환) 교구입니다.`;
  });
  return `${lines.join("\n")}\n\n그래도 ${actionLabel}하시겠습니까?`;
}

/** 승인 직후 반납기한 안내용: 교구별 가장 빠른 순환 겹침 */
export function earliestRotationConflictByItem(conflicts) {
  const byItem = new Map();
  for (const c of conflicts || []) {
    if (!c.itemName || !c.weekStart) continue;
    const prev = byItem.get(c.itemId || c.itemName);
    if (!prev || c.weekStart < prev.weekStart) {
      byItem.set(c.itemId || c.itemName, c);
    }
  }
  return [...byItem.values()];
}
