/** 수업 참관·모니터링 리포트 PDF용 HTML (A4, .template-page 단위로 PDF 변환) */

const GRADE = {
  excellent: { label: "우수", color: "#30a14e" },
  adequate: { label: "적정", color: "#0a7cff" },
  needs: { label: "개선요망", color: "#f08a00" },
};
const PURPOSE = { regular: "정기 월간 참관", intensive: "집중 모니터링" };

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function koDate(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일 (${wd})`;
}

const PAGE_CAPACITY_MM = 243; // 한 페이지 본문 가용 높이 (머리글·바닥글 제외)
const FIRST_PAGE_HEAD_MM = 112; // 1페이지 상단(타이틀·정보·요약) 높이

function textLines(text, perLine) {
  return Math.max(1, Math.ceil(String(text || "").length / perLine));
}

const TIPS = {
  q1: "수업 시작 15분 전 도착을 목표로 하면 교구 배치와 아이들 맞이에 여유가 생깁니다.",
  q2: "밝은 인사와 단정한 복장은 아이들과 원 선생님께 주는 첫인상입니다. 입장할 때 먼저 웃으며 인사해 주세요.",
  q3: "전날 계획안을 한 번 훑어 보고 활동 순서를 메모해 가면 수업 흐름이 끊기지 않습니다.",
  q4: "수업 전 바닥의 미끄러움, 모서리, 이물질을 3분만 둘러봐도 사고 위험이 크게 줄어듭니다.",
  q26: "사용 전후 교구를 닦고, 오염되거나 파손된 교구는 바로 교구 관리자에게 알려 주세요. 위생은 학부모 신뢰와 직결됩니다.",
  q27: "계획안의 교구 목록을 전날 체크리스트로 챙기고, 부족하면 앱에서 미리 대여하거나 대체 교구를 준비해 주세요.",
  q5: "관절 돌리기, 가벼운 달리기 등 3~5분 워밍업을 매 수업의 고정 루틴으로 만들어 주세요.",
  q6: "활동 시작 전 '멈춤 신호'와 교구 사용 규칙을 아이들 눈높이의 말로 한 번 짚어 주세요.",
  q7: "기구를 쓰는 활동에서는 아이들 동선 옆에 서서 손이 닿는 거리를 유지해 주세요.",
  q8: "모든 아이의 이름을 한 번 이상 불러 주고, 지적보다 긍정적인 표현으로 말해 주세요.",
  q9: "큰 소리나 아이들 간 비교는 줄이고, 꼭 필요한 접촉은 먼저 말로 알린 뒤에 해 주세요.",
  q10: "어려워하는 아이에게는 한 단계 쉬운 동작을 먼저 제시하고, 시도 자체를 칭찬해 주세요.",
  q11: "'발이 정말 높이 올라갔네'처럼 구체적으로 칭찬하고, 다툼이 생기면 두 아이의 이야기를 차례로 들어 주세요.",
  q12: "정시에 시작해야 아이들의 집중이 유지됩니다. 시작 5분 전에는 준비를 끝내 두세요.",
  q13: "동작을 연령에 맞게 잘게 나누고, 말로 설명하기 전에 몸으로 먼저 시범을 보여 주세요.",
  q14: "한 가지 교구만 반복하지 말고, 전개 단계에서 교구를 바꿔 몰입을 이어 가 주세요.",
  q15: "도입(놀이로 집중), 전개(핵심 활동), 마무리(정리·칭찬)의 시간 배분을 계획안에 적어 두세요.",
  q16: "지시는 짧은 문장으로 한 번에 하나씩, 맨 뒤 아이에게도 들리는 크기와 또렷한 톤으로 전달해 주세요.",
  q17: "아이들의 연령별 운동 발달 단계에 맞춰 동작을 고르고, 활동마다 발달 목표를 한 가지씩 분명히 해 주세요.",
  q28: "영어 표현은 GTS 영어 표현 대본 그대로 정확한 발음과 문장으로 말하고, 동작과 함께 반복해 주세요.",
  q18: "원장님과 담임 선생님께 수업 전후로 인사드리고 전달할 내용은 짧게 공유해 주세요.",
  q20: "수업 마지막 3분은 스트레칭과 심호흡으로 아이들의 몸과 마음을 가라앉혀 주세요.",
  q21: "아이들이 함께 교구를 모으게 하고, 개수를 확인해 안전하게 회수해 주세요.",
  q22: "마무리 때 '오늘 해낸 것' 한두 가지를 말해 주고, 모든 아이에게 칭찬을 전해 주세요.",
  q23: "종료 5분 전에 마무리 신호를 두고 정해진 시간에 끝내, 다음 일정에 지장이 없게 해 주세요.",
  q24: "아이들을 담임 선생님께 직접 인계하고, 이동할 때 인원을 한 번 더 확인해 주세요.",
  q25: "수업이 끝나면 곧바로 앱에 특이사항(다침, 갈등 등)을 남겨 주세요.",
};

/**
 * @param {object} row  teacher_monitoring_evaluations 행
 * @param {Array} template  [{area, groups:[{title, items:[{key,text}]}]}]
 */
export function buildMonitoringReportHtml(row, { template, logoUrl }) {
  const byKey = Object.fromEntries((row.items || []).map(i => [i.key, i.grade]));
  let ex = 0; let ad = 0; let ne = 0;
  template.forEach(sec => sec.groups.forEach(g => g.items.forEach(it => {
    const gr = byKey[it.key];
    if (gr === "excellent") ex += 1; else if (gr === "adequate") ad += 1; else if (gr === "needs") ne += 1;
  })));
  const total = ex + ad + ne;
  const rate = total ? Math.round((ex / total) * 100) : 0;
  const seg = n => (total ? (n / total) * 100 : 0);

  const teacher = row.teacher_name || "담당";
  const gradeOf = key => byKey[key];

  // 그룹별 집계
  const groupStats = [];
  template.forEach(sec => sec.groups.forEach(g => {
    const c = { ex: 0, ad: 0, ne: 0, n: 0 };
    g.items.forEach(it => {
      const gr = gradeOf(it.key);
      if (gr === "excellent") c.ex += 1; else if (gr === "adequate") c.ad += 1; else if (gr === "needs") c.ne += 1;
      if (gr) c.n += 1;
    });
    groupStats.push({ title: g.title.replace(/^\d+\.\s*/, ""), ...c });
  }));
  const strongGroups = groupStats.filter(g => g.n && g.ex / g.n >= 0.8).map(g => g.title);
  const needItems = [];
  const adequateItems = [];
  template.forEach(sec => sec.groups.forEach(g => g.items.forEach(it => {
    const gr = gradeOf(it.key);
    if (gr === "needs") needItems.push(it);
    if (gr === "adequate") adequateItems.push(it);
  })));

  const blocks = [];
  const block = (h, html, breakBefore = false) => blocks.push({ h, html, breakBefore });

  // 1) 종합 요약 (풀어쓴 글)
  const strongText = strongGroups.length
    ? `특히 <b>${strongGroups.map(esc).join(", ")}</b> 영역에서 안정적으로 좋은 모습을 보여 주셨습니다.`
    : "고르게 성실한 모습을 보여 주셨습니다.";
  const needText = needItems.length
    ? `다만 ${needItems.length}개 항목은 개선이 필요해, 아래 '이렇게 해보세요'에 실천 방법을 정리했습니다.`
    : "개선이 필요한 항목은 없었습니다. 지금처럼 유지해 주세요.";
  block(31, `<div class="sec">종합 요약</div><p class="lead">${esc(teacher)} 선생님은 총 <b>${total}개</b> 항목 중 <b>${ex}개</b>에서 우수한 평가를 받았습니다(우수 비율 ${rate}%). ${strongText} ${needText}</p>`);

  // 2) 잘하고 계신 점
  if (strongGroups.length) {
    block(14 + 7.2 * strongGroups.length, `<div class="sec">잘하고 계신 점</div><div class="cardlist">${
      groupStats.filter(g => g.n && g.ex / g.n >= 0.8).map(g => `<div class="strong"><i></i><span><b>${esc(g.title)}</b> · ${g.n}개 항목 중 ${g.ex}개 우수</span></div>`).join("")
    }</div>`);
  }

  // 3) 이렇게 해보세요 (개선요망 → 적정 순)
  const tipRow = (it, tone) => {
    const tip = TIPS[it.key] || "";
    return { h: 11 + 4.6 * textLines(it.text, 52) + 4.7 * textLines(tip, 56), html: `<div class="tip tip--${tone}"><div class="tip__t"><i></i>${esc(it.text)}</div><div class="tip__b">${esc(tip)}</div></div>` };
  };
  const tipRows = [
    ...needItems.map(it => ({ ...tipRow(it, "needs"), tag: "needs" })),
    ...adequateItems.map(it => ({ ...tipRow(it, "adequate"), tag: "adequate" })),
  ];
  if (tipRows.length) {
    tipRows.forEach((r, i) => {
      const lead = i === 0
        ? `<div class="sec">이렇게 해보세요</div><p class="note">개선요망 항목은 먼저, 적정 항목은 한 단계 더 올릴 수 있는 방법입니다.</p>`
        : "";
      block(r.h + (i === 0 ? 16 : 0), lead + r.html);
    });
  }

  // 4) 원장님께 드리는 말씀
  const followUp = needItems.length
    ? `개선요망 ${needItems.length}개 항목은 담당 강사와 공유했으며, GTS는 다음 정기 참관에서 이행 여부를 다시 확인하겠습니다.`
    : "특별히 보완이 필요한 항목은 없었으며, GTS는 다음 정기 참관에서도 같은 기준으로 수업의 질을 점검하겠습니다.";
  block(34, `<div class="sec">원장님께 드리는 말씀</div><p class="lead lead--sm">${esc(row.facility_name || "귀 원")}에서 진행된 ${esc(teacher)} 선생님의 수업을 ${esc(koDate(row.observed_on))} 참관하였습니다. 총 ${total}개 점검 항목 중 우수 ${ex}개, 적정 ${ad}개, 개선요망 ${ne}개였습니다. ${esc(followUp)}</p>`);

  // 5) 참관자 종합 피드백 (직접 작성)
  const feedbackHtml = (title, text) => `<div class="fb"><div class="fb__t">${title}</div><div class="fb__b">${
    text ? esc(text).replace(/\n/g, "<br>") : `<span class="muted">기재 내용 없음</span>`
  }</div></div>`;
  const posH = 12 + 4.6 * Math.max(2, textLines(row.positive_comment, 52));
  const impH = 12 + 4.6 * Math.max(2, textLines(row.improvement_comment, 52));
  block(14 + posH, `<div class="sec">참관자 종합 피드백</div>${feedbackHtml("우수 및 긍정 소견", row.positive_comment)}`);
  block(impH, feedbackHtml("개선 필요 사항 · 조치 계획", row.improvement_comment));

  block(24, `<div class="sign"><div><span>담당 강사 확인</span></div><div><span>원장 확인</span></div></div>`);

  // 6) 상세 체크표 (부록) — 새 페이지에서 시작
  template.forEach(sec => {
    sec.groups.forEach((g, gi) => {
      const rows = g.items.map(it => {
        const grade = GRADE[byKey[it.key]];
        const h = 2.8 + 4.5 * textLines(it.text, 44);
        const html = `<div class="item"><span class="item__t">${esc(it.text)}</span><span class="item__g">${
          grade ? `<i style="background:${grade.color}"></i>${grade.label}` : `<em>-</em>`
        }</span></div>`;
        return { h, html };
      });
      const head = (gi === 0 ? `<div class="area">${esc(sec.area)}</div>` : "")
        + `<div class="group">${esc(g.title)}</div>`;
      const headH = (gi === 0 ? 11 : 0) + 8.5;
      const appendixLead = sec === template[0] && gi === 0
        ? `<div class="sec sec--appendix">상세 체크표</div>` : "";
      block(headH + rows[0].h + (appendixLead ? 12 : 0), appendixLead + head + rows[0].html, Boolean(appendixLead));
      for (let i = 1; i < rows.length; i += 1) block(rows[i].h, rows[i].html);
    });
  });

  const pages = [[]];
  let used = FIRST_PAGE_HEAD_MM;
  blocks.forEach(b => {
    if ((b.breakBefore || used + b.h > PAGE_CAPACITY_MM) && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(b.html);
    used += b.h;
  });

  const meta = [
    ["시설", row.facility_name || "-"],
    ["반", row.class_name || "-"],
    ["담당 강사", row.teacher_name || "-"],
    ["참관 일시", `${koDate(row.observed_on)}${row.observed_time ? ` ${esc(row.observed_time)}` : ""}`],
    ["참관자", row.observer_name || "-"],
    ["참관 목적", PURPOSE[row.purpose] || "-"],
  ];

  // 로고 심볼(500x250 이미지 안의 실제 도형 영역 184,62 ~ 315,214)만 잘라 크게 보여 준다
  const mark = (heightMm) => {
    const k = heightMm / 152;
    const imgW = 500 * k;
    return `<span class="mark" style="width:${(131 * k).toFixed(2)}mm;height:${heightMm}mm"><img src="${esc(logoUrl)}" alt="GTS" style="width:${imgW.toFixed(2)}mm;left:${(-184 * k).toFixed(2)}mm;top:${(-62 * k).toFixed(2)}mm" /></span>`;
  };
  const headerFirst = `<header class="top top--first"><div class="brand brand--lg">${mark(15)}<span class="brand__txt"><b>GTS</b><small>GROW THROUGH SPORTS</small></span></div><span class="eyebrow">KIDS SPORTS EDUCATION</span></header>`;
  const headerNext = `<header class="top"><div class="brand">${mark(8.5)}<span class="brand__txt"><b>GTS</b></span></div><span class="eyebrow">KIDS SPORTS EDUCATION</span></header>`;
  const hero = `
    <section class="hero">
      <div class="eyebrow eyebrow--dark">CLASS OBSERVATION REPORT</div>
      <h1>수업 참관 리포트</h1>
      <p class="sub">${esc(row.teacher_name)} 선생님 · ${esc(koDate(row.observed_on))}</p>
    </section>
    <section class="meta">${meta.map(([k, v]) => `<div><span>${k}</span><b>${esc(v).replace(/&amp;nbsp;/g, " ")}</b></div>`).join("")}</section>
    <section class="summary">
      <div class="summary__rate"><b>${rate}<small>%</small></b><span>우수 비율</span></div>
      <div class="summary__bars">
        <div class="bar"><i style="width:${seg(ex)}%;background:${GRADE.excellent.color}"></i><i style="width:${seg(ad)}%;background:${GRADE.adequate.color}"></i><i style="width:${seg(ne)}%;background:${GRADE.needs.color}"></i></div>
        <div class="legend">
          <div><i style="background:${GRADE.excellent.color}"></i>우수<b>${ex}</b></div>
          <div><i style="background:${GRADE.adequate.color}"></i>적정<b>${ad}</b></div>
          <div><i style="background:${GRADE.needs.color}"></i>개선요망<b>${ne}</b></div>
        </div>
      </div>
    </section>`;

  const pageHtml = pages.map((parts, idx) => `
    <section class="template-page">
      ${idx === 0 ? headerFirst : headerNext}
      ${idx === 0 ? hero : ""}
      <div class="body">${parts.join("")}</div>
      <footer class="foot"><span>본 리포트는 유아체육 전문교육기업 GTS(지티에스)의 품질 관리 표준에 따라 작성되었습니다.</span><span>${idx + 1} / ${pages.length}</span></footer>
    </section>`).join("");

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>수업 참관 리포트</title><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; color: #1d1d1f; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif; -webkit-font-smoothing: antialiased; }
    .template-page { position: relative; width: 210mm; height: 297mm; padding: 16mm 18mm 16mm; overflow: hidden; background: #fff; page-break-after: always; }
    .top { display: flex; align-items: center; justify-content: space-between; height: 9mm; margin-bottom: 7mm; }
    .top--first { height: 16mm; margin-bottom: 8mm; }
    .brand { display: flex; align-items: center; gap: 9px; }
    .brand__txt { display: flex; flex-direction: column; justify-content: center; }
    .brand__txt b { font-size: 13px; font-weight: 800; letter-spacing: .02em; line-height: 1; color: #1d1d1f; }
    .brand--lg { gap: 13px; }
    .brand--lg .brand__txt b { font-size: 25px; letter-spacing: .01em; }
    .brand--lg .brand__txt small { margin-top: 5px; font-size: 7.5px; font-weight: 600; letter-spacing: .26em; color: #86868b; }
    .mark { position: relative; display: inline-block; overflow: hidden; flex: none; }
    .mark img { position: absolute; max-width: none; height: auto; }
    .eyebrow { font-size: 8.5px; font-weight: 600; letter-spacing: .18em; color: #86868b; }
    .eyebrow--dark { color: #30a14e; margin-bottom: 8px; }
    .hero { padding: 6mm 0 7mm; }
    .hero h1 { font-size: 34px; font-weight: 700; letter-spacing: -.035em; line-height: 1.12; }
    .hero .sub { margin-top: 9px; font-size: 14px; color: #6e6e73; letter-spacing: -.01em; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 18px; padding: 6mm 0; border-top: 1px solid #e5e5ea; border-bottom: 1px solid #e5e5ea; }
    .meta span { display: block; font-size: 8.5px; font-weight: 600; letter-spacing: .06em; color: #86868b; margin-bottom: 4px; }
    .meta b { font-size: 12.5px; font-weight: 600; letter-spacing: -.01em; }
    .summary { display: grid; grid-template-columns: 38mm 1fr; align-items: center; gap: 8mm; margin: 7mm 0 4mm; padding: 6.5mm 7mm; background: #f5f5f7; border-radius: 18px; }
    .summary__rate b { display: block; font-size: 46px; font-weight: 700; letter-spacing: -.04em; line-height: 1; }
    .summary__rate small { font-size: 20px; font-weight: 600; margin-left: 2px; color: #6e6e73; }
    .summary__rate span { display: block; margin-top: 6px; font-size: 10px; color: #6e6e73; }
    .bar { display: flex; height: 9px; border-radius: 99px; overflow: hidden; background: #e5e5ea; }
    .bar i { display: block; height: 100%; }
    .legend { display: flex; gap: 20px; margin-top: 11px; font-size: 10.5px; color: #3a3a3c; }
    .legend div { display: flex; align-items: center; gap: 6px; }
    .legend i { width: 7px; height: 7px; border-radius: 99px; display: inline-block; }
    .legend b { margin-left: 3px; font-size: 12px; }
    .area { margin: 6mm 0 1.5mm; font-size: 8.5px; font-weight: 700; letter-spacing: .14em; color: #30a14e; text-transform: uppercase; }
    .group { margin: 3.5mm 0 0; padding-bottom: 1.6mm; font-size: 12px; font-weight: 700; letter-spacing: -.015em; border-bottom: 1px solid #1d1d1f; }
    .item { display: flex; align-items: center; justify-content: space-between; gap: 10mm; padding: 1.7mm 0; border-bottom: 1px solid #ececf0; font-size: 10px; line-height: 1.45; letter-spacing: -.01em; }
    .item__t { flex: 1; color: #1d1d1f; }
    .item__g { flex: none; display: inline-flex; align-items: center; gap: 5px; min-width: 19mm; justify-content: flex-start; font-size: 10px; font-weight: 600; color: #1d1d1f; }
    .item__g i { width: 7px; height: 7px; border-radius: 99px; display: inline-block; }
    .item__g em { color: #c7c7cc; font-style: normal; }
    .sec { margin: 7mm 0 3mm; font-size: 8.5px; font-weight: 700; letter-spacing: .14em; color: #30a14e; }
    .fb { margin-bottom: 4mm; padding: 5mm 6mm; background: #f5f5f7; border-radius: 14px; }
    .fb__t { font-size: 10.5px; font-weight: 700; margin-bottom: 6px; letter-spacing: -.01em; }
    .fb__b { font-size: 10.5px; line-height: 1.65; color: #3a3a3c; letter-spacing: -.01em; }
    .muted { color: #aeaeb2; }
    .lead { font-size: 12.5px; line-height: 1.75; color: #1d1d1f; letter-spacing: -.01em; }
    .lead b { font-weight: 700; }
    .lead--sm { font-size: 11px; color: #3a3a3c; }
    .note { margin: -1mm 0 3mm; font-size: 10px; color: #86868b; }
    .cardlist { display: grid; gap: 2mm; }
    .strong { display: flex; align-items: center; gap: 8px; padding: 2.6mm 4mm; background: #f2faf4; border-radius: 10px; font-size: 11px; color: #1d1d1f; }
    .strong i { width: 7px; height: 7px; border-radius: 99px; background: #30a14e; flex: none; }
    .tip { margin-bottom: 2.4mm; padding: 3.2mm 4.5mm; border-radius: 12px; background: #f5f5f7; }
    .tip__t { display: flex; align-items: flex-start; gap: 7px; font-size: 10.8px; font-weight: 700; letter-spacing: -.01em; line-height: 1.5; }
    .tip__t i { width: 7px; height: 7px; border-radius: 99px; flex: none; margin-top: 5px; }
    .tip--needs .tip__t i { background: #f08a00; }
    .tip--adequate .tip__t i { background: #0a7cff; }
    .tip__b { margin: 1.4mm 0 0 14px; font-size: 10.2px; line-height: 1.6; color: #3a3a3c; letter-spacing: -.01em; }
    .sec--appendix { margin-top: 0; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; margin-top: 6mm; }
    .sign div { padding-top: 8mm; border-bottom: 1px solid #c7c7cc; }
    .sign span { display: block; padding: 1.5mm 0; font-size: 9px; color: #86868b; transform: translateY(100%); }
    .foot { position: absolute; left: 18mm; right: 18mm; bottom: 10mm; display: flex; justify-content: space-between; font-size: 8px; color: #aeaeb2; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>${pageHtml}</body></html>`;
}
