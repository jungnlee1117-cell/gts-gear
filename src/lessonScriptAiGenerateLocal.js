import { AI_ACTIVITY_TYPES } from "./lessonScriptAiTypes.js";

const AGE_LABELS = { "3-4": "3~4세", "5-6": "5~6세", "7+": "7세 이상", mixed: "혼합 연령" };
const ATM_LABELS = { calm: "차분한", normal: "보통", energetic: "활발한", competitive: "경쟁적인" };

function d(easy, medium, hard) {
  return { easy, medium, hard };
}

function tagsFromGoal(goal) {
  const g = (goal || "").toLowerCase();
  const tags = [];
  if (/협응|coordination|손발/.test(g)) tags.push("협응력");
  if (/균형|balance/.test(g)) tags.push("균형감");
  if (/근력|strength|힘/.test(g)) tags.push("근지구력");
  if (/유연|stretch|스트레칭/.test(g)) tags.push("유연성");
  if (/집중|focus|attention/.test(g)) tags.push("집중력");
  if (/표현|english|영어|말하기/.test(g)) tags.push("언어표현");
  if (!tags.length) tags.push("전신 움직임", "수업 참여");
  return tags.slice(0, 4);
}

function energyFromAtmosphere(atm) {
  return { calm: "낮음", normal: "중간", energetic: "높음", competitive: "높음" }[atm] || "중간";
}

function durationForType(type, atm) {
  if (type === AI_ACTIVITY_TYPES.WARMUP) return atm === "energetic" ? "5~7분" : "4~6분";
  if (type === AI_ACTIVITY_TYPES.GAME) return atm === "calm" ? "6~8분" : "8~12분";
  return "15~25분";
}

function sizeForAge(age) {
  if (age === "3-4") return "6~10명";
  if (age === "7+") return "10~16명";
  return "8~14명";
}

function ruleDifficulty(atm, age) {
  if (age === "3-4") return "쉬움";
  if (atm === "competitive" || age === "7+") return "어려움";
  return "보통";
}

/**
 * API 미사용 시 룰 기반 대본 생성 (개발/오프라인 폴백)
 * @param {import("./lessonScriptAiTypes.js").AiGenerateInput} input
 * @returns {import("./lessonScriptAiTypes.js").AiGenerateResult}
 */
export function generateLessonScriptLocally(input) {
  const name = input.activityName?.trim() || "Activity";
  const ageLabel = AGE_LABELS[input.targetAge] || input.targetAge;
  const atmLabel = ATM_LABELS[input.atmosphere] || input.atmosphere;
  const gear = input.gear?.trim() || "없음";
  const goal = input.goal?.trim() || "몸을 풀고 수업에 집중하기";
  const precautions = input.precautions?.trim() || "충돌 주의, 선생님 신호에 따라 움직이기";
  const type = input.activityType || AI_ACTIVITY_TYPES.WARMUP;

  const typeKo = type === AI_ACTIVITY_TYPES.GAME ? "게임" : type === AI_ACTIVITY_TYPES.GEAR ? "교구 수업" : "준비운동";
  const energy = energyFromAtmosphere(input.atmosphere);

  const description = `${name}은(는) ${ageLabel} 대상 ${typeKo}입니다. ${goal}을(를) 목표로 하며, ${atmLabel} 분위기에 맞게 진행합니다.${gear !== "없음" ? ` ${gear}을(를) 활용합니다.` : ""}`;

  const setup = [
    `1. 아이들에게 활동 공간을 확보해 주세요 (최소 ${sizeForAge(input.targetAge)} 기준).`,
    gear !== "없음" ? `2. ${gear}을(를) 안전하게 배치합니다.` : "2. 장애물을 치우고 바닥을 확인합니다.",
    `3. ${precautions}`,
    `4. 규칙을 한국어로 간단히 설명한 뒤 영어 대본으로 진행합니다.`,
  ].join("\n");

  const progressSteps = type === AI_ACTIVITY_TYPES.GEAR
    ? [
      "1. 교구 소개 및 안전 규칙 설명",
      "2. 선생님 시범 (Foundation/Interactive 레벨에 맞게)",
      "3. 아이들 순차/소그룹 실습",
      "4. 난이도 업 또는 응용 활동",
      "5. 정리 및 칭찬",
    ].join("\n")
    : [
      "1. 안전 멘트 및 규칙 설명",
      "2. 선생님 시범 (Slow demo)",
      "3. 전체 함께 따라 하기",
      `4. ${type === AI_ACTIVITY_TYPES.GAME ? "게임 본편 진행" : "강도 점진적 상승"}`,
      "5. 마무리 스트레칭 또는 칭찬",
    ].join("\n");

  const scripts = buildScripts(name, type, input);
  const safetyMemo = buildSafety(name, precautions, input);

  const meta = {
    description,
    setup,
    progressSteps,
    recommendedAge: ageLabel,
    recommendedDuration: durationForType(type, input.atmosphere),
    appropriateSize: sizeForAge(input.targetAge),
    energyLevel: energy,
    ruleDifficulty: ruleDifficulty(input.atmosphere, input.targetAge),
    physicalGoalTags: tagsFromGoal(goal),
    atmosphereTags: [atmLabel, energy === "높음" ? "고에너지" : "안정적"].filter(Boolean),
    recommendedSituations: [
      `${atmLabel} 분위기의 ${typeKo} 시간`,
      goal.length > 4 ? `${goal}이 필요할 때` : "수업 초반 몸풀기 후",
      gear !== "없음" ? `${gear} 수업 전/후 연계` : "실내 체육 수업",
    ],
    avoidSituations: [
      precautions.includes("충돌") ? "좁은 공간에서 다수 동시 이동" : "미끄러운 바닥",
      input.targetAge === "3-4" ? "규칙이 복잡한 경쟁 위주 진행" : "안전 설명 없이 즉시 시작",
      energy === "높음" ? "수업 종료 직전 진정이 필요한 시간" : "아이 컨디션이 매우 저조할 때",
    ],
  };

  let gearLessonText = "";
  if (type === AI_ACTIVITY_TYPES.GEAR) {
    const gearName = input.gearLabel || gear;
    const level = input.levelLabel || "Foundation";
    gearLessonText = [
      `— Opening · ${gearName} —`,
      `[Teacher] ${scripts.default.medium}`,
      "",
      `— Activity 1 —`,
      `[Teacher] Let's try ${gearName} together! Watch me first.`,
      `[Teacher] ${scripts.default.medium}`,
      `[Kids] (follow and respond)`,
      "",
      `— Activity 2 —`,
      `[Teacher] Great job! Now let's add a challenge.`,
      `[Teacher] ${scripts.default.hard}`,
      "",
      `— Closing —`,
      `[Teacher] Well done everyone! ${meta.physicalGoalTags[0] || "Great work"} today!`,
      "",
      `※ ${level} 레벨 · ${precautions}`,
    ].join("\n");
  }

  return {
    activityName: name,
    meta,
    scripts,
    safetyMemo,
    gearLessonText,
    source: "local",
  };
}

