import { useEffect, useMemo, useState } from "react";
import { Download, FileImage, FileText, Languages, PartyPopper, RefreshCw, Save, Upload } from "lucide-react";

const AGE_GROUPS = [
  { id: "3_4", label: "3~4세" },
  { id: "5", label: "5~6세" },
  { id: "7", label: "7세" },
];
const ALL_GROUPS = [...AGE_GROUPS, { id: "en", label: "English" }];
const EVENT_PRESETS = [
  { id: "holiday", name: "명절놀이", englishName: "Korean Holiday Games", ko: "전통놀이의 움직임을 재미있게 경험하며 균형감각과 신체 조절력, 우리 문화에 대한 친밀감을 기릅니다.", en: "Children enjoy Korean traditional movement games and develop balance, body control, coordination, and cultural awareness." },
  { id: "christmas", name: "크리스마스", englishName: "Christmas Activity Day", ko: "크리스마스 이야기를 활용한 신체 놀이와 협동 미션을 통해 전신 협응력과 표현력, 배려와 협동심을 기릅니다.", en: "Children enjoy Christmas-themed movement missions that develop whole-body coordination, creative expression, kindness, and teamwork." },
  { id: "winter", name: "겨울놀이", englishName: "Winter Play Day", ko: "연탄 나르기와 이글루 만들기, 눈놀이를 신체 활동으로 표현하며 대근육과 공간 구성력, 협동심과 계절 인지력을 기릅니다.", en: "Children explore winter through coal-carrying, igloo-building, and snow-themed movement games that develop gross motor skills, spatial planning, and teamwork." },
  { id: "halloween", name: "할로윈", englishName: "Halloween Activity Day", ko: "할로윈 이야기 속 인물과 장면을 다양한 움직임으로 표현하고 미션을 해결하며 민첩성과 상상력, 자신감을 기릅니다.", en: "Children act out Halloween characters and complete playful movement missions that develop agility, imagination, body control, and confidence." },
  { id: "yellow", name: "옐로우데이", englishName: "Yellow Day", ko: "노란색 교구와 색깔 미션을 활용해 찾기, 옮기기, 협동 활동을 경험하며 색 인지와 집중력, 전신 협응력을 기릅니다.", en: "Children use yellow equipment in searching, carrying, and teamwork challenges that develop color recognition, concentration, and whole-body coordination." },
  { id: "hero", name: "히어로데이", englishName: "Hero Day", ko: "히어로가 되어 장애물을 통과하고 친구를 돕는 미션을 수행하며 민첩성과 문제 해결력, 용기와 협동심을 기릅니다.", en: "Children become heroes, complete obstacle missions, and help their teammates while developing agility, problem-solving, courage, and cooperation." },
];

function planDisplayName(value) {
  return String(value || "").trim().replace(/\s*프로그램\s*$/u, "").replace(/\s*program\s*$/iu, "").trim();
}

function eventDescriptionForAge(description, ageGroup) {
  if (!description) return "";
  if (ageGroup === "3_4") return `${description} 익숙한 동작부터 천천히 참여하며 즐거운 성공 경험을 쌓도록 돕습니다.`;
  if (ageGroup === "7") return `${description} 스스로 방법을 생각하고 친구와 역할을 나누는 도전 과제로 활동을 확장합니다.`;
  return `${description} 친구와 순서를 지키고 서로 응원하며 다양한 방법으로 활동을 완성합니다.`;
}

function makeRows() {
  return Object.fromEntries(ALL_GROUPS.map(({ id }) => [
    id,
    Array.from({ length: 5 }, (_, index) => ({
      position: index + 1,
      activity_name: "",
      activity_description: "",
      key_expression: "",
      image_path: "",
      image_url: "",
    })),
  ]));
}

function monthTitle(month) {
  const [year, monthNumber] = String(month || "").split("-");
  if (!year || !monthNumber) return "MONTHLY LESSON PLAN";
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return `${date.toLocaleString("en-US", { month: "long" }).toUpperCase()} LESSON PLAN`;
}

