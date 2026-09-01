import { useEffect, useMemo, useState } from "react";
import { Download, FileImage, FileText, Languages, PartyPopper, RefreshCw, Save, Upload } from "lucide-react";

const AGE_GROUPS = [
  { id: "3_4", label: "3~4세" },
  { id: "5", label: "5~6세" },
  { id: "7", label: "7세" },
];
const ENGLISH_AGE_GROUPS = [
  { id: "en_5", age: "5", label: "English · AGE 5" },
  { id: "en_6", age: "6", label: "English · AGE 6" },
  { id: "en_7", age: "7", label: "English · AGE 7" },
];
const ALL_GROUPS = [...AGE_GROUPS, ...ENGLISH_AGE_GROUPS];
const EMPTY_ENGLISH_GOALS = Object.fromEntries(ENGLISH_AGE_GROUPS.map(({ age }) => [age, ""]));
const EVENT_PRESETS = [
  { id: "holiday", name: "명절", englishName: "Korean Holiday Games", ko: "우리나라 명절에 담긴 의미와 정겨운 문화를 아이들의 눈높이에서 함께 알아봅니다. 전통놀이와 명절 이야기를 활용한 즐거운 활동을 통해 자연스럽게 우리 문화와 가까워집니다.", en: "Children discover the meaning and warm traditions of Korean holidays through age-appropriate stories. They enjoy traditional games and playful activities that help them feel closer to Korean culture." },
  { id: "christmas", name: "크리스마스", englishName: "Christmas Activity Day", ko: "크리스마스가 전하는 나눔과 따뜻한 마음을 이야기하며 특별한 계절의 분위기를 함께 느껴봅니다. 선물 배달과 겨울 이야기를 주제로 한 활동에 참여하며 친구들과 즐거움을 나눕니다.", en: "Children share stories about kindness, giving, and the special atmosphere of Christmas. Gift-delivery missions and winter-themed play create a joyful experience with friends." },
  { id: "winter", name: "겨울놀이", englishName: "Winter Play Day", ko: "눈과 얼음, 이글루 등 겨울에 만날 수 있는 풍경을 이야기하며 계절의 특징을 재미있게 알아봅니다. 겨울을 주제로 한 다양한 놀이와 미션을 경험하며 따뜻하고 즐거운 수업을 만들어갑니다.", en: "Children explore winter scenery such as snow, ice, and igloos through stories and imaginative play. A variety of winter-themed games and missions create a warm and joyful lesson." },
  { id: "halloween", name: "할로윈", englishName: "Halloween Activity Day", ko: "할로윈의 재미있는 이야기와 상징을 친근하게 알아보고, 신나는 음악과 다양한 미션을 함께 경험합니다. 아이들이 무서움을 느끼지 않도록 밝고 유쾌한 분위기에서 즐거운 추억을 만듭니다.", en: "Children discover friendly Halloween stories and symbols through music and playful missions. The lesson stays bright and cheerful so every child can enjoy a happy Halloween memory." },
  { id: "yellow", name: "옐로우데이", englishName: "Yellow Day", ko: "노란 풍선과 징검다리, 매트 등 다양한 옐로우 교구를 활용하여 밝고 신나는 활동을 함께 즐겨봅니다. 주변이 온통 노란색으로 물든 특별한 공간에서 친구들과 재미있는 미션에 참여하며 유쾌한 추억을 만듭니다.", en: "Children enter a bright yellow world filled with balloons, stepping stones, mats, and playful equipment. They enjoy cheerful missions with friends and create lively memories in a space full of sunshine-like color." },
  { id: "hero", name: "히어로데이", englishName: "Hero Day", ko: "멋진 히어로가 되어 친구들과 흥미진진한 대결과 협동 미션을 시작합니다. 줄다리기와 선생님 구하기, 파워댄스에 참여하며 서로 힘을 모아 진정한 히어로가 되는 즐거움을 경험합니다.", en: "Children become brave heroes and begin exciting team challenges with their friends. Through tug-of-war, rescue missions, and a lively power dance, they discover the joy of helping one another and working as a team." },
];

function planDisplayName(value) {
  return String(value || "").trim().replace(/\s*프로그램\s*$/u, "").replace(/\s*program\s*$/iu, "").trim();
}

function eventDescriptionForAge(description, ageGroup) {
  void ageGroup;
  return description || "";
}

function eventFamilyKey(value) {
  const name = planDisplayName(value).replace(/\s+/g, "").toLowerCase();
  if (/명절|전통|holiday/.test(name)) return "holiday";
  if (/크리스마스|성탄|christmas/.test(name)) return "christmas";
  if (/겨울|눈놀이|winter/.test(name)) return "winter";
  if (/할로윈|halloween/.test(name)) return "halloween";
  if (/옐로우|yellow/.test(name)) return "yellow";
  if (/히어로|hero/.test(name)) return "hero";
  return name;
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

function parseEnglishGoals(value) {
  const text = String(value || "").trim();
  if (!text) return { ...EMPTY_ENGLISH_GOALS };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return Object.fromEntries(ENGLISH_AGE_GROUPS.map(({ age }) => [age, String(parsed[age] || "")]));
    }
  } catch {
    // 이전 공통 영어 목표는 세 연령에 그대로 이어서 사용합니다.
  }
  return Object.fromEntries(ENGLISH_AGE_GROUPS.map(({ age }) => [age, text]));
}

function englishAgeLevel(groupId) {
  return String(groupId || "").replace("en_", "") || "5";
}

function buildEnglishPurpose(suggestion, age = "5", index = 0) {
  const source = `${suggestion?.englishName || ""} ${suggestion?.name || ""} ${suggestion?.englishActivity || ""}`.toLowerCase();
  let focus = "whole-body coordination, balance, and confident body control";
  if (/ball|catch|throw|basket|fishing|ring toss|target|pipe/.test(source)) focus = "hand-eye coordination, object control, and movement accuracy";
  else if (/stack|block|donut|cup|domino|build/.test(source)) focus = "spatial planning, balance, and controlled hand-body coordination";
  else if (/tunnel|climb|air mat|obstacle|ladder/.test(source)) focus = "core stability, whole-body coordination, and spatial awareness";
  else if (/jump|hurdle|rope|stepping|stone/.test(source)) focus = "dynamic balance, lower-body strength, and controlled landing";
  else if (/board|flip|balance/.test(source)) focus = "postural control, balance reactions, and movement confidence";

  const verbs = age === "7" ? ["Refines", "Advances", "Integrates"] : age === "6" ? ["Strengthens", "Expands", "Connects"] : ["Builds", "Develops", "Supports"];
  const progression = age === "7"
    ? "through complex sequences, precise control, and independent decisions"
    : age === "6"
      ? "through linked actions, direction changes, and responsive challenges"
      : "through guided exploration, repetition, and successful first attempts";
  return `${verbs[index % verbs.length]} ${focus} ${progression}.`;
}