function buildScripts(name, type, input) {
  const short = name.split(" ")[0];
  if (type === AI_ACTIVITY_TYPES.WARMUP) {
    return {
      default: d(
        `${short} time! Copy teacher! Ready, go!`,
        `Let's do ${name}! Follow me — nice and steady. Ready? Go!`,
        `Warm up time! ${name} — listen to the rules, then lead your partner in English. Ready, set, go!`,
      ),
      alternatives: [
        d(
          `Up up! ${short}! Let's move!`,
          `Warm up! ${name}! Mirror my moves.`,
          `${name} warm up! Can you explain the first step in English?`,
        ),
        d(
          `Move move! Follow me!`,
          `Everyone stand up! ${name} together!`,
          `Team warm up! ${name} — who can count our reps in English?`,
        ),
        d(
          `Go go ${short}!`,
          `Let's warm up with ${name}! Big smiles!`,
          `Challenge warm up! ${name} — faster on the last round, safely!`,
        ),
      ],
    };
  }

  if (type === AI_ACTIVITY_TYPES.GAME) {
    return {
      default: d(
        `${short} game! Listen to teacher! Go!`,
        `Let's play ${name}! Remember the rules. Are you ready? Go!`,
        `${name} game time! Explain one rule in English, then we play fair and cheer for friends!`,
      ),
      alternatives: [
        d(
          `Game time! ${short}!`,
          `${name}! Green light go!`,
          `${name} — who can be the referee and call the rules in English?`,
        ),
        d(
          `Play play!`,
          `Fun game — ${name}! Listen carefully.`,
          `Team ${name}! Use English words when you pass or tag.`,
        ),
        d(
          `Let's play!`,
          `${name} start! Play safe!`,
          `${name} challenge round — bonus point for fair play in English!`,
        ),
      ],
    };
  }

  return {
    default: d(
      `Look! ${short}! Touch carefully.`,
      `Today we use ${name}. Watch teacher, then your turn. Be safe!`,
      `${name} lesson! Describe what you see in English, then try the challenge level.`,
    ),
    alternatives: [
      d(
        `Wow! ${short}!`,
        `This is ${name}. Two hands, please!`,
        `${name} — what shape is it? What can we do with it?`,
      ),
      d(
        `New gear!`,
        `Let's learn ${name} together!`,
        `${name} time! Ask me one question in English before we start.`,
      ),
      d(
        `Gear time!`,
        `${name}! Wait for teacher's signal.`,
        `${name} challenge — teach your partner one safety rule in English.`,
      ),
    ],
  };
}

function buildSafety(name, precautions, input) {
  const base = precautions || "Be safe!";
  return {
    default: d(
      `Be careful! ${base}`,
      `Before ${name} — ${base}. Play safe!`,
      `Safety first for ${name}! ${base} Who can repeat the safety rule in English?`,
    ),
    alternatives: [
      d("Safe safe!", `Safety check! ${base}`, `Eyes on teacher. ${base} Ready safely?`),
      d("Slowly please!", `No pushing! ${base}`, `Space bubbles on! ${base}`),
      d("Careful!", `Listen first. ${base}`, `Safety moment — any questions about ${name}?`),
    ],
  };
}
