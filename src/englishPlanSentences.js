import { naturalEnglishEquipmentName } from "./lessonPlan.js";

export function fallbackEnglishPlanText(koreanName, englishName) {
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

export function fallbackEnglishKeyExpression(koreanName) {
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

export function isGenericEnglishPlanText(koreanName) {
  const value = String(koreanName || "");
  return !(/꽃게.*낚시|낚시.*꽃게|도넛|에어\s*T\s*터널|에어\s*티\s*터널|T\s*터널|티\s*터널|밸런스|균형|징검|쿠션|스톤|파이프.*공.*나르|공.*파이프|공.*나르|판.*뒤집|보드.*뒤집|스펀지.*체조.*볼|체조.*스펀지.*볼|공|볼|오자미|빈백|바스켓|줄넘|점프|허들|에어|사다리|터널|옥타곤|삼각|클라이밍|컵|도미노|블록|스택/i.test(value));
}

export function buildEnglishPurpose(suggestion, age = "5", index = 0) {
  const source = `${suggestion?.englishName || ""} ${suggestion?.name || ""} ${suggestion?.englishActivity || ""}`.toLowerCase();
  let focus = "whole-body coordination, balance, and confident body control";
  if (/ball|catch|throw|basket|fishing|ring toss|target|pipe/.test(source)) focus = "hand-eye coordination, object control, and movement accuracy";
  else if (/stack|block|donut|cup|domino|build/.test(source)) focus = "spatial planning, balance, and controlled hand-body coordination";
  else if (/tunnel|climb|air mat|obstacle|ladder/.test(source)) focus = "core stability, whole-body coordination, and spatial awareness";
  else if (/jump|hurdle|rope|stepping|stone/.test(source)) focus = "dynamic balance, lower-body strength, and controlled landing";
  else if (/board|flip|balance/.test(source)) focus = "postural control, balance reactions, and movement confidence";

  const verbs = age === "7"
    ? ["Refines", "Advances", "Integrates"]
    : age === "6"
      ? ["Strengthens", "Expands", "Connects"]
      : age === "4"
        ? ["Introduces", "Encourages", "Supports"]
        : ["Builds", "Develops", "Supports"];
  const progression = age === "7"
    ? "through complex sequences, precise control, and independent decisions"
    : age === "6"
      ? "through linked actions, direction changes, and responsive challenges"
      : age === "4"
        ? "through playful first tries, simple steps, and lots of encouragement"
        : "through guided exploration, repetition, and successful first attempts";
  return `${verbs[index % verbs.length]} ${focus} ${progression}.`;
}

export function buildEnglishActivity(suggestion, age = "5", index = 0) {
  let base = String(suggestion?.englishActivity || "").trim();
  if (!base) return "";
  const leads = age === "7"
    ? ["Children work with greater independence as they", "Children use longer movement sequences to", "Children take part in advanced challenges as they"]
    : age === "6"
      ? ["Children work through linked challenges as they", "Children work with partners and small groups to", "Children respond to direction and speed changes as they"]
      : age === "4"
        ? ["Children try simple, playful movements as they", "Children follow short, clear steps as they", "Children enjoy safe, guided practice as they"]
        : ["Children explore through playful activities as they", "Children follow clear demonstrations as they", "Children build confidence through safe, repeated practice as they"];
  base = base.replace(/^Children\s+/i, `${leads[index % leads.length]} `);
  const extension = age === "7"
    ? "Movements are combined into a longer sequence with precise control and independent choices."
    : age === "6"
      ? "Two or more actions are connected while direction, speed, or partner cues change."
      : age === "4"
        ? "Short, cheerful steps help every child feel successful."
        : "Simple steps and encouraging repetition help every learner experience success.";
  return `${base} ${extension}`;
}

const GENERIC_ACTIVITY_LEADS = [
  "Children explore through playful activities as they",
  "Children follow clear demonstrations as they",
  "Children build confidence through safe, repeated practice as they",
  "Children work through linked challenges as they",
  "Children work with partners and small groups to",
  "Children respond to direction and speed changes as they",
  "Children work with greater independence as they",
  "Children use longer movement sequences to",
  "Children take part in advanced challenges as they",
  "Children try simple, playful movements as they",
  "Children follow short, clear steps as they",
  "Children enjoy safe, guided practice as they",
  "Children",
].join("|");
const GENERIC_ACTIVITY_TAILS = [
  "Simple steps and encouraging repetition help every learner experience success.",
  "Two or more actions are connected while direction, speed, or partner cues change.",
  "Movements are combined into a longer sequence with precise control and independent choices.",
  "Short, cheerful steps help every child feel successful.",
].join("|");
const GENERIC_PURPOSE_FOCUS = "whole-body coordination, balance, and confident body control";
const PURPOSE_VERBS = "Refines|Advances|Integrates|Strengthens|Expands|Connects|Introduces|Encourages|Supports|Builds|Develops";
const PURPOSE_TAILS = [
  "through complex sequences, precise control, and independent decisions",
  "through linked actions, direction changes, and responsive challenges",
  "through playful first tries, simple steps, and lots of encouragement",
  "through guided exploration, repetition, and successful first attempts",
].join("|");

function compactSentence(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isGenericEnglishActivity(value) {
  const text = compactSentence(value);
  if (!text) return false;
  const pattern = new RegExp(`^(?:${GENERIC_ACTIVITY_LEADS}) explore the .+ through guided movement challenges and simple games\\. The activity develops coordination, body control, spatial awareness, and confidence\\. (?:${GENERIC_ACTIVITY_TAILS.replaceAll(".", "\\.")})$`);
  return pattern.test(text);
}

export function isGenericEnglishPurpose(value) {
  const text = compactSentence(value);
  if (!text) return false;
  return new RegExp(`^(${PURPOSE_VERBS}) ${GENERIC_PURPOSE_FOCUS} (${PURPOSE_TAILS})\\.$`).test(text);
}

export function isGenericEnglishSentence(value, kind) {
  return kind === "purpose" ? isGenericEnglishPurpose(value) : isGenericEnglishActivity(value);
}
