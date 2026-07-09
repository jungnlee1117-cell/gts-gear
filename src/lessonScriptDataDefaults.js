/** 수업 대본 만들기 — 번들 기본 데이터 (관리자 오버라이드 전 원본) */

export const LESSON_SCRIPT_LEVELS = [
  { id: "foundation", label: "Foundation" },
  { id: "interactive", label: "Interactive" },
];

const d = (easy, medium, hard) => ({ easy, medium, hard });

export const WARMUP_PART_VARIANTS = {
  entrance: {
    label: "입장",
    default: d(
      "Hi friends! Come in~ Sit by the wall!",
      "Hello everyone! Come on in~! Please sit against the wall!",
      "Hello everyone! Welcome! Come on in quickly and sit against the wall with your legs crossed!",
    ),
    alternatives: [
      d(
        "Come in, friends! Wall sit, please!",
        "Hey everyone! Come on in~! Sit against the wall, please!",
        "Good morning, everyone! Come in quickly and sit against the wall. Ready?",
      ),
      d(
        "Hello! Come in slowly~ Wall, please!",
        "Hi kids! Come on in~! Please sit on the wall side!",
        "Welcome, everyone! Come in and sit against the wall. Criss-cross applesauce!",
      ),
      d(
        "Come in~! Sit here by the wall!",
        "Hello hello! Come on in~! Sit against the wall nicely!",
        "Hello everyone! Come on in~! Sit against the wall and show me quiet bodies!",
      ),
    ],
  },
  greeting: {
    label: "인사/소개",
    default: d(
      "Hello! Stand up. Say hello!",
      "Alrighty! We have to say hello to each other. Everyone stand up. Attention!",
      "Alrighty! Let's greet each other properly. Everyone stand up tall. Attention! Look at your partner and say hello!",
    ),
    alternatives: [
      d(
        "Stand up! Hello, friend!",
        "Everyone stand up! Let's say hello to our friends!",
        "Stand up, everyone! Look around and say hello to someone new today!",
      ),
      d(
        "Up up! Hi! Nice to meet you!",
        "Stand up! Wave and say hello to the person next to you!",
        "Everyone stand up! Make eye contact and introduce yourself in one English sentence!",
      ),
      d(
        "Hello time! Stand up please!",
        "Let's greet! Stand up. Hello, everyone!",
        "Attention! Stand up straight. Greet your neighbor and tell them one thing you like!",
      ),
    ],
  },
  warmup: {
    label: "몸풀기",
    default: d(
      "Warm up! Head, shoulders, knees. Clap clap!",
      "First, let's warm up together! Head, shoulders, knees, and clap, clap, clap!",
      "Let's warm up together! Touch your head, shoulders, knees, and toes — then clap, clap, clap! Can you go faster?",
    ),
    alternatives: [
      d(
        "Head! Shoulders! Knees! Clap!",
        "Warm up time! Head, shoulders, knees — clap clap clap!",
        "Warm up! Head, shoulders, knees, toes — now jump and clap three times!",
      ),
      d(
        "Touch head! Shoulders! Clap!",
        "Let's move! Head, shoulders, knees. Clap with me!",
        "Follow me! Head, shoulders, knees, toes. Clap clap clap — now twice as fast!",
      ),
      d(
        "Up up! Down down! Clap clap!",
        "Body warm up! Head, shoulders, knees, and clap clap clap!",
        "Full body warm up! Head, shoulders, knees, toes, then spin and clap — great job!",
      ),
    ],
  },
  seating: {
    label: "착석",
    default: d(
      "Sit down please. Nice sit!",
      "Ok~! Please have a seat everyone. Sit nicely!!",
      "Great job! Please have a seat everyone. Sit nicely with your hands on your knees!",
    ),
    alternatives: [
      d(
        "Sit down~ Good job!",
        "Have a seat, everyone. Sit nicely!",
        "Excellent! Take your seats. Sit nicely and show me listening bodies!",
      ),
      d(
        "Sit please! Well done!",
        "Ok! Sit down everyone. Nice sitting!",
        "Wonderful! Please sit down. Criss-cross and eyes on me!",
      ),
      d(
        "Seat time! Sit nicely!",
        "Please sit~! Everyone sit nicely!",
        "Time to sit! Sit nicely, hands quiet, and eyes up here!",
      ),
    ],
  },
};

