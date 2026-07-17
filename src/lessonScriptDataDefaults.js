/** 수업 대본 만들기 — 번들 기본 데이터 (관리자 오버라이드 전 원본) */

import {
  EXPANDED_CLOSING_ACTIVITIES,
  EXPANDED_CLOSING_VARIANTS,
  EXPANDED_GAME_ACTIVITIES,
  EXPANDED_GAME_VARIANTS,
  EXPANDED_PREPARATION_ACTIVITIES,
  EXPANDED_PREPARATION_VARIANTS,
  EXPANDED_WARMUP_SETS,
  EXPANDED_WARMUP_SET_VARIANTS,
} from "./lessonScriptExpandedContent.js";

export const LESSON_SCRIPT_LEVELS = [
  { id: "foundation", label: "Foundation" },
  { id: "interactive", label: "Interactive" },
];

const d = (easy, medium, hard) => ({ easy, medium, hard });

/** @deprecated 파트 구조 제거 — 빈 객체만 남겨 옛 패치 merge 호환 */
export const WARMUP_PART_VARIANTS = {};

/** @deprecated 교구 소개는 교구 수업 대본에 포함 — 빈 객체만 남겨 옛 패치 merge 호환 */
export const GEAR_INTRO_VARIANTS = {};

export const WARMUP_ACTIVITY_VARIANTS = {
  "shuttle-run": {
    label: "왕복 달리기",
    default: d(
      "Run to the line and back! Go!",
      "Let's do shuttle runs! Run to the cone and come back. Ready, go!",
      "Shuttle run time! Run to the far cone, touch it, and sprint back. Who can go the fastest safely?",
    ),
    alternatives: [
      d("Run run! Back!", "Run to the cone and back! Ready?", "Run to the cone, touch it, and race back — safely!"),
      d("Go go run!", "Shuttle run! To the line and back!", "Shuttle runs! Run there, touch, return. Can you beat your last time?"),
      d("Line run! Fast!", "Run to the line and come back. Go!", "Shuttle run challenge! Run, touch, return. Ready, set, go!"),
    ],
  },
  "circle-run": {
    label: "동그랗게 달리기",
    default: d(
      "Run in a circle! Follow me!",
      "Let's run in a big circle! Follow the leader!",
      "Circle run! Follow me around the circle. Can you run without bumping into anyone?",
    ),
    alternatives: [
      d("Round round run!", "Run around in a circle!", "Run in a circle — keep space between you and your friend!"),
      d("Circle go!", "Big circle run! Follow teacher!", "Circle run! Follow me and watch the person in front of you."),
      d("Run round!", "Run in a circle together!", "Circle run! Stay in line and call out 'excuse me' if you need to pass!"),
    ],
  },
  "dance-warmup": {
    label: "댄스 준비운동",
    default: d(
      "Dance time! Copy me!",
      "Dance warm up! Copy my moves!",
      "Dance warm up! Copy my moves — can you add your own style at the end?",
    ),
    alternatives: [
      d("Dance dance!", "Let's dance and warm up!", "Dance warm up! Mirror me, then freestyle for 8 counts!"),
      d("Move move!", "Copy teacher's dance!", "Dance time! Follow me, then teach your partner one move!"),
      d("Shake shake!", "Shake your body and dance!", "Dance warm up! Copy me — high energy, big smiles!"),
    ],
  },
  stretching: {
    label: "스트레칭",
    default: d(
      "Stretch up! Stretch down!",
      "Let's stretch! Reach up high, then touch your toes.",
      "Stretching time! Reach up high, side to side, then touch your toes. Hold for three seconds each!",
    ),
    alternatives: [
      d("Up down stretch!", "Stretch up and down!", "Reach up, bend down, hold — count to three in English!"),
      d("Big stretch!", "Big stretch together!", "Full body stretch — reach, twist, toe touch. Nice and slow."),
      d("Stretch time!", "Stretch your arms and legs!", "Stretch sequence: arms up, side bend, hamstring — breathe in and out!"),
    ],
  },
  ...EXPANDED_PREPARATION_VARIANTS,
};

export const GAME_VARIANTS = {
  "peanut-butter": {
    label: "Peanut Butter",
    default: d("Peanut butter game!", "Let's play Peanut Butter! Listen to teacher!", "Peanut Butter game! Listen carefully and move only when I say the safe word!"),
    alternatives: [
      d("Peanut butter!", "Peanut Butter time!", "Peanut Butter — freeze when you hear 'jelly'!"),
      d("PB game!", "Peanut Butter game start!", "Peanut Butter game! Who can explain the rule in English?"),
      d("Let's play PB!", "Peanut Butter! Are you ready?", "Peanut Butter! Demonstrate the rule, then we play!"),
    ],
  },
  "green-red-light": {
    label: "Green Light & Red Light",
    default: d("Green light go! Red light stop!", "Green light, red light! Green means go, red means stop!", "Green light, red light! When I say green, run — red, freeze! Can you hold still?"),
    alternatives: [
      d("Go stop game!", "Green light red light game!", "Green/red light — add yellow for slow motion!"),
      d("Run stop!", "Green means run! Red means stop!", "Green light run, red light freeze — who can freeze the fastest?"),
      d("Light game!", "Green light! Red light!", "Traffic light game — green go, red stop, yellow walk slowly!"),
    ],
  },
  bomb: {
    label: "Bomb",
    default: d("Bomb game! Pass fast!", "Bomb game! Pass the ball before it explodes!", "Bomb game! Pass quickly — if you hold too long, you're out! Explain why in English!"),
    alternatives: [
      d("Pass pass!", "Pass the bomb fast!", "Hot potato bomb — pass and say one English word!"),
      d("Bomb pass!", "Bomb game! Pass quickly!", "Bomb game! Pass within 2 seconds or share a vocabulary word!"),
      d("Fast pass!", "Don't hold the bomb!", "Bomb pass — name an animal each time you pass!"),
    ],
  },
  ...EXPANDED_GAME_VARIANTS,
};

export const DEFAULT_SAFETY_MEMOS = {};

export const WARMUP_SETS = EXPANDED_WARMUP_SETS;

export const WARMUP_SET_VARIANTS = {
  ...EXPANDED_WARMUP_SET_VARIANTS,
};

export const WARMUP_ACTIVITIES = EXPANDED_PREPARATION_ACTIVITIES;

export const GAME_ACTIVITIES = EXPANDED_GAME_ACTIVITIES;

export const CLOSING_ACTIVITIES = EXPANDED_CLOSING_ACTIVITIES;

export const CLOSING_VARIANTS = {
  ...EXPANDED_CLOSING_VARIANTS,
};