function isMissingSchema(error) {
  return /42P01|42703|schema cache|does not exist|monthly_plan_drafts|key_expression|image_path/i.test(
    `${error?.code || ""} ${error?.message || ""}`,
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageMarkup(row, alt) {
  if (!row.image_url) return '<div class="photo-placeholder">GTS</div>';
  return `<img src="${escapeHtml(row.image_url)}" alt="${escapeHtml(alt)}" />`;
}

function monthNumber(month) {
  const value = Number(String(month || "").split("-")[1]);
  return value >= 1 && value <= 12 ? value : new Date().getMonth() + 1;
}

const KOREAN_MONTHLY_THEMES = {
  1: "겨울의 신체 변화를 느끼며 몸을 충분히 깨우고 활기차게 움직이는 경험을 중심으로",
  2: "새로운 시작을 준비하며 익숙한 동작을 자신 있게 확장하고 성취감을 느끼는 활동을 중심으로",
  3: "새로운 친구와 환경에 편안하게 적응하며 즐거운 움직임으로 관계를 맺는 경험을 중심으로",
  4: "봄의 생동감을 몸으로 표현하고 여러 방향과 속도를 탐색하는 활동을 중심으로",
  5: "서로의 움직임을 존중하고 함께 응원하며 협력의 즐거움을 느끼는 경험을 중심으로",
  6: "상반기에 익힌 기본 움직임을 연결해 몸을 더욱 안정적이고 정확하게 조절하는 활동을 중심으로",
  7: "여름의 활기찬 에너지를 안전한 움직임으로 표현하며 도전의 즐거움을 느끼는 경험을 중심으로",
  8: "더운 날씨에도 안전수칙을 지키며 실내에서 집중력 있게 몸을 조절하는 활동을 중심으로",
  9: "선선한 계절에 다양한 움직임을 확장하고 친구와 호흡을 맞추는 경험을 중심으로",
  10: "상상력과 이야기 요소를 신체 놀이에 담아 창의적으로 움직이고 표현하는 활동을 중심으로",
  11: "한 해 동안 자란 신체 능력을 활용해 조금 더 복합적인 과제에 도전하는 경험을 중심으로",
  12: "겨울과 연말의 즐거운 분위기 속에서 함께 움직이고 배려하며 성취를 나누는 활동을 중심으로",
};

const ENGLISH_MONTHLY_THEMES = {
  1: "This month focuses on warming up the body and staying active through energetic winter movement.",
  2: "This month helps children build confidence by extending familiar movements into new challenges.",
  3: "This month supports a positive start through welcoming movement games and shared experiences.",
  4: "This month invites children to explore spring-inspired movement in different directions and speeds.",
  5: "This month emphasizes cooperation, encouragement, and the joy of moving together.",
  6: "This month connects fundamental movements into more controlled and purposeful sequences.",
  7: "This month channels lively summer energy into safe, active, and enjoyable physical challenges.",
  8: "This month focuses on safe indoor movement, concentration, and careful body control.",
  9: "This month expands movement skills while encouraging children to coordinate and work with friends.",
  10: "This month combines imagination and storytelling with creative physical expression.",
  11: "This month encourages children to apply their growing skills to more complex movement challenges.",
  12: "This month celebrates progress through joyful winter activities, teamwork, and shared achievement.",
};

function buildMonthlyEnglishGoal(suggestions, month) {
  const source = (suggestions || []).map((item) => `${item.englishName || ""} ${item.englishActivity || ""}`).join(" ").toLowerCase();
  const focuses = [];
  const activities = [];
  const add = (list, value) => { if (!list.includes(value)) list.push(value); };

  if (/balance|stepping|climb|tunnel|obstacle/.test(source)) add(focuses, "balance and whole-body coordination");
  if (/throw|catch|aim|fishing|ring|ball|basket/.test(source)) add(focuses, "hand-eye coordination and accuracy");
  if (/stack|build|donut|domino|cup/.test(source)) add(focuses, "fine motor control and spatial planning");
  if (/jump|hurdle|rope|course/.test(source)) add(focuses, "agility and lower-body strength");
  if (/climb|tunnel|obstacle|ladder/.test(source)) add(activities, "climbing and obstacle-course challenges");
  if (/throw|catch|aim|fishing|ball|basket/.test(source)) add(activities, "target and object-control games");
  if (/stack|build|donut|domino|cup/.test(source)) add(activities, "stacking and construction activities");
  if (/balance|stepping/.test(source)) add(activities, "balance pathways");
  if (/jump|hurdle|rope/.test(source)) add(activities, "jumping and rhythm activities");

  const focusText = focuses.slice(0, 3).join(", ") || "coordination, balance, and body control";
  const activityText = activities.slice(0, 3).join(", ") || "varied movement activities";
  const monthlyTheme = ENGLISH_MONTHLY_THEMES[monthNumber(month)];
  return `${monthlyTheme} Through ${activityText}, children develop ${focusText} while moving safely and confidently.`;
}

function buildMonthlyKoreanGoal(rows, ageLabel, month) {
  const source = (rows || []).map((row) => row.activity_description || "").join(" ");
  const candidates = [
    ["전신 협응력", (source.match(/협응력/g) || []).length],
    ["균형감각", (source.match(/균형/g) || []).length],
    ["공간 인지력", (source.match(/공간/g) || []).length],
    ["대근육", (source.match(/대근육|하체 근력/g) || []).length],
    ["소근육 조절력", (source.match(/소근육/g) || []).length],
    ["집중력", (source.match(/집중력/g) || []).length],
    ["자신감", (source.match(/자신감/g) || []).length],
  ].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label]) => label);
  const focus = candidates.length ? candidates.join(", ") : "전신 협응력, 균형감각과 신체 조절력";
  const monthlyTheme = KOREAN_MONTHLY_THEMES[monthNumber(month)];

  if (ageLabel === "3~4세") {
    return `${monthlyTheme}, 호기심이 많고 놀이를 통해 몸의 움직임을 알아가는 아이들이 교구를 친근하게 탐색하도록 수업을 진행합니다. 아이 한 명 한 명의 속도와 마음을 세심하게 살피며 안전한 성공 경험을 쌓고, 자연스럽게 ${focus}을 기를 수 있도록 돕겠습니다.`;
  }
  if (ageLabel === "5~6세") {
    return `${monthlyTheme}, 새로운 움직임에 도전하고 친구와 함께하는 즐거움이 커지는 아이들의 성향을 고려해 다양한 방법으로 교구를 활용합니다. 각자의 개성과 자신감을 소중히 여기며 ${focus}을 고르게 기를 수 있도록 돕겠습니다.`;
  }
  return `${monthlyTheme}, 스스로 생각하고 움직임을 조절하며 친구와 협력하는 힘이 자라나는 아이들에게 깊이 있는 신체 활동과 즐거운 도전 과제를 제공합니다. 모든 아이가 성취의 기쁨을 느끼도록 따뜻하게 격려하며 ${focus}을 균형 있게 기르겠습니다.`;
}

