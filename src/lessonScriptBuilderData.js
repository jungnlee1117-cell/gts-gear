/** 수업 대본 만들기 — 모듈 데이터 (추가 세트/항목은 여기에 등록) */

export const LESSON_SCRIPT_LEVELS = [
  { id: "foundation", label: "Foundation" },
  { id: "interactive", label: "Interactive" },
];

export const WARMUP_SETS = [
  {
    id: "default-greeting-warmup",
    label: "기본 인사 & 워밍업 세트",
    desc: "입장 → 인사/소개 → 몸풀기 → 착석",
    parts: [
      {
        id: "entrance",
        label: "입장",
        text: "Hello everyone! Come on in~! Please sit against the wall!",
      },
      {
        id: "greeting",
        label: "인사/소개",
        text: "Alrighty! We have to say hello to each other. Everyone stand up. Attention!",
      },
      {
        id: "warmup",
        label: "몸풀기",
        text: "First, let's warm up together! Head, shoulders, knees, and clap, clap, clap!",
      },
      {
        id: "seating",
        label: "착석",
        text: "Ok~! Please have a seat everyone. Sit nicely!!",
      },
    ],
  },
];

export const WARMUP_ACTIVITIES = [
  {
    id: "shuttle-run",
    label: "왕복 달리기",
    text: null,
    placeholder: "왕복 달리기 준비운동 대본을 곧 추가할 예정입니다.",
  },
  {
    id: "circle-run",
    label: "동그랗게 달리기",
    text: null,
    placeholder: "동그랗게 달리기 준비운동 대본을 곧 추가할 예정입니다.",
  },
  {
    id: "dance-warmup",
    label: "댄스 준비운동",
    text: null,
    placeholder: "댄스 준비운동 대본을 곧 추가할 예정입니다.",
  },
  {
    id: "stretching",
    label: "스트레칭",
    text: null,
    placeholder: "스트레칭 준비운동 대본을 곧 추가할 예정입니다.",
  },
];

export const GEAR_INTRO_SCRIPT = {
  id: "default-gear-intro",
  label: "교구 소개",
  text: "Alright. Today, I brought this cool looking thing...",
};

export const GAME_ACTIVITIES = [
  { id: "peanut-butter", label: "Peanut Butter", text: null, placeholder: "Peanut Butter 게임 대본을 곧 추가할 예정입니다." },
  { id: "bomb", label: "Bomb", text: null, placeholder: "Bomb 게임 대본을 곧 추가할 예정입니다." },
  { id: "body-part-cones", label: "Body Part with Cones", text: null, placeholder: "Body Part with Cones 게임 대본을 곧 추가할 예정입니다." },
  { id: "jungle-game", label: "Jungle Game (Snake, Eagle)", text: null, placeholder: "Jungle Game 대본을 곧 추가할 예정입니다." },
  { id: "frogs-insects", label: "Frogs & Insects (Bugs)", text: null, placeholder: "Frogs & Insects 게임 대본을 곧 추가할 예정입니다." },
  { id: "catching-fly", label: "Catching Fly Game", text: null, placeholder: "Catching Fly Game 대본을 곧 추가할 예정입니다." },
  { id: "green-red-light", label: "Green Light & Red Light", text: null, placeholder: "Green Light & Red Light 게임 대본을 곧 추가할 예정입니다." },
  { id: "chickens-hunters", label: "Chickens & Hunters", text: null, placeholder: "Chickens & Hunters 게임 대본을 곧 추가할 예정입니다." },
  { id: "rock-paper-scissors", label: "Rock, Paper, Scissors", text: null, placeholder: "Rock, Paper, Scissors 게임 대본을 곧 추가할 예정입니다." },
  { id: "cheese-ball-monster", label: "Cheese Ball Monster Game", text: null, placeholder: "Cheese Ball Monster Game 대본을 곧 추가할 예정입니다." },
  { id: "fishing-game", label: "Fishing Game", text: null, placeholder: "Fishing Game 대본을 곧 추가할 예정입니다." },
  { id: "roleplay-teacher", label: "Role-play Teacher Game", text: null, placeholder: "Role-play Teacher Game 대본을 곧 추가할 예정입니다." },
  { id: "hopping-monster", label: "Hopping Monster Game", text: null, placeholder: "Hopping Monster Game 대본을 곧 추가할 예정입니다." },
  { id: "bear-monster", label: "Bear Monster Game", text: null, placeholder: "Bear Monster Game 대본을 곧 추가할 예정입니다." },
  { id: "butterfly", label: "Butterfly Game", text: null, placeholder: "Butterfly Game 대본을 곧 추가할 예정입니다." },
  { id: "caterpillar", label: "Caterpillar Where Are You?", text: null, placeholder: "Caterpillar Where Are You? 게임 대본을 곧 추가할 예정입니다." },
];

export function findWarmupSet(id) {
  return WARMUP_SETS.find(s => s.id === id) ?? null;
}

export function findWarmupActivity(id) {
  return WARMUP_ACTIVITIES.find(a => a.id === id) ?? null;
}

export function findGame(id) {
  return GAME_ACTIVITIES.find(g => g.id === id) ?? null;
}