export const GEAR_INTRO_VARIANTS = {
  label: "교구 소개",
  default: d(
    "Look! I brought something cool today!",
    "Alright. Today, I brought this cool looking thing...",
    "Alright everyone! Today I brought something really cool. Look closely — what do you think it is? Can you guess in English?",
  ),
  alternatives: [
    d(
      "Wow! What's this?",
      "Look look! What is this today?",
      "Check this out! What do you think I brought today? Describe it in one English word!",
    ),
    d(
      "Ta-da! Something new!",
      "Ta-da~! I have something special today!",
      "Ta-da! I brought something special. Look carefully — what shape is it? What color?",
    ),
    d(
      "Guess! What did teacher bring?",
      "Can you guess? What did teacher bring today?",
      "Before I show you — guess what I brought! Who can ask me a question in English?",
    ),
  ],
};

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
};

export const DEFAULT_SAFETY_MEMOS = {
  beforeWarmup: {
    label: "준비운동 전 안전 멘트",
    default: d(
      "Be careful! No pushing!",
      "Before we move, remember — no pushing, no running into friends. Be safe!",
      "Safety first! No pushing, watch your space, and if you need help raise your hand. Ready to move safely?",
    ),
    alternatives: [
      d("Safe safe!", "Be safe! Walk, don't push!", "Safety check: space bubbles on — no pushing, eyes up!"),
      d("Careful!", "Careful bodies! No bumping!", "Before we start: look around, keep arm's length, move safely!"),
      d("Slowly please!", "Move slowly and safely!", "Safety rules: walk when needed, hands to yourself, tell teacher if hurt!"),
    ],
  },
  beforeGear: {
    label: "교구 수업 전 안전 멘트",
    default: d(
      "Be careful with the gear!",
      "Before we use the gear — wait for teacher, listen, and use it safely.",
      "Gear safety! Wait for my signal, use two hands, and tell me immediately if something feels unsafe.",
    ),
    alternatives: [
      d("Wait please!", "Wait for teacher before touching!", "Gear rule: teacher demo first, then your turn — one at a time if needed!"),
      d("Safe with gear!", "Use the gear safely!", "Before we start: how do we use this safely? Who can tell me one rule?"),
      d("Listen first!", "Listen, then use the gear!", "Safety moment — eyes on me, hands waiting, then we use the gear together!"),
    ],
  },
  beforeGame: {
    label: "게임 활동 전 안전 멘트",
    default: d(
      "Play safe! Have fun!",
      "Game time — play safely, cheer for friends, and follow the rules!",
      "Before the game: play fair, keep hands safe, and congratulate others. Any questions about the rules?",
    ),
    alternatives: [
      d("Fun and safe!", "Have fun but play safe!", "Game safety: fair play, no rough contact, stop when teacher says stop!"),
      d("Rules first!", "Remember the game rules!", "Quick rule review — who can repeat the safety rule in English?"),
      d("Safe play!", "Safe play everyone!", "Game time safety: watch your space, encourage teammates, play fair!"),
    ],
  },
};

export const WARMUP_SETS = [
  {
    id: "default-greeting-warmup",
    label: "기본 인사 & 워밍업 세트",
    desc: "입장 → 인사/소개 → 몸풀기 → 착석",
    partIds: ["entrance", "greeting", "warmup", "seating"],
  },
];

export const WARMUP_ACTIVITIES = [
  { id: "shuttle-run", label: "왕복 달리기" },
  { id: "circle-run", label: "동그랗게 달리기" },
  { id: "dance-warmup", label: "댄스 준비운동" },
  { id: "stretching", label: "스트레칭" },
];

export const GEAR_INTRO_SCRIPT = {
  id: "default-gear-intro",
  label: "교구 소개",
};

export const GAME_ACTIVITIES = [
  { id: "peanut-butter", label: "Peanut Butter" },
  { id: "bomb", label: "Bomb" },
  { id: "body-part-cones", label: "Body Part with Cones" },
  { id: "jungle-game", label: "Jungle Game (Snake, Eagle)" },
  { id: "frogs-insects", label: "Frogs & Insects (Bugs)" },
  { id: "catching-fly", label: "Catching Fly Game" },
  { id: "green-red-light", label: "Green Light & Red Light" },
  { id: "chickens-hunters", label: "Chickens & Hunters" },
  { id: "rock-paper-scissors", label: "Rock, Paper, Scissors" },
  { id: "cheese-ball-monster", label: "Cheese Ball Monster Game" },
  { id: "fishing-game", label: "Fishing Game" },
  { id: "roleplay-teacher", label: "Role-play Teacher Game" },
  { id: "hopping-monster", label: "Hopping Monster Game" },
  { id: "bear-monster", label: "Bear Monster Game" },
  { id: "butterfly", label: "Butterfly Game" },
  { id: "caterpillar", label: "Caterpillar Where Are You?" },
];