function printableReportHtml({ language, month, rowsByGroup, englishGoal, selectedAge, logoUrl }) {
  const isEnglish = language === "en";
  const selectedAgeMeta = AGE_GROUPS.find(({ id }) => id === selectedAge) || AGE_GROUPS[0];
  const title = monthTitle(month);
  const koreanSections = [selectedAgeMeta].map(({ id, label }) => `
    <section class="age-section">
      <h2>${escapeHtml(label)}</h2>
      <div class="goal korean-goal"><strong>목표</strong><span>${escapeHtml(buildMonthlyKoreanGoal(rowsByGroup[id], label, month))}</span></div>
      <table>
        <colgroup><col class="week-col" /><col class="equipment-col" /><col /></colgroup>
        <thead><tr><th>주차</th><th>교구 및 활동</th><th>활동 내용 및 발달 도움</th></tr></thead>
        <tbody>${rowsByGroup[id].map((row, index) => `
          <tr>
            <td class="week">${index + 1}주</td>
            <td class="equipment"><strong>${escapeHtml(row.activity_name || "-")}</strong>${imageMarkup(row, row.activity_name)}</td>
            <td class="description">${escapeHtml(row.activity_description || "-")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <div class="report-closing"><p class="report-notice">This monthly plan is subject to change depending on circumstances.</p></div>
    </section>`).join("");
  const englishSection = `
    <section class="english-section">
      ${englishGoal ? `<div class="goal"><strong>Goal</strong><span>${escapeHtml(englishGoal)}</span></div>` : ""}
      <table>
        <colgroup><col class="week-en" /><col class="equipment-en" /><col /><col class="expression-en" /></colgroup>
        <thead><tr><th>Week</th><th>Equipment</th><th>Activity</th><th>Key Expression</th></tr></thead>
        <tbody>${rowsByGroup.en.map((row, index) => `
          <tr>
            <td class="week">Week ${index + 1}</td>
            <td class="equipment"><strong>${escapeHtml(row.activity_name || "-")}</strong>${imageMarkup(row, row.activity_name)}</td>
            <td class="description">${escapeHtml(row.activity_description || "-")}</td>
            <td class="expression">${escapeHtml(row.key_expression || "-")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <div class="report-closing"><p class="report-notice">This monthly plan is subject to change depending on circumstances.</p></div>
    </section>`;

  return `<!doctype html><html lang="${isEnglish ? "en" : "ko"}"><head><meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: 210mm; min-height: 297mm; }
      body { margin: 0; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Noto Sans KR", "Apple SD Gothic Neo", Arial, sans-serif; background: #fff; }
      .report-page { display: flex; flex-direction: column; width: 210mm; height: 297mm; padding: 10mm 15mm 10mm; overflow: hidden; background: #fff; }
      .report-header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 8px; border-bottom: 2px solid #169153; }
      .brand { display: flex; align-items: center; gap: 9px; }
      .brand-logo-wrap { position: relative; width: 50px; height: 50px; overflow: hidden; }
      .brand-logo { position: absolute; left: 50%; top: 50%; width: 128px; height: 64px; max-width: none; object-fit: contain; transform: translate(-50%, -50%); }
      .brand-name { font-size: 18px; font-weight: 900; letter-spacing: -.02em; }
      .brand-tagline { margin-top: 1px; color: #617067; font-size: 7.5px; font-weight: 750; letter-spacing: .12em; }
      .report-type { color: #6c7a72; font-size: 9px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
      .report-title { margin: 0 0 12px; padding: 17px 0 6px; }
      h1 { margin: 0; color: #12261b; font-size: 23px; font-weight: 900; text-align: center; letter-spacing: -.025em; }
      .report-closing { margin-top: 16px; padding-top: 7px; border-top: 2px solid #169153; }
      .report-notice { margin: 0; color: #65736b; font-size: 7.5px; font-style: italic; text-align: center; }
      h2 { margin: 0 0 7px; padding-left: 2px; color: #176d40; font-size: 13px; font-weight: 900; }
      .age-section, .english-section { display: flex; flex-direction: column; margin-bottom: 4px; break-inside: avoid; page-break-inside: avoid; }
      table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; overflow: hidden; border: 1.1px solid #597066; border-radius: 4px; }
      th, td { border-right: .7px solid #72837b; border-bottom: .7px solid #72837b; }
      th:last-child, td:last-child { border-right: 0; }
      tbody tr:last-child td { border-bottom: 0; }
      th { height: 27px; padding: 5px 6px; background: #eaf4ee; color: #21382c; font-size: 9px; font-weight: 850; text-align: center; }
      td { padding: 6px 9px; font-size: 9px; line-height: 1.48; vertical-align: middle; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      tbody tr { height: 33mm; }
      tbody tr:nth-child(even) td { background: #fbfdfc; }
      .week-col { width: 10%; } .equipment-col { width: 30%; }
      .week-en { width: 9%; } .equipment-en { width: 25%; } .expression-en { width: 20%; }
      td.week { text-align: center; font-weight: 850; }
      td.equipment { text-align: center; }
      td.equipment strong { display: block; margin-bottom: 5px; font-size: 9px; }
      td.equipment img { display: block; width: 68px; height: 50px; margin: 0 auto; object-fit: contain; }
      .photo-placeholder { display: grid; place-items: center; width: 68px; height: 47px; margin: 0 auto; border-radius: 5px; background: #f1f5f2; color: #a3afa8; font-size: 8px; font-weight: 800; }
      td.description { white-space: pre-wrap; }
      td.expression { text-align: center; font-weight: 750; }
      .goal { display: grid; grid-template-columns: 46px 1fr; gap: 8px; margin: 0 0 12px; padding: 7px 10px; border: 1px solid #dbe8e0; border-left: 3px solid #169153; border-radius: 3px; background: #f3f8f5; font-size: 9px; line-height: 1.45; }
      .goal strong { color: #176d40; }
      .report-footer { margin-top: auto; padding-top: 6px; border-top: 1px solid #dce5df; color: #809087; font-size: 7px; text-align: right; }
      .report-page--ko h1 { font-size: 24px; }
      .report-page--ko h2 { font-size: 14px; }
      .report-page--ko th { font-size: 9.7px; font-weight: 900; letter-spacing: -.01em; }
      .report-page--ko td { font-size: 10.2px; line-height: 1.52; }
      .report-page--ko td.equipment strong { font-size: 10px; }
      .report-page--ko .goal { font-size: 9.8px; line-height: 1.5; }
      .report-page--ko .report-notice { font-size: 8px; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body><main class="report-page report-page--${isEnglish ? "en" : "ko"}">
      <header class="report-header"><div class="brand"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="GTS logo" /></div><div><div class="brand-name">GTS</div><div class="brand-tagline">GROW THROUGH SPORTS</div></div></div><div class="report-type">Monthly Physical Education Report</div></header>
      <div class="report-title"><h1>${escapeHtml(title)}</h1></div>
      ${isEnglish ? englishSection : koreanSections}
      <footer class="report-footer">GTS · Grow Through Sports</footer></main>
      <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 450); });</script>
    </body></html>`;
}

export default function SuperadminMonthlyPlanEditor({
  supabase,
  me,
  month,
  onMonthChange,
  suggestedActivities = [],
  programSuggestions = [],
}) {
  const [planId, setPlanId] = useState(null);
  const [rowsByGroup, setRowsByGroup] = useState(makeRows);
  const [language, setLanguage] = useState("ko");
  const [englishGoal, setEnglishGoal] = useState("");
  const [pdfAge, setPdfAge] = useState("3_4");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [message, setMessage] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [gearPickerOpen, setGearPickerOpen] = useState(false);
  const [selectedGearByWeek, setSelectedGearByWeek] = useState({});
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [eventWeek, setEventWeek] = useState("1");
  const [eventChoice, setEventChoice] = useState("holiday");
  const [eventTargets, setEventTargets] = useState(["3_4", "5", "7", "en"]);
  const [customEventName, setCustomEventName] = useState("");
  const [customEventDescription, setCustomEventDescription] = useState("");

  const normalizedSuggestions = useMemo(
    () => suggestedActivities.map((value, index) => {
      if (typeof value === "string") {
        return { weekNumber: index + 1, name: value.trim(), options: [] };
      }
      return {
        weekNumber: Number(value?.weekNumber) || index + 1,
        name: String(value?.name || "").trim(),
        photoUrl: String(value?.photoUrl || "").trim(),
        activityDescription: String(value?.activityDescription || "").trim(),
        activityDescriptions: value?.activityDescriptions || {},
        englishName: String(value?.englishName || "").trim(),
        englishActivity: String(value?.englishActivity || "").trim(),
        keyExpression: String(value?.keyExpression || "").trim(),
        options: Array.isArray(value?.options) ? value.options : [],
      };
    }).filter((value) => value.name).slice(0, 5),
    [suggestedActivities],
  );

  const normalizedPrograms = useMemo(() => programSuggestions.map((program) => ({
    id: String(program?.id || ""),
    name: planDisplayName(program?.name),
    englishName: planDisplayName(program?.englishName) || planDisplayName(program?.name),
    description: String(program?.description || "").trim(),
    photoUrl: String(program?.photoUrl || "").trim(),
    requiredGear: Array.isArray(program?.requiredGear) ? program.requiredGear : [],
  })).filter((program) => program.id && program.name), [programSuggestions]);

  useEffect(() => {
    if (!me?.id || !month) return undefined;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setMessage("");
      setSetupRequired(false);
      const { data: plan, error: planError } = await supabase
        .from("monthly_plan_drafts")
        .select("id, updated_at, english_goal")
        .eq("owner_id", me.id)
        .eq("year_month", `${month}-01`)
        .maybeSingle();

      if (planError) {
        if (isMissingSchema(planError)) {
          if (!cancelled) {
            setSetupRequired(true);
            setRowsByGroup(makeRows());
          }
          return;
        }
        throw planError;
      }

      if (!plan) {
        if (!cancelled) {
          setPlanId(null);
          setRowsByGroup(makeRows());
          setEnglishGoal("");
          setLastSavedAt(null);
        }
        return;
      }

      const { data: entries, error: entriesError } = await supabase
        .from("monthly_plan_draft_entries")
        .select("age_group, position, activity_name, activity_description, key_expression, image_path")
        .eq("plan_id", plan.id)
        .order("position");
      if (entriesError) throw entriesError;

      const next = makeRows();
      for (const entry of entries || []) {
        const group = next[entry.age_group];
        const index = Number(entry.position) - 1;
        if (!group || index < 0 || index >= group.length) continue;
        let imageUrl = "";
        if (entry.image_path) {
          if (/^https?:\/\//i.test(entry.image_path)) {
            imageUrl = entry.image_path;
          } else {
            const { data } = await supabase.storage.from("monthly-plan-images").createSignedUrl(entry.image_path, 3600);
            imageUrl = data?.signedUrl || "";
          }
        }
        group[index] = {
          position: index + 1,
          activity_name: entry.activity_name || "",
          activity_description: entry.activity_description || "",
          key_expression: entry.key_expression || "",
          image_path: entry.image_path || "",
          image_url: imageUrl,
        };
      }
      if (!cancelled) {
        setPlanId(plan.id);
        setRowsByGroup(next);
        setEnglishGoal(plan.english_goal || "");
        setLastSavedAt(plan.updated_at || null);
      }
    })()
      .catch((error) => {
        if (!cancelled) setMessage(error?.message || "계획안을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [me?.id, month, supabase]);

  const setRow = (groupId, index, key, value) => {
    setRowsByGroup((previous) => ({
      ...previous,
      [groupId]: previous[groupId].map((row, rowIndex) => (
        rowIndex === index ? { ...row, [key]: value } : row
      )),
    }));
    setMessage("");
  };

  const applyGearSuggestions = (suggestionsByGroup) => {
    const englishSuggestions = Array.isArray(suggestionsByGroup)
      ? suggestionsByGroup
      : suggestionsByGroup.en || [];
    setRowsByGroup((previous) => Object.fromEntries(ALL_GROUPS.map(({ id }) => [
      id,
      previous[id].map((row, index) => {
        const groupSuggestions = Array.isArray(suggestionsByGroup)
          ? suggestionsByGroup
          : suggestionsByGroup[id] || [];
        const byWeek = new Map(groupSuggestions.map((suggestion) => [suggestion.weekNumber, suggestion]));
        const suggestion = byWeek.get(index + 1) || groupSuggestions[index];
        if (!suggestion) return row;
        const isEnglish = id === "en";
        return {
          ...row,
          activity_name: isEnglish
            ? (suggestion.englishName || "Selected Equipment")
            : (suggestion.name || row.activity_name),
          activity_description: (
            isEnglish
              ? suggestion.englishActivity
              : (suggestion.activityDescriptions?.[id] || suggestion.activityDescription)
          ) || row.activity_description,
          key_expression: (isEnglish ? suggestion.keyExpression : "") || row.key_expression,
          image_path: suggestion.photoUrl || row.image_path,
          image_url: suggestion.photoUrl || row.image_url,
        };
      }),
    ])));
    setEnglishGoal(buildMonthlyEnglishGoal(englishSuggestions, month));
    setGearPickerOpen(false);
    setMessage("선택한 교구의 이름·사진·활동 내용을 불러왔습니다.");
  };

  const fillFromGear = () => {
    if (!normalizedSuggestions.length) {
      setMessage("선택한 달에 등록된 내 교구가 없습니다.");
      return;
    }
    const hasMultiple = normalizedSuggestions.some((suggestion) => suggestion.options.length > 1);
    if (!hasMultiple) {
      applyGearSuggestions(normalizedSuggestions.map((suggestion) => suggestion.options[0] || suggestion));
      return;
    }
    setSelectedGearByWeek(Object.fromEntries(ALL_GROUPS.flatMap(({ id }) => (
      normalizedSuggestions.map((suggestion) => [
        `${id}-${suggestion.weekNumber}`,
        suggestion.options[0]?.id || "",
      ])
    ))));
    setGearPickerOpen(true);
    setMessage("각 연령과 영어 계획안에 사용할 교구를 하나씩 선택해 주세요.");
  };

  const confirmGearSelection = () => {
    const selected = Object.fromEntries(ALL_GROUPS.map(({ id }) => [
      id,
      normalizedSuggestions.map((suggestion) => {
        const options = suggestion.options.length ? suggestion.options : [suggestion];
        const selectedId = selectedGearByWeek[`${id}-${suggestion.weekNumber}`];
        const option = options.find((candidate) => candidate.id === selectedId) || options[0];
        return { ...option, weekNumber: suggestion.weekNumber };
      }),
    ]));
    applyGearSuggestions(selected);
  };

  const toggleEventTarget = (groupId) => {
    setEventTargets((previous) => previous.includes(groupId)
      ? previous.filter((value) => value !== groupId)
      : [...previous, groupId]);
  };

  const applyEventDay = () => {
    const weekIndex = Math.max(0, Math.min(4, Number(eventWeek) - 1));
    const program = eventChoice.startsWith("program:")
      ? normalizedPrograms.find((item) => item.id === eventChoice.slice(8))
      : null;
    const preset = EVENT_PRESETS.find((item) => item.id === eventChoice);
    const koreanName = planDisplayName(program?.name || preset?.name || customEventName);
    if (!koreanName) {
      setMessage("이벤트데이 이름을 입력해 주세요.");
      return;
    }
    if (!eventTargets.length) {
      setMessage("이벤트데이를 적용할 계획안을 하나 이상 선택해 주세요.");
      return;
    }

    const baseDescription = program?.description || preset?.ko || customEventDescription
      || `${koreanName}의 주제와 교구를 활용한 신체 활동을 즐겁고 안전하게 경험합니다.`;
    const rawEnglishName = planDisplayName(program?.englishName || preset?.englishName || customEventName);
    const englishName = /[가-힣]/.test(rawEnglishName) ? "Special Activity Day" : rawEnglishName;
    const englishDescription = preset?.en || (program
      ? `Children take part in the ${englishName} using the required equipment in a safe and cooperative way. The activity develops coordination, confidence, creativity, and teamwork.`
      : customEventDescription);

    setRowsByGroup((previous) => Object.fromEntries(ALL_GROUPS.map(({ id }) => [
      id,
      previous[id].map((row, index) => {
        if (index !== weekIndex || !eventTargets.includes(id)) return row;
        const isEnglish = id === "en";
        return {
          ...row,
          activity_name: isEnglish ? englishName : koreanName,
          activity_description: isEnglish ? englishDescription : eventDescriptionForAge(baseDescription, id),
          key_expression: isEnglish ? `Let's enjoy ${englishName} and work together!` : "",
          image_path: program?.photoUrl || "",
          image_url: program?.photoUrl || "",
        };
      }),
    ])));
    if (eventTargets.includes("en")) {
      setEnglishGoal(`${ENGLISH_MONTHLY_THEMES[monthNumber(month)]} The ${englishName} adds a special opportunity for creativity, confidence, and teamwork.`);
    }
    setEventPickerOpen(false);
    setMessage(`${eventWeek}주차에 ${koreanName} 이벤트를 적용했습니다. 내용과 사진은 표에서 바로 수정할 수 있습니다.`);
  };

  const uploadImage = async (groupId, index, file) => {
    if (!file || !me?.id) return;
    if (!file.type.startsWith("image/")) {
      setMessage("사진 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("사진은 5MB 이하로 올려주세요.");
      return;
    }
    const key = `${groupId}-${index}`;
    setUploadingKey(key);
    setMessage("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${me.id}/${month}/${groupId}-${index + 1}-${file.lastModified}.${extension}`;
      const { error } = await supabase.storage.from("monthly-plan-images").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = await supabase.storage.from("monthly-plan-images").createSignedUrl(path, 3600);
      setRow(groupId, index, "image_path", path);
      setRow(groupId, index, "image_url", data?.signedUrl || URL.createObjectURL(file));
      setMessage("사진을 불러왔습니다. 계획안을 저장하면 함께 보관됩니다.");
    } catch (error) {
      setMessage(error?.message || "사진을 올리지 못했습니다.");
    } finally {
      setUploadingKey("");
    }
  };

  const save = async () => {
    if (!me?.id || !month || saving || setupRequired) return;
    setSaving(true);
    setMessage("");
    try {
      const now = new Date().toISOString();
      const { data: plan, error: planError } = await supabase
        .from("monthly_plan_drafts")
        .upsert({
          owner_id: me.id,
          year_month: `${month}-01`,
          title: monthTitle(month),
          english_goal: englishGoal.trim(),
          status: "draft",
          updated_at: now,
        }, { onConflict: "owner_id,year_month" })
        .select("id, updated_at")
        .single();
      if (planError) throw planError;

      const { error: deleteError } = await supabase
        .from("monthly_plan_draft_entries")
        .delete()
        .eq("plan_id", plan.id);
      if (deleteError) throw deleteError;

      const entries = ALL_GROUPS.flatMap(({ id }) => rowsByGroup[id].map((row) => ({
        plan_id: plan.id,
        age_group: id,
        position: row.position,
        activity_name: row.activity_name.trim(),
        activity_description: row.activity_description.trim(),
        key_expression: row.key_expression.trim(),
        image_path: row.image_path || null,
      })));
      const { error: insertError } = await supabase.from("monthly_plan_draft_entries").insert(entries);
      if (insertError) throw insertError;

      setPlanId(plan.id);
      setLastSavedAt(plan.updated_at || now);
      setMessage("한국어·영어 계획안이 임시 저장되었습니다. 현재는 본인에게만 보입니다.");
    } catch (error) {
      if (isMissingSchema(error)) setSetupRequired(true);
      setMessage(error?.message || "계획안 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const saveAsPdf = () => {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setMessage("PDF 창을 열 수 없습니다. 브라우저의 팝업 차단을 해제해 주세요.");
      return;
    }
    reportWindow.opener = null;
    reportWindow.document.open();
    reportWindow.document.write(printableReportHtml({
      language,
      month,
      rowsByGroup,
      englishGoal,
      selectedAge: pdfAge,
      logoUrl: new URL("/brand/gts-company-logo.png", window.location.origin).href,
    }));
    reportWindow.document.close();
  };

  const imageCell = (groupId, row, index) => (
    <div className="monthly-plan-image-field">
      {row.image_url ? (
        <img src={row.image_url} alt={`${row.activity_name || index + 1}주차 교구`} />
      ) : (
        <span><FileImage size={24} /> 교구 사진</span>
      )}
      <label className="monthly-plan-image-field__button">
        <Upload size={13} /> {uploadingKey === `${groupId}-${index}` ? "올리는 중" : "사진 불러오기"}
        <input
          type="file"
          accept="image/*"
          disabled={Boolean(uploadingKey)}
          onChange={(event) => uploadImage(groupId, index, event.target.files?.[0])}
        />
      </label>
    </div>
  );

  if (loading) return <div className="monthly-plan-editor monthly-plan-editor--loading">계획안을 불러오는 중...</div>;

  return (
    <section className="monthly-plan-editor" aria-label="월간 계획안 작성">
      <div className="monthly-plan-editor__toolbar">
        <div>
          <span className="monthly-plan-editor__eyebrow">내 월간 계획안 · 임시저장</span>
          <h2><FileText size={21} /> 월간 계획안 작성</h2>
          <p>한국어는 연령별로, 영어는 공통 계획안 한 장으로 작성합니다.</p>
        </div>
        <div className="monthly-plan-editor__controls">
          <label><span>작성 월</span><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
          <button type="button" className="monthly-plan-editor__gear-button" onClick={fillFromGear} disabled={setupRequired}>
            <RefreshCw size={15} /> 교구 선택·변경
          </button>
          <button type="button" className="monthly-plan-editor__event-button" onClick={() => setEventPickerOpen((open) => !open)} disabled={setupRequired}>
            <PartyPopper size={15} /> 이벤트데이 추가
          </button>
          <button type="button" className="monthly-plan-editor__save-button" onClick={save} disabled={saving || setupRequired}>
            <Save size={15} /> {saving ? "저장 중..." : "임시 저장"}
          </button>
          {language === "ko" ? (
            <label className="monthly-plan-editor__pdf-age">
              <span>PDF 연령</span>
              <select value={pdfAge} onChange={(event) => setPdfAge(event.target.value)}>
                {AGE_GROUPS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" className="monthly-plan-editor__pdf-button" onClick={saveAsPdf} disabled={setupRequired}>
            <Download size={15} /> PDF 저장
          </button>
        </div>
      </div>

      {eventPickerOpen ? (
        <section className="monthly-plan-event-picker" aria-label="이벤트데이 추가">
          <div className="monthly-plan-gear-picker__heading">
            <div><strong>이벤트데이 추가</strong><span>선택한 주차와 계획안에 특별 프로그램을 적용합니다.</span></div>
            <button type="button" onClick={() => setEventPickerOpen(false)}>닫기</button>
          </div>
          <div className="monthly-plan-event-picker__grid">
            <label><span>적용 주차</span><select value={eventWeek} onChange={(event) => setEventWeek(event.target.value)}>{[1, 2, 3, 4, 5].map((week) => <option key={week} value={week}>{week}주차</option>)}</select></label>
            <label><span>이벤트/프로그램</span><select value={eventChoice} onChange={(event) => setEventChoice(event.target.value)}>
              <optgroup label="이벤트데이">{EVENT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</optgroup>
              {normalizedPrograms.length ? <optgroup label="등록된 프로그램">{normalizedPrograms.map((program) => <option key={program.id} value={`program:${program.id}`}>{program.name}</option>)}</optgroup> : null}
              <option value="custom">직접 입력</option>
            </select></label>
          </div>
          {eventChoice === "custom" ? (
            <div className="monthly-plan-event-picker__custom">
              <label><span>이벤트 이름</span><input value={customEventName} onChange={(event) => setCustomEventName(event.target.value)} placeholder="예: 스포츠 페스티벌" /></label>
              <label><span>활동 내용</span><textarea value={customEventDescription} onChange={(event) => setCustomEventDescription(event.target.value)} placeholder="진행할 활동과 발달 도움을 입력하세요." /></label>
            </div>
          ) : null}
          <fieldset className="monthly-plan-event-picker__targets">
            <legend>적용할 계획안</legend>
            {ALL_GROUPS.map(({ id, label }) => <label key={id}><input type="checkbox" checked={eventTargets.includes(id)} onChange={() => toggleEventTarget(id)} /> {label}</label>)}
          </fieldset>
          {eventChoice.startsWith("program:") ? (
            <p className="monthly-plan-event-picker__gear-list">필요 교구: {normalizedPrograms.find((program) => `program:${program.id}` === eventChoice)?.requiredGear.join(", ") || "등록된 교구 없음"}</p>
          ) : null}
          <button type="button" className="monthly-plan-editor__save-button monthly-plan-event-picker__apply" onClick={applyEventDay}>선택한 주차에 적용</button>
        </section>
      ) : null}

      <div className="monthly-plan-language-tabs" role="tablist" aria-label="계획안 언어 선택">
        <button type="button" className={language === "ko" ? "is-active" : ""} onClick={() => setLanguage("ko")}>
          <FileText size={16} /> 한국어 계획안 <small>연령별</small>
        </button>
        <button type="button" className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>
          <Languages size={16} /> English Lesson Plan <small>공통 1개</small>
        </button>
      </div>
      <p className="monthly-plan-editor__edit-hint">교구명, 활동 내용과 핵심 표현은 불러온 뒤 표 안에서 자유롭게 수정할 수 있습니다.</p>

      {setupRequired ? (
        <div className="monthly-plan-editor__setup">
          Supabase SQL Editor에서 <strong>supabase/superadmin_monthly_plan_multilingual_patch.sql</strong>을 실행해 주세요.
        </div>
      ) : null}
      {message ? <div className="monthly-plan-editor__message" role="status">{message}</div> : null}

      {gearPickerOpen ? (
        <section className="monthly-plan-gear-picker" aria-label="계획안 교구 선택">
          <div className="monthly-plan-gear-picker__heading">
            <div><strong>연령별 계획안 교구 선택</strong><span>같은 주차라도 연령별로 서로 다른 교구를 고를 수 있습니다.</span></div>
            <button type="button" onClick={() => setGearPickerOpen(false)}>취소</button>
          </div>
          <div className="monthly-plan-gear-picker__groups">
            {ALL_GROUPS.map(({ id, label }) => (
              <section key={id} className={`monthly-plan-gear-picker__group${id === "en" ? " is-english" : ""}`}>
                <h4>{id === "en" ? "English · 공통" : label}</h4>
                <div className="monthly-plan-gear-picker__weeks">
                  {normalizedSuggestions.map((suggestion) => {
                    const options = suggestion.options.length ? suggestion.options : [suggestion];
                    const selectionKey = `${id}-${suggestion.weekNumber}`;
                    return (
                      <fieldset key={selectionKey}>
                        <legend>{suggestion.weekNumber}주차</legend>
                        <div className="monthly-plan-gear-picker__options">
                          {options.map((option) => (
                            <label key={option.id || option.name} className={selectedGearByWeek[selectionKey] === option.id ? "is-selected" : ""}>
                              <input
                                type="radio"
                                name={`monthly-plan-${selectionKey}`}
                                checked={selectedGearByWeek[selectionKey] === option.id}
                                onChange={() => setSelectedGearByWeek((previous) => ({ ...previous, [selectionKey]: option.id }))}
                              />
                              {option.photoUrl ? <img src={option.photoUrl} alt="" /> : <FileImage size={24} />}
                              <span>{id === "en" ? (option.englishName || option.name) : option.name}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <button type="button" className="monthly-plan-editor__save-button monthly-plan-gear-picker__confirm" onClick={confirmGearSelection}>
            선택한 교구 불러오기
          </button>
        </section>
      ) : null}

      <div className={`monthly-plan-document monthly-plan-document--${language}`}>
        <header className="monthly-plan-document__title">
          <h1>{monthTitle(month)}</h1>
          <span>{planId ? "저장된 초안" : "새 계획안"}</span>
        </header>

        {language === "ko" ? AGE_GROUPS.map(({ id, label }) => (
          <section key={id} className="monthly-plan-age-section">
            <h3>{label}</h3>
            <div className="monthly-plan-korean-goal" aria-label={`${label} 월간 목표`}>
              <strong>목표</strong>
              <span>{buildMonthlyKoreanGoal(rowsByGroup[id], label, month)}</span>
            </div>
            <div className="monthly-plan-table monthly-plan-table--ko" role="table" aria-label={`${label} 계획안`}>
              <div className="monthly-plan-table__header" role="row">
                <div role="columnheader">주차</div><div role="columnheader">교구 및 활동</div><div role="columnheader">활동 내용 및 발달 도움</div>
              </div>
              {rowsByGroup[id].map((row, index) => (
                <div className="monthly-plan-table__row" role="row" key={`${id}-${row.position}`}>
                  <div className="monthly-plan-week" role="cell">{index + 1}주</div>
                  <div className="monthly-plan-equipment" role="cell">
                    <input value={row.activity_name} onChange={(event) => setRow(id, index, "activity_name", event.target.value)} placeholder="교구 또는 활동명" />
                    {imageCell(id, row, index)}
                  </div>
                  <div role="cell"><textarea value={row.activity_description} onChange={(event) => setRow(id, index, "activity_description", event.target.value)} placeholder="활동 방법과 신체 발달에 도움이 되는 내용을 작성하세요." /></div>
                </div>
              ))}
            </div>
            <p className="monthly-plan-english-note">This monthly plan is subject to change depending on circumstances.</p>
          </section>
        )) : (
          <section className="monthly-plan-english-section">
            <label className="monthly-plan-goal">
              <span>✅ Goal</span>
              <textarea value={englishGoal} onChange={(event) => setEnglishGoal(event.target.value)} placeholder="Write the monthly learning goal." />
            </label>
            <div className="monthly-plan-table monthly-plan-table--en" role="table" aria-label="English monthly lesson plan">
              <div className="monthly-plan-table__header" role="row">
                <div role="columnheader">Week</div><div role="columnheader">Equipment</div><div role="columnheader">Activity</div><div role="columnheader">Key Expression</div>
              </div>
              {rowsByGroup.en.map((row, index) => (
                <div className="monthly-plan-table__row" role="row" key={`en-${row.position}`}>
                  <div className="monthly-plan-week" role="cell">Week<br />{index + 1}</div>
                  <div className="monthly-plan-equipment" role="cell">
                    <input value={row.activity_name} onChange={(event) => setRow("en", index, "activity_name", event.target.value)} placeholder="Equipment" />
                    {imageCell("en", row, index)}
                  </div>
                  <div role="cell"><textarea value={row.activity_description} onChange={(event) => setRow("en", index, "activity_description", event.target.value)} placeholder="Describe the activity and developmental goal." /></div>
                  <div role="cell"><textarea value={row.key_expression} onChange={(event) => setRow("en", index, "key_expression", event.target.value)} placeholder="Key expression" /></div>
                </div>
              ))}
            </div>
            <p className="monthly-plan-english-note">📌 This monthly plan is subject to change depending on circumstances.</p>
          </section>
        )}
      </div>

      <footer className="monthly-plan-editor__footer">
        <span>{lastSavedAt ? `최근 저장 ${new Date(lastSavedAt).toLocaleString("ko-KR")}` : "아직 저장되지 않았습니다."}</span>
        <button type="button" className="monthly-plan-editor__save-button" onClick={save} disabled={saving || setupRequired}>
          <Save size={15} /> {saving ? "저장 중..." : "계획안 임시 저장"}
        </button>
      </footer>
    </section>
  );
}