function buildEnglishActivity(suggestion, age = "5", index = 0) {
  let base = String(suggestion?.englishActivity || "").trim();
  if (!base) return "";
  const leads = age === "7"
    ? ["Children work with greater independence as they", "Children use longer movement sequences to", "Children take part in advanced challenges as they"]
    : age === "6"
      ? ["Children work through linked challenges as they", "Children work with partners and small groups to", "Children respond to direction and speed changes as they"]
      : ["Children explore through playful activities as they", "Children follow clear demonstrations as they", "Children build confidence through safe, repeated practice as they"];
  base = base.replace(/^Children\s+/i, `${leads[index % leads.length]} `);
  const extension = age === "7"
    ? "Movements are combined into a longer sequence with precise control and independent choices."
    : age === "6"
      ? "Two or more actions are connected while direction, speed, or partner cues change."
      : "Simple steps and encouraging repetition help every learner experience success.";
  return `${base} ${extension}`;
}

function normalizeEnglishActivitySubject(value) {
  return String(value || "")
    .replace(/^With greater independence,\s*participants\s+/i, "Children work with greater independence as they ")
    .replace(/^Using longer movement sequences,\s*learners\s+/i, "Children use longer movement sequences to ")
    .replace(/^During advanced challenges,\s*the class\s+/i, "Children take part in advanced challenges as they ")
    .replace(/^Working through linked challenges,\s*learners\s+/i, "Children work through linked challenges as they ")
    .replace(/^In partner and small-group tasks,\s*the class\s+/i, "Children work with partners and small groups to ")
    .replace(/^Responding to direction and speed changes,\s*participants\s+/i, "Children respond to direction and speed changes as they ")
    .replace(/^Through playful exploration,\s*learners\s+/i, "Children explore through playful activities as they ")
    .replace(/^Guided by clear demonstrations,\s*the class\s+/i, "Children follow clear demonstrations as they ")
    .replace(/^During safe, repeated practice,\s*participants\s+/i, "Children build confidence through safe, repeated practice as they ")
    .replace(/^Participants\s+/i, "Children ")
    .replace(/\bParticipants\b/g, "Children")
    .replace(/\bparticipants\b/g, "children");
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

function printableEnglishTemplateHtml({ month, rowsByGroup, englishGoals, selectedEnglishAges, templateUrl }) {
  const title = monthTitle(month);
  const pages = ENGLISH_AGE_GROUPS.filter(({ age }) => selectedEnglishAges.includes(age));
  const pageMarkup = pages.map((selectedEnglishAge) => {
    const rows = rowsByGroup[selectedEnglishAge.id] || [];
    const rowMarkup = rows.slice(0, 5).map((row, index) => `
    <div class="plan-row plan-row--${index + 1}">
      <div class="equipment-content">
        <strong>${escapeHtml(row.activity_name || "")}</strong>
        ${row.image_url ? `<img src="${escapeHtml(row.image_url)}" alt="${escapeHtml(row.activity_name || `Week ${index + 1}`)}" />` : ""}
      </div>
      <div class="activity-content">${escapeHtml(row.activity_description || "")}</div>
      <div class="purpose-content">${escapeHtml(row.key_expression || "")}</div>
    </div>`).join("");
    return `<main class="template-page">
      <div class="plan-title">${escapeHtml(title)}</div>
      <div class="age-label">AGE ${escapeHtml(selectedEnglishAge.age)}</div>
      <div class="goal-text">${escapeHtml(englishGoals[selectedEnglishAge.age] || "")}</div>
      ${rowMarkup}
      <div class="footer-clean"><span>This monthly plan is subject to change depending on circumstances.</span></div>
    </main>`;
  }).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: 210mm; margin: 0; }
      body { background: #fff; color: #102341; font-family: Arial, "Noto Sans", sans-serif; }
      .template-page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; break-after: page; background: #fff url("${escapeHtml(templateUrl)}") center / 210mm 297mm no-repeat; }
      .template-page:last-of-type { page-break-after: auto; break-after: auto; }
      .plan-title { position: absolute; top: 31.2mm; left: 20mm; width: 170mm; text-align: center; color: #072d18; font-size: 7.4mm; line-height: 1; font-weight: 900; letter-spacing: -.25mm; text-transform: uppercase; }
      .age-label { position: absolute; top: 46.25mm; left: 92mm; width: 26mm; height: 8.5mm; display: grid; place-items: center; text-align: center; color: #fff; font-size: 3.3mm; line-height: 1; font-weight: 900; letter-spacing: .22mm; }
      .goal-text { position: absolute; top: 61.7mm; left: 45mm; width: 148mm; height: 20mm; display: flex; align-items: center; color: #102341; font-size: 2.65mm; line-height: 1.45; font-weight: 500; }
      .plan-row { position: absolute; left: 0; width: 210mm; height: 36mm; }
      .plan-row--1 { top: 95.3mm; } .plan-row--2 { top: 131.3mm; } .plan-row--3 { top: 167.3mm; } .plan-row--4 { top: 203.3mm; } .plan-row--5 { top: 239.3mm; }
      .equipment-content { position: absolute; left: 31mm; top: 2.8mm; width: 45mm; height: 30.5mm; text-align: center; overflow: hidden; }
      .equipment-content strong { display: block; min-height: 5mm; color: #102341; font-size: 2.65mm; line-height: 1.25; font-weight: 850; }
      .equipment-content img { display: block; width: 31mm; height: 22mm; margin: 1.2mm auto 0; object-fit: contain; border-radius: 2mm; }
      .activity-content { position: absolute; left: 80mm; top: 6.2mm; width: 61mm; max-height: 25mm; overflow: hidden; white-space: pre-wrap; color: #102341; font-size: 2.55mm; line-height: 1.55; font-weight: 500; }
      .purpose-content { position: absolute; left: 148mm; top: 5.5mm; width: 45mm; max-height: 25mm; overflow: hidden; white-space: pre-wrap; color: #102341; font-size: 2.85mm; line-height: 1.45; font-weight: 800; }
      .footer-clean { position: absolute; z-index: 5; left: 10mm; right: 10mm; bottom: 4.2mm; height: 8mm; display: grid; place-items: center; background: #fff; border-top: .35mm solid #9bc9aa; }
      .footer-clean span { color: #6f8971; font-size: 2.25mm; line-height: 1; white-space: nowrap; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>${pageMarkup}
      <script>
        window.addEventListener('load', function () {
          var images = Array.from(document.images);
          Promise.all(images.map(function (image) {
            if (image.complete) return Promise.resolve();
            return new Promise(function (resolve) { image.onload = resolve; image.onerror = resolve; });
          })).then(function () { setTimeout(function () { window.print(); }, 350); });
        });
      </script>
    </body></html>`;
}

function printableKoreanTemplateHtml({ month, rowsByGroup, selectedAge, templateUrl }) {
  const selectedAgeMeta = AGE_GROUPS.find(({ id }) => id === selectedAge) || AGE_GROUPS[0];
  const rows = rowsByGroup[selectedAgeMeta.id] || [];
  const title = monthTitle(month);
  const rowMarkup = rows.slice(0, 5).map((row, index) => `
    <div class="ko-row">
      <div class="ko-week">${index + 1}주</div>
      <div class="ko-equipment"><strong>${escapeHtml(row.activity_name || "")}</strong>${row.image_url ? `<img src="${escapeHtml(row.image_url)}" alt="${escapeHtml(row.activity_name || `${index + 1}주차`)}" />` : ""}</div>
      <div class="ko-description">${escapeHtml(row.activity_description || "")}</div>
    </div>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: 210mm; height: 297mm; margin: 0; }
      body { background: #fff; color: #102341; font-family: "Noto Sans KR", "Apple SD Gothic Neo", Arial, sans-serif; }
      .template-page { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff url("${escapeHtml(templateUrl)}") center / 210mm 297mm no-repeat; }
      .plan-title { position: absolute; top: 31.2mm; left: 20mm; width: 170mm; text-align: center; color: #072d18; font-size: 7.4mm; line-height: 1; font-weight: 900; letter-spacing: -.25mm; }
      .age-label { position: absolute; top: 46.25mm; left: 92mm; width: 26mm; height: 8.5mm; display: grid; place-items: center; color: #fff; font-size: 3.3mm; line-height: 1; font-weight: 900; }
      .goal-label { position: absolute; z-index: 4; top: 62.5mm; left: 13mm; width: 27mm; height: 18mm; display: grid; place-items: center; background: #f5faf6; color: #176d40; font-size: 3.1mm; line-height: 1; font-weight: 900; }
      .goal-text { position: absolute; z-index: 4; top: 61mm; left: 42mm; width: 153mm; height: 21mm; display: flex; align-items: center; padding: 0 3mm; background: #f5faf6; color: #102341; font-size: 2.55mm; line-height: 1.48; font-weight: 550; }
      .ko-table { position: absolute; z-index: 4; top: 86.5mm; left: 10.8mm; width: 188.4mm; height: 188.5mm; overflow: hidden; border: .35mm solid #9fc7aa; border-radius: 2.5mm; background: #fff; }
      .ko-head, .ko-row { display: grid; grid-template-columns: 18mm 51mm 1fr; }
      .ko-head { height: 9.5mm; background: #dcefe2; color: #135a35; font-size: 2.8mm; font-weight: 900; text-align: center; }
      .ko-head > div, .ko-row > div { display: flex; align-items: center; justify-content: center; border-right: .25mm solid #b9d4c0; }
      .ko-head > div:last-child, .ko-row > div:last-child { border-right: 0; }
      .ko-row { height: 35.75mm; border-top: .25mm solid #b9d4c0; }
      .ko-week { background: #fbfdfb; color: #176d40; font-size: 3.15mm; font-weight: 900; }
      .ko-equipment { flex-direction: column; padding: 2mm; text-align: center; overflow: hidden; }
      .ko-equipment strong { min-height: 4.5mm; font-size: 2.75mm; font-weight: 900; }
      .ko-equipment img { width: 31mm; height: 24mm; margin-top: 1mm; object-fit: contain; border-radius: 2mm; }
      .ko-description { justify-content: flex-start !important; padding: 3mm 4mm; white-space: pre-wrap; color: #102341; font-size: 2.7mm; line-height: 1.55; font-weight: 550; }
      .footer-clean { position: absolute; z-index: 5; left: 10mm; right: 10mm; bottom: 4.2mm; height: 8mm; display: grid; place-items: center; background: #fff; border-top: .35mm solid #9bc9aa; }
      .footer-clean span { color: #6f8971; font-size: 2.25mm; line-height: 1; white-space: nowrap; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body><main class="template-page">
      <div class="plan-title">${escapeHtml(title)}</div>
      <div class="age-label">${escapeHtml(selectedAgeMeta.label)}</div>
      <div class="goal-label">월간 목표</div>
      <div class="goal-text">${escapeHtml(buildMonthlyKoreanGoal(rows, selectedAgeMeta.label, month))}</div>
      <div class="ko-table"><div class="ko-head"><div>주차</div><div>교구 및 활동</div><div>활동 내용 및 발달 도움</div></div>${rowMarkup}</div>
      <div class="footer-clean"><span>This monthly plan is subject to change depending on circumstances.</span></div>
    </main><script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 450); });</script></body></html>`;
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

function buildMonthlyEnglishGoal(suggestions, month, age = "5") {
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
  const ageDirection = age === "7"
    ? `Learners combine ${activityText} into complex sequences, refining ${focusText}, decision-making, and teamwork.`
    : age === "6"
      ? `Linked ${activityText} strengthen ${focusText} as learners respond to changing directions, speeds, and partners.`
      : `Guided ${activityText} build foundations in ${focusText} through playful repetition and encouraging success.`;
  return `${monthlyTheme} ${ageDirection}`;
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

function printableReportHtml({ language, month, rowsByGroup, englishGoals, selectedAge, selectedEnglishAges, logoUrl, templateUrl }) {
  const isEnglish = language === "en";
  const englishAge = selectedEnglishAges[0] || "5";
  if (isEnglish) {
    return printableEnglishTemplateHtml({ month, rowsByGroup, englishGoals, selectedEnglishAges, templateUrl });
  }
  return printableKoreanTemplateHtml({ month, rowsByGroup, selectedAge, templateUrl });
  const selectedAgeMeta = AGE_GROUPS.find(({ id }) => id === selectedAge) || AGE_GROUPS[0];
  const selectedEnglishAge = ENGLISH_AGE_GROUPS.find(({ age }) => age === englishAge) || ENGLISH_AGE_GROUPS[0];
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
      <div class="age-badge">AGE ${escapeHtml(selectedEnglishAge.age)}</div>
      ${englishGoals[selectedEnglishAge.age] ? `<div class="goal"><strong>MONTHLY<br />GOAL</strong><span>${escapeHtml(englishGoals[selectedEnglishAge.age])}</span></div>` : ""}
      <table>
        <colgroup><col class="week-en" /><col class="equipment-en" /><col /><col class="expression-en" /></colgroup>
        <thead><tr><th>WEEK</th><th>EQUIPMENT</th><th>ACTIVITY</th><th>PURPOSE</th></tr></thead>
        <tbody>${rowsByGroup[selectedEnglishAge.id].map((row, index) => `
          <tr>
            <td class="week"><span>${index + 1}</span></td>
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
      .report-page { display: flex; flex-direction: column; width: 210mm; height: 297mm; padding: 9mm 11mm 7mm; overflow: hidden; background: #fff; }
      .report-header { display: flex; align-items: center; justify-content: space-between; padding: 0 1mm 7px; border-bottom: 1.5px solid #9ab898; }
      .brand { display: flex; align-items: center; gap: 9px; }
      .brand-logo-wrap { position: relative; width: 50px; height: 50px; overflow: hidden; }
      .brand-logo { position: absolute; left: 50%; top: 50%; width: 128px; height: 64px; max-width: none; object-fit: contain; transform: translate(-50%, -50%); }
      .brand-name { font-size: 18px; font-weight: 900; letter-spacing: -.02em; }
      .brand-tagline { margin-top: 1px; color: #66806b; font-size: 7.5px; font-weight: 750; letter-spacing: .12em; }
      .report-type { color: #6f8971; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .report-title { margin: 0 0 7px; padding: 12px 0 2px; }
      h1 { margin: 0; color: #13264a; font-size: 24px; font-weight: 900; text-align: center; letter-spacing: -.025em; }
      .report-closing { margin-top: 6px; padding-top: 6px; border-top: 1px solid #a7c3a5; }
      .report-notice { margin: 0; color: #6f8971; font-size: 7.5px; text-align: center; white-space: nowrap; }
      h2 { margin: 0 0 7px; padding-left: 2px; color: #176d40; font-size: 13px; font-weight: 900; }
      .age-section, .english-section { display: flex; flex-direction: column; margin-bottom: 4px; break-inside: avoid; page-break-inside: avoid; }
      .age-badge { width: max-content; margin: 0 auto 7px; padding: 3px 14px; border-radius: 999px; background: #a8c5a5; color: #fff; font-size: 10px; font-weight: 900; letter-spacing: .04em; }
      table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; overflow: hidden; border: 1px solid #a8bea9; border-radius: 6px; }
      th, td { border-right: .7px solid #c5d5c6; border-bottom: .7px solid #c5d5c6; }
      th:last-child, td:last-child { border-right: 0; }
      tbody tr:last-child td { border-bottom: 0; }
      th { height: 26px; padding: 5px 6px; background: #9dbb9b; color: #fff; font-size: 9px; font-weight: 900; text-align: center; letter-spacing: .025em; }
      td { padding: 5px 8px; color: #13264a; font-size: 8.8px; line-height: 1.45; vertical-align: middle; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      tbody tr { height: 31.2mm; }
      tbody tr:nth-child(even) td { background: #fbfdfb; }
      .week-col { width: 10%; } .equipment-col { width: 30%; }
      .week-en { width: 10%; } .equipment-en { width: 26%; } .expression-en { width: 27%; }
      td.week { text-align: center; font-weight: 850; }
      td.week span { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #edf5ec; color: #628665; font-size: 12px; font-weight: 900; }
      td.equipment { text-align: center; }
      td.equipment strong { display: block; margin-bottom: 5px; font-size: 9px; }
      td.equipment img { display: block; width: 76px; height: 54px; margin: 0 auto; border-radius: 7px; object-fit: contain; background: #fbfcfb; }
      .photo-placeholder { display: grid; place-items: center; width: 68px; height: 47px; margin: 0 auto; border-radius: 5px; background: #f1f5f2; color: #a3afa8; font-size: 8px; font-weight: 800; }
      td.description { white-space: pre-wrap; }
      td.expression { font-weight: 800; }
      .goal { display: grid; grid-template-columns: 50px 1fr; align-items: center; gap: 9px; margin: 0 0 7px; padding: 7px 10px; border: 1px solid #c7d9c7; border-radius: 7px; background: #f5f9f4; font-size: 8.8px; line-height: 1.4; }
      .goal strong { color: #668b68; font-size: 8px; line-height: 1.25; text-align: center; letter-spacing: .05em; }
      .report-page--ko h1 { font-size: 24px; }
      .report-page--ko h2 { font-size: 14px; }
      .report-page--ko th { font-size: 9.7px; font-weight: 900; letter-spacing: -.01em; }
      .report-page--ko td { font-size: 10.2px; line-height: 1.52; }
      .report-page--ko td.equipment strong { font-size: 10px; }
      .report-page--ko .goal { font-size: 9.8px; line-height: 1.5; }
      .report-page--ko .report-notice { font-size: 8px; }
      .report-page--ko tbody tr { height: 35mm; }
      .report-page--ko td.equipment img { width: 84px; height: 62px; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body><main class="report-page report-page--${isEnglish ? "en" : "ko"}">
      <header class="report-header"><div class="brand"><div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="GTS logo" /></div><div><div class="brand-name">GTS</div><div class="brand-tagline">GROW THROUGH SPORTS</div></div></div><div class="report-type">Monthly Physical Education Report</div></header>
      <div class="report-title"><h1>${escapeHtml(title)}</h1></div>
      ${isEnglish ? englishSection : koreanSections}
      </main>
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
  companyEquipment = [],
}) {
  const [planId, setPlanId] = useState(null);
  const [rowsByGroup, setRowsByGroup] = useState(makeRows);
  const [language, setLanguage] = useState("ko");
  const [englishGoals, setEnglishGoals] = useState(EMPTY_ENGLISH_GOALS);
  const [pdfAge, setPdfAge] = useState("3_4");
  const [selectedEnglishAges, setSelectedEnglishAges] = useState(() => ENGLISH_AGE_GROUPS.map(({ age }) => age));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [message, setMessage] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [gearPickerOpen, setGearPickerOpen] = useState(false);
  const [selectedGearByWeek, setSelectedGearByWeek] = useState({});
  const [companyGearSearchByWeek, setCompanyGearSearchByWeek] = useState({});
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [eventWeek, setEventWeek] = useState("1");
  const [eventChoice, setEventChoice] = useState("holiday");
  const [eventTargets, setEventTargets] = useState(() => ALL_GROUPS.map(({ id }) => id));
  const [customEventName, setCustomEventName] = useState("");
  const [customEventDescription, setCustomEventDescription] = useState("");
  const activeGroups = language === "ko" ? AGE_GROUPS : ENGLISH_AGE_GROUPS;

  useEffect(() => {
    setEventTargets(activeGroups.map(({ id }) => id));
    setGearPickerOpen(false);
    setEventPickerOpen(false);
    setMessage("");
  }, [language]);

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

  const normalizedCompanyEquipment = useMemo(() => companyEquipment.map((item) => ({
    id: `company:${item.id}`,
    name: String(item.name || item.item_name || "").trim(),
    englishName: String(item.english_name || item.name_en || item.alias || item.name || item.item_name || "").trim(),
    photoUrl: String(item.photo_url || item.image_url || "").trim(),
    activityDescription: String(item.usage_description || item.activity_description || item.description || "").trim(),
    englishActivity: String(item.english_activity || item.activity_description_en || item.english_description || "").trim(),
    activityDescriptions: {},
  })).filter((item) => item.id !== "company:undefined" && item.name), [companyEquipment]);
  const gearPickerSuggestions = useMemo(() => normalizedSuggestions.length
    ? normalizedSuggestions
    : Array.from({ length: 5 }, (_, index) => ({ weekNumber: index + 1, name: "", options: [] })), [normalizedSuggestions]);

  const visibleEventPresets = useMemo(() => {
    const registeredFamilies = new Set(normalizedPrograms.map((program) => eventFamilyKey(program.name)));
    return EVENT_PRESETS.filter((preset) => !registeredFamilies.has(eventFamilyKey(preset.name)));
  }, [normalizedPrograms]);

  const gearPickerEventOptions = useMemo(() => [
    ...visibleEventPresets.map((preset) => ({
      value: `event:preset:${preset.id}`,
      label: preset.name,
      preset,
      program: null,
    })),
    ...normalizedPrograms.map((program) => ({
      value: `event:program:${program.id}`,
      label: program.name,
      preset: EVENT_PRESETS.find((preset) => eventFamilyKey(preset.name) === eventFamilyKey(program.name)) || null,
      program,
    })),
  ], [normalizedPrograms, visibleEventPresets]);

  useEffect(() => {
    if (eventChoice === "custom" || eventChoice.startsWith("program:")) return;
    if (visibleEventPresets.some((preset) => preset.id === eventChoice)) return;
    const hiddenPreset = EVENT_PRESETS.find((preset) => preset.id === eventChoice);
    const replacement = hiddenPreset
      ? normalizedPrograms.find((program) => eventFamilyKey(program.name) === eventFamilyKey(hiddenPreset.name))
      : null;
    if (replacement) setEventChoice(`program:${replacement.id}`);
    else if (visibleEventPresets[0]) setEventChoice(visibleEventPresets[0].id);
    else if (normalizedPrograms[0]) setEventChoice(`program:${normalizedPrograms[0].id}`);
  }, [eventChoice, normalizedPrograms, visibleEventPresets]);

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
          setEnglishGoals({ ...EMPTY_ENGLISH_GOALS });
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
          activity_description: entry.age_group?.startsWith("en")
            ? normalizeEnglishActivitySubject(entry.activity_description)
            : (entry.activity_description || ""),
          key_expression: entry.key_expression || "",
          image_path: entry.image_path || "",
          image_url: imageUrl,
        };
      }
      const legacyEnglishRows = (entries || []).filter((entry) => entry.age_group === "en");
      if (legacyEnglishRows.length) {
        for (const { id } of ENGLISH_AGE_GROUPS) {
          const hasDedicatedRows = (entries || []).some((entry) => entry.age_group === id);
          if (hasDedicatedRows) continue;
          for (const entry of legacyEnglishRows) {
            const index = Number(entry.position) - 1;
            if (index < 0 || index >= next[id].length) continue;
            let imageUrl = "";
            if (entry.image_path) {
              if (/^https?:\/\//i.test(entry.image_path)) imageUrl = entry.image_path;
              else {
                const { data } = await supabase.storage.from("monthly-plan-images").createSignedUrl(entry.image_path, 3600);
                imageUrl = data?.signedUrl || "";
              }
            }
            next[id][index] = {
              position: index + 1,
              activity_name: entry.activity_name || "",
              activity_description: normalizeEnglishActivitySubject(entry.activity_description),
              key_expression: entry.key_expression || "",
              image_path: entry.image_path || "",
              image_url: imageUrl,
            };
          }
        }
      }
      if (!cancelled) {
        const parsedGoals = parseEnglishGoals(plan.english_goal);
        const populatedGoals = Object.values(parsedGoals).map((value) => value.trim()).filter(Boolean);
        const goalsAreDuplicated = populatedGoals.length > 1 && new Set(populatedGoals).size === 1;
        const nextEnglishGoals = goalsAreDuplicated
          ? Object.fromEntries(ENGLISH_AGE_GROUPS.map(({ age, id }) => [
            age,
            buildMonthlyEnglishGoal(next[id].map((row) => ({
              englishName: row.activity_name,
              englishActivity: row.activity_description,
            })), month, age),
          ]))
          : parsedGoals;
        setPlanId(plan.id);
        setRowsByGroup(next);
        setEnglishGoals(nextEnglishGoals);
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
      : suggestionsByGroup.en_5 || suggestionsByGroup.en || [];
    setRowsByGroup((previous) => ({
      ...previous,
      ...Object.fromEntries(activeGroups.map(({ id }) => [
        id,
        previous[id].map((row, index) => {
        const groupSuggestions = Array.isArray(suggestionsByGroup)
          ? suggestionsByGroup
          : suggestionsByGroup[id] || [];
        const byWeek = new Map(groupSuggestions.map((suggestion) => [suggestion.weekNumber, suggestion]));
        const suggestion = byWeek.get(index + 1) || groupSuggestions[index];
        if (!suggestion) return row;
        const isEnglish = id.startsWith("en_");
        const age = englishAgeLevel(id);
        return {
          ...row,
          activity_name: isEnglish
            ? (suggestion.englishName || "Selected Equipment")
            : (suggestion.name || row.activity_name),
          activity_description: (
            isEnglish
              ? (suggestion.isEvent ? suggestion.englishActivity : buildEnglishActivity(suggestion, age, index))
              : (suggestion.activityDescriptions?.[id] || suggestion.activityDescription)
          ) || row.activity_description,
          key_expression: (isEnglish
            ? (suggestion.isEvent ? suggestion.englishPurpose : buildEnglishPurpose(suggestion, age, index))
            : "") || row.key_expression,
          image_path: suggestion.photoUrl || row.image_path,
          image_url: suggestion.photoUrl || row.image_url,
        };
        }),
      ])),
    }));
    if (language === "en") {
      setEnglishGoals(Object.fromEntries(ENGLISH_AGE_GROUPS.map(({ age, id }) => [
        age,
        buildMonthlyEnglishGoal(Array.isArray(suggestionsByGroup) ? englishSuggestions : (suggestionsByGroup[id] || englishSuggestions), month, age),
      ])));
    }
    setGearPickerOpen(false);
    setMessage("선택한 교구의 이름·사진·활동 내용을 불러왔습니다.");
  };

  const fillFromGear = () => {
    if (!normalizedSuggestions.length && !normalizedCompanyEquipment.length && !visibleEventPresets.length && !normalizedPrograms.length) {
      setMessage("선택한 달에 등록된 내 교구가 없습니다.");
      return;
    }
    const hasMultiple = gearPickerSuggestions.some((suggestion) => suggestion.options.length > 1)
      || normalizedCompanyEquipment.length > 0 || visibleEventPresets.length > 0 || normalizedPrograms.length > 0;
    if (!hasMultiple) {
      applyGearSuggestions(gearPickerSuggestions.map((suggestion) => suggestion.options[0] || suggestion));
      return;
    }
    setSelectedGearByWeek(Object.fromEntries(activeGroups.flatMap(({ id }) => (
      gearPickerSuggestions.map((suggestion) => [
        `${id}-${suggestion.weekNumber}`,
        suggestion.options[0]?.id || "",
      ])
    ))));
    setGearPickerOpen(true);
    setMessage(`${language === "ko" ? "한국어" : "영어"} 연령별 계획안에 사용할 교구를 하나씩 선택해 주세요.`);
  };

  const confirmGearSelection = () => {
    const selected = Object.fromEntries(activeGroups.map(({ id }) => [
      id,
      gearPickerSuggestions.map((suggestion) => {
        const options = suggestion.options.length ? suggestion.options : [suggestion];
        const selectedId = selectedGearByWeek[`${id}-${suggestion.weekNumber}`];
        const selectedEvent = gearPickerEventOptions.find((eventOption) => eventOption.value === selectedId);
        if (selectedEvent) {
          const { preset, program } = selectedEvent;
          const koreanName = planDisplayName(program?.name || preset?.name || selectedEvent.label);
          const englishName = planDisplayName(program?.englishName || preset?.englishName || koreanName);
          const englishSafeName = /[가-힣]/.test(englishName) ? "Special Activity Day" : englishName;
          return {
            id: selectedEvent.value,
            weekNumber: suggestion.weekNumber,
            isEvent: true,
            name: koreanName,
            englishName: englishSafeName,
            photoUrl: program?.photoUrl || "",
            activityDescription: preset?.ko || program?.description || `${koreanName}의 특별한 이야기와 분위기를 아이들의 눈높이에서 알아보고 주제에 어울리는 놀이와 미션을 함께 즐깁니다.`,
            activityDescriptions: {},
            englishActivity: preset?.en || `The class explores the story and atmosphere of ${englishSafeName} through cheerful themed games, music, and shared missions.`,
            englishPurpose: "Encourages cultural curiosity, creative participation, confidence, and positive teamwork.",
          };
        }
        const companyOption = normalizedCompanyEquipment.find((candidate) => candidate.id === selectedId);
        const option = companyOption || options.find((candidate) => candidate.id === selectedId) || options[0];
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
    const matchedPreset = preset || (program
      ? EVENT_PRESETS.find((item) => eventFamilyKey(item.name) === eventFamilyKey(program.name))
      : null);
    const koreanName = planDisplayName(program?.name || preset?.name || customEventName);
    if (!koreanName) {
      setMessage("이벤트데이 이름을 입력해 주세요.");
      return;
    }
    if (!eventTargets.length) {
      setMessage("이벤트데이를 적용할 계획안을 하나 이상 선택해 주세요.");
      return;
    }

    const baseDescription = matchedPreset?.ko || program?.description || customEventDescription
      || `${koreanName}에 담긴 이야기와 특별한 분위기를 아이들의 눈높이에서 함께 알아봅니다. 주제와 어울리는 다양한 놀이와 미션에 참여하며 친구들과 즐거운 추억을 만듭니다.`;
    const rawEnglishName = planDisplayName(program?.englishName || matchedPreset?.englishName || customEventName);
    const englishName = /[가-힣]/.test(rawEnglishName) ? "Special Activity Day" : rawEnglishName;
    const englishDescription = matchedPreset?.en || (program
      ? `Children discover the story and special atmosphere of the ${englishName} through playful, age-appropriate experiences. They take part in themed games and missions while creating joyful memories with friends.`
      : customEventDescription);

    setRowsByGroup((previous) => ({
      ...previous,
      ...Object.fromEntries(activeGroups.map(({ id }) => [
        id,
        previous[id].map((row, index) => {
        if (index !== weekIndex || !eventTargets.includes(id)) return row;
        const isEnglish = id.startsWith("en_");
        return {
          ...row,
          activity_name: isEnglish ? englishName : koreanName,
          activity_description: isEnglish ? englishDescription : eventDescriptionForAge(baseDescription, id),
          key_expression: isEnglish ? "Encourages cultural curiosity, creative movement, confidence, and positive teamwork." : "",
          image_path: program?.photoUrl || "",
          image_url: program?.photoUrl || "",
        };
        }),
      ])),
    }));
    if (eventTargets.some((id) => id.startsWith("en_"))) {
      setEnglishGoals((previous) => Object.fromEntries(ENGLISH_AGE_GROUPS.map(({ age, id }) => [
        age,
        eventTargets.includes(id)
          ? `${ENGLISH_MONTHLY_THEMES[monthNumber(month)]} The ${englishName} adds a special opportunity for creativity, confidence, and teamwork.`
          : previous[age],
      ])));
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
          english_goal: JSON.stringify(englishGoals),
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
      setMessage(`${language === "ko" ? "한국어" : "영어"} 계획안이 임시 저장되었습니다. 다른 언어의 기존 내용도 그대로 유지됩니다.`);
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
      englishGoals,
      selectedAge: pdfAge,
      selectedEnglishAges,
      logoUrl: new URL("/brand/gts-company-logo.png", window.location.origin).href,
      templateUrl: new URL("/assets/monthly-plan/gts-monthly-plan-blank-template.png", window.location.origin).href,
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
          <p>한국어 또는 영어를 선택해 필요한 연령별 계획안만 작성하고 A4 PDF로 저장할 수 있습니다.</p>
        </div>
        <div className="monthly-plan-editor__controls">
          <label><span>작성 월</span><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
          <button type="button" className="monthly-plan-editor__gear-button" onClick={fillFromGear} disabled={setupRequired}>
            <RefreshCw size={15} /> 교구 선택·변경
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
          ) : (
            <fieldset className="monthly-plan-editor__pdf-age monthly-plan-editor__pdf-ages" aria-label="영어 PDF 연령 선택">
              <span>PDF 연령</span>
              <div>
                {ENGLISH_AGE_GROUPS.map(({ age }) => (
                  <label key={age}>
                    <input
                      type="checkbox"
                      checked={selectedEnglishAges.includes(age)}
                      onChange={() => setSelectedEnglishAges((previous) => (
                        previous.includes(age) ? previous.filter((value) => value !== age) : [...previous, age].sort()
                      ))}
                    /> AGE {age}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <button type="button" className="monthly-plan-editor__pdf-button" onClick={saveAsPdf} disabled={setupRequired || (language === "en" && !selectedEnglishAges.length)}>
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
              {visibleEventPresets.length ? <optgroup label="기본 이벤트">{visibleEventPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</optgroup> : null}
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
            {activeGroups.map(({ id, label }) => <label key={id}><input type="checkbox" checked={eventTargets.includes(id)} onChange={() => toggleEventTarget(id)} /> {label}</label>)}
          </fieldset>
          {eventChoice.startsWith("program:") ? (
            <p className="monthly-plan-event-picker__gear-list">필요 교구: {normalizedPrograms.find((program) => `program:${program.id}` === eventChoice)?.requiredGear.join(", ") || "등록된 교구 없음"}</p>
          ) : null}
          <button type="button" className="monthly-plan-editor__save-button monthly-plan-event-picker__apply" onClick={applyEventDay}>선택한 주차에 적용</button>
        </section>
      ) : null}

      <div className="monthly-plan-language-tabs" role="tablist" aria-label="계획안 언어 선택">
        <button type="button" className={language === "ko" ? "is-active" : ""} onClick={() => setLanguage("ko")}>
          <FileText size={16} /> 한국어 계획안 만들기 <small>3~4세 · 5~6세 · 7세</small>
        </button>
        <button type="button" className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>
          <Languages size={16} /> 영어 계획안 만들기 <small>AGE 5 · 6 · 7</small>
        </button>
      </div>
      <p className="monthly-plan-editor__edit-hint">
        현재 <strong>{language === "ko" ? "한국어 계획안" : "영어 계획안"}</strong>을 작성하고 있습니다.
        {language === "ko" ? " 3~4세, 5~6세, 7세 계획안이 아래에 이어집니다." : " AGE 5, AGE 6, AGE 7 계획안이 아래에 이어집니다."}
        {" "}교구명, 활동 내용과 운동발달 목적은 표 안에서 자유롭게 수정할 수 있습니다.
      </p>

      {setupRequired ? (
        <div className="monthly-plan-editor__setup">
          Supabase SQL Editor에서 <strong>supabase/superadmin_monthly_plan_multilingual_patch.sql</strong>을 실행해 주세요.
        </div>
      ) : null}
      {message ? <div className="monthly-plan-editor__message" role="status">{message}</div> : null}

      {gearPickerOpen ? (
        <section className="monthly-plan-gear-picker" aria-label="계획안 교구 선택">
          <div className="monthly-plan-gear-picker__heading">
            <div>
              <strong>{language === "ko" ? "한국어" : "영어"} 연령별 계획안 교구 선택</strong>
              <span>같은 주차라도 연령별로 서로 다른 교구를 고를 수 있습니다.</span>
            </div>
            <div className="monthly-plan-gear-picker__heading-actions"><button type="button" onClick={() => setGearPickerOpen(false)}>취소</button></div>
          </div>
          <div className="monthly-plan-gear-picker__groups">
            {activeGroups.map(({ id, label }) => (
              <section key={id} className={`monthly-plan-gear-picker__group${id.startsWith("en_") ? " is-english" : ""}`}>
                <h4>{label}</h4>
                <div className="monthly-plan-gear-picker__weeks">
                  {gearPickerSuggestions.map((suggestion) => {
                    const options = suggestion.options.length ? suggestion.options : [suggestion];
                    const selectionKey = `${id}-${suggestion.weekNumber}`;
                    return (
                      <fieldset key={selectionKey}>
                        <legend>{suggestion.weekNumber}주차</legend>
                        <div className="monthly-plan-gear-picker__options">
                          {options.filter((option) => option.name).map((option, optionIndex) => (
                            <label key={option.id || option.name} className={selectedGearByWeek[selectionKey] === option.id ? "is-selected" : ""}>
                              <input
                                type="radio"
                                name={`monthly-plan-${selectionKey}`}
                                checked={selectedGearByWeek[selectionKey] === option.id}
                                onChange={() => setSelectedGearByWeek((previous) => ({ ...previous, [selectionKey]: option.id }))}
                              />
                              <small className="monthly-plan-gear-picker__option-label">교구 {optionIndex + 1}</small>
                              {option.photoUrl ? <img src={option.photoUrl} alt="" /> : <FileImage size={24} />}
                              <span>{id.startsWith("en_") ? (option.englishName || option.name) : option.name}</span>
                            </label>
                          ))}
                          {normalizedCompanyEquipment.length ? (
                            <label className={`monthly-plan-gear-picker__other${String(selectedGearByWeek[selectionKey] || "").startsWith("company:") ? " is-selected" : ""}`}>
                              <input
                                type="radio"
                                name={`monthly-plan-${selectionKey}`}
                                checked={String(selectedGearByWeek[selectionKey] || "").startsWith("company:")}
                                onChange={() => setSelectedGearByWeek((previous) => ({
                                  ...previous,
                                  [selectionKey]: normalizedCompanyEquipment[0]?.id || "",
                                }))}
                              />
                              <small className="monthly-plan-gear-picker__option-label">선택 교구</small>
                              <input
                                type="search"
                                className="monthly-plan-gear-picker__company-search"
                                value={companyGearSearchByWeek[selectionKey] || ""}
                                onChange={(event) => setCompanyGearSearchByWeek((previous) => ({ ...previous, [selectionKey]: event.target.value }))}
                                onClick={(event) => event.stopPropagation()}
                                placeholder="회사 교구 검색"
                                aria-label={`${label} ${suggestion.weekNumber}주차 회사 교구 검색`}
                              />
                              <select
                                value={String(selectedGearByWeek[selectionKey] || "").startsWith("company:") ? selectedGearByWeek[selectionKey] : ""}
                                onChange={(event) => setSelectedGearByWeek((previous) => ({ ...previous, [selectionKey]: event.target.value }))}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`${label} ${suggestion.weekNumber}주차 기타 교구 선택`}
                              >
                                <option value="" disabled>교구 선택</option>
                                {normalizedCompanyEquipment.filter((item) => {
                                  const query = String(companyGearSearchByWeek[selectionKey] || "").trim().toLowerCase();
                                  return !query || `${item.name} ${item.englishName}`.toLowerCase().includes(query);
                                }).map((item) => (
                                  <option key={item.id} value={item.id}>{id.startsWith("en_") ? (item.englishName || item.name) : item.name}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {gearPickerEventOptions.length ? (
                            <label className={`monthly-plan-gear-picker__event-option${String(selectedGearByWeek[selectionKey] || "").startsWith("event:") ? " is-selected" : ""}`}>
                              <input
                                type="radio"
                                name={`monthly-plan-${selectionKey}`}
                                checked={String(selectedGearByWeek[selectionKey] || "").startsWith("event:")}
                                onChange={() => setSelectedGearByWeek((previous) => ({
                                  ...previous,
                                  [selectionKey]: gearPickerEventOptions[0]?.value || "",
                                }))}
                              />
                              <small className="monthly-plan-gear-picker__option-label">이벤트</small>
                              <PartyPopper size={24} />
                              <select
                                value={String(selectedGearByWeek[selectionKey] || "").startsWith("event:") ? selectedGearByWeek[selectionKey] : ""}
                                onChange={(event) => setSelectedGearByWeek((previous) => ({ ...previous, [selectionKey]: event.target.value }))}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`${label} ${suggestion.weekNumber}주차 이벤트 선택`}
                              >
                                <option value="" disabled>이벤트 선택</option>
                                {gearPickerEventOptions.map((eventOption) => <option key={eventOption.value} value={eventOption.value}>{eventOption.label}</option>)}
                              </select>
                            </label>
                          ) : null}
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
        {language === "en" ? (
          <>
            <header className="monthly-plan-report-brand">
              <div className="monthly-plan-report-brand__identity">
                <img src="/brand/gts-company-logo.png" alt="GTS" />
                <div><strong>GTS</strong><small>GROW THROUGH SPORTS</small></div>
              </div>
              <span>MONTHLY PHYSICAL EDUCATION REPORT</span>
            </header>
            <header className="monthly-plan-document__title monthly-plan-document__title--en">
              <h1>{monthTitle(month)}</h1>
            </header>
          </>
        ) : (
          <header className="monthly-plan-document__title">
            <h1>{monthTitle(month)}</h1>
            <span>{planId ? "저장된 초안" : "새 계획안"}</span>
          </header>
        )}

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
        )) : ENGLISH_AGE_GROUPS.map(({ id, age, label }) => (
          <section key={id} className="monthly-plan-age-section monthly-plan-age-section--en">
            <h3><span>AGE {age}</span></h3>
            <label className="monthly-plan-goal">
              <span>MONTHLY<br />GOAL</span>
              <textarea
                value={englishGoals[age] || ""}
                onChange={(event) => setEnglishGoals((previous) => ({ ...previous, [age]: event.target.value }))}
                placeholder="Write the monthly learning goal."
                aria-label={`${label} monthly goal`}
              />
            </label>
            <div className="monthly-plan-table monthly-plan-table--en" role="table" aria-label={label}>
              <div className="monthly-plan-table__header" role="row">
                <div role="columnheader">WEEK</div><div role="columnheader">EQUIPMENT</div><div role="columnheader">ACTIVITY</div><div role="columnheader">PURPOSE</div>
              </div>
              {rowsByGroup[id].map((row, index) => (
                <div className="monthly-plan-table__row" role="row" key={`${id}-${row.position}`}>
                  <div className="monthly-plan-week" role="cell"><span>{index + 1}</span></div>
                  <div className="monthly-plan-equipment" role="cell">
                    <input value={row.activity_name} onChange={(event) => setRow(id, index, "activity_name", event.target.value)} placeholder="Equipment" />
                    {imageCell(id, row, index)}
                  </div>
                  <div role="cell"><textarea value={row.activity_description} onChange={(event) => setRow(id, index, "activity_description", event.target.value)} placeholder="Describe the age-appropriate activity." /></div>
                  <div className="monthly-plan-purpose" role="cell"><textarea value={row.key_expression} onChange={(event) => setRow(id, index, "key_expression", event.target.value)} placeholder="Describe the motor-development purpose." /></div>
                </div>
              ))}
            </div>
            <p className="monthly-plan-english-note">This monthly plan is subject to change depending on circumstances.</p>
          </section>
        ))}
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
