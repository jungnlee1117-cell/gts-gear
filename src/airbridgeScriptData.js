// GTS 에어브릿지 영어 수업 대본
// Foundation / Interactive 2단계 레벨 시스템

export const GEAR_LABEL = "에어브릿지";

export const LEVELS = [
  {
    id: "foundation",
    label: "Foundation English",
    desc: "영어 처음 접하는 아이들 — 한국어 50% + 핵심 단어만 영어",
    color: "#059669",
    bg: "#E1F5EE",
  },
  {
    id: "interactive",
    label: "Interactive English",
    desc: "영어 조금 아는 아이들 — 영어 위주 + 단어→짧은 문장 유도",
    color: "#d97706",
    bg: "#FAEEDA",
  },
];

export const STAGES = [
  { tag: "intro", label: "교구소개" },
  { tag: "level1", label: "Foundation" },
  { tag: "level2", label: "Interactive" },
  { tag: "closing", label: "마무리" },
];

export const AIRBRIDGE_SCRIPTS = {
  foundation: [
  {
    "stage": "intro",
    "tagLabel": "교구 소개",
    "tagColor": "default",
    "time": "2~3분",
    "note": "한국어로 시작 → 핵심 단어만 영어로",
    "script": [
      {
        "who": "teacher",
        "text": "자, 여기 봐요! 선생님이 오늘 엄청난 걸 가져왔어요!",
        "action": "교구를 등 뒤에 숨기고 과장된 표정으로"
      },
      {
        "who": "kids",
        "text": "(웅성웅성) 뭐예요?! 뭐예요?!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "짜잔~!! Wow wow wow!!",
        "action": "교구를 꺼내며 크게 놀란 표정",
        "en": true
      },
      {
        "who": "kids",
        "text": "와~!! 뭐야~!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "이게 뭐처럼 보여요? 혹시... 선생님 침대?",
        "action": "드러눕는 척"
      },
      {
        "who": "kids",
        "text": "아니야!! 아니야!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "아니야? 그럼... 선생님 샌드위치?",
        "action": "먹는 척"
      },
      {
        "who": "kids",
        "text": "아니야!! 다리야!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "오!! A BRIDGE!! 다리!! 맞아요!!",
        "action": "벌떡 일어나며 하이파이브",
        "en": true
      },
      {
        "who": "teacher",
        "text": "다같이 따라해봐요 — BRIDGE!!",
        "action": "손을 귀에 대고",
        "en": true
      },
      {
        "who": "kids",
        "text": "BRIDGE!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "한 번 더!! BRIDGE!!",
        "action": "더 크게 유도",
        "en": true
      },
      {
        "who": "teacher",
        "text": "이 다리를 타고 올라갈 수 있어요! CLIMB UP!! 해봐요~",
        "action": "올라가는 동작",
        "en": true
      },
      {
        "who": "kids",
        "text": "CLIMB UP!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Amazing!! 너무 잘했어요!!",
        "action": "하이파이브",
        "en": true
      }
    ],
    "tip": "Bridge, Climb 두 단어만 확실히 심으면 됨. 나머지는 분위기. 아이들이 웃고 반응하면 성공"
  },
  {
    "stage": "intro",
    "tagLabel": "안전 규칙",
    "tagColor": "amber",
    "time": "1분",
    "note": "질문은 영어, 대답은 아이들이 자연스럽게",
    "script": [
      {
        "who": "teacher",
        "text": "자! 놀기 전에 규칙 먼저! 다리 위에서 뛰어도 돼요?",
        "action": "뛰는 척하며"
      },
      {
        "who": "kids",
        "text": "안 돼요!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "영어로? Can I RUN?",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "NO!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "친구 밀어도 돼요? Can I PUSH?",
        "action": "미는 척",
        "en": true
      },
      {
        "who": "kids",
        "text": "NO!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Good!! 우리는 걸어요~ WALK!! 따라해요~",
        "action": "천천히 걷는 동작",
        "en": true
      },
      {
        "who": "kids",
        "text": "WALK!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "준비됐어요? Are you ready??",
        "action": "손 귀에 대고",
        "en": true
      },
      {
        "who": "kids",
        "text": "YES I'M READY!!",
        "action": ""
      }
    ],
    "tip": "'Can I ~?' 패턴으로 규칙 물어보기. 아이들이 NO!! 외치면서 규칙을 자연스럽게 기억함"
  },
  {
    "stage": "level1",
    "tagLabel": "Foundation",
    "tagColor": "default",
    "time": "5~7분",
    "note": "활동 중 응원은 영어, 지시는 한국어",
    "script": [
      {
        "who": "teacher",
        "text": "자! 이름 부르면 여기 줄 서요~ 지후! 미나! 에이든! 이쪽으로~",
        "action": "한명씩 이름 부르며"
      },
      {
        "who": "teacher",
        "text": "친구랑 간격 유지해요~ Space! Space~",
        "action": "손으로 간격 만드는 동작",
        "en": true
      },
      {
        "who": "teacher",
        "text": "준비? 3!! 2!! 1!! GO!!",
        "action": "카운트다운",
        "en": true
      },
      {
        "who": "teacher",
        "text": "CLIMB UP!! 잘한다!! Keep going!! Keep going!!",
        "action": "올라가는 아이 응원",
        "en": true
      },
      {
        "who": "teacher",
        "text": "AMAZING!! 했어요!! 너무 잘했어!! Next friend — GO!!",
        "action": "내려온 아이 하이파이브 → 다음 아이 출발",
        "en": true
      },
      {
        "who": "teacher",
        "text": "한 번 더 해볼까요? 더 잘할 수 있어요? Are you ready??",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "YES I'M READY!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "FREEZE!! 다들 너무 잘했어요!! 앉아요~",
        "action": "휘슬 + 손 번쩍",
        "en": true
      }
    ],
    "tip": "이름 최대한 많이 불러주기. 응원은 영어로 자연스럽게 섞기. AMAZING, GOOD JOB은 반복해도 됨"
  },
  {
    "stage": "level1",
    "tagLabel": "전환 Foundation→Interactive",
    "tagColor": "amber",
    "time": "30초",
    "note": "",
    "script": [
      {
        "who": "teacher",
        "text": "이번엔 다리를 뒤집을 거예요! 보세요~",
        "action": "에어브릿지 뒤집기"
      },
      {
        "who": "teacher",
        "text": "거꾸로! UPSIDE DOWN!! 다같이~",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "UPSIDE DOWN!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "이제 뭐처럼 보여요?",
        "action": ""
      },
      {
        "who": "kids",
        "text": "배요!! 보트!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "맞아요~ A BOAT!! 배예요!!",
        "action": "배 타는 흉내",
        "en": true
      }
    ],
    "tip": "전환 전 반드시 앉히기. 서있으면 집중 안 됨"
  },
  {
    "stage": "level2",
    "tagLabel": "Interactive",
    "tagColor": "default",
    "time": "5~7분",
    "note": "흔들림 표현은 영어로 재미있게",
    "script": [
      {
        "who": "teacher",
        "text": "이 배는 흔들려요~ WOBBLY WOBBLY!! 균형 잡아야 해요!",
        "action": "흔들리는 동작 과장되게",
        "en": true
      },
      {
        "who": "teacher",
        "text": "팔을 이렇게 펼쳐요~ Like an airplane~!",
        "action": "비행기 자세 보여주기",
        "en": true
      },
      {
        "who": "teacher",
        "text": "BALANCE!! 다같이~",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "BALANCE!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "3!! 2!! 1!! GO!! Balance, balance~!!",
        "action": "",
        "en": true
      },
      {
        "who": "teacher",
        "text": "팔 올리고~! Keep your arms UP!! 잘한다!!",
        "action": "올라간 아이에게",
        "en": true
      },
      {
        "who": "teacher",
        "text": "AMAZING BALANCE!! 대단해요!!",
        "action": "엄지 척 + 함박웃음",
        "en": true
      },
      {
        "who": "teacher",
        "text": "FREEZE!! 앉아요~ 다음 레벨 갈 준비됐어요?",
        "action": "",
        "en": true
      }
    ],
    "tip": "Level 2는 빠르기가 아니라 균형. '천천히~'를 계속 말해주기"
  },
  {
    "stage": "closing",
    "tagLabel": "마무리",
    "tagColor": "green",
    "time": "3~5분",
    "note": "마무리는 따뜻하게, 오늘 배운 영어 단어 복습으로 끝",
    "script": [
      {
        "who": "teacher",
        "text": "OH MY GOODNESS!! 포기할게요!! 못 자겠어요!!",
        "action": "벌떡 일어나며",
        "en": true
      },
      {
        "who": "teacher",
        "text": "여러분이 깨웠어요!! 너무 잘했어요!! You're amazing!!",
        "action": "하이파이브",
        "en": true
      },
      {
        "who": "teacher",
        "text": "자! 정리 시간~ 공을 가방에 넣어요! Clean up!!",
        "action": "공 가방 들고 보여주기",
        "en": true
      },
      {
        "who": "teacher",
        "text": "누가 공을 제일 많이 담을까요? GO!!",
        "action": "경쟁 요소로 재미있게",
        "en": true
      },
      {
        "who": "kids",
        "text": "(신나게 공 줍기)",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "오늘 재미있었어요? Did you have fun??",
        "action": "손 귀에 대고",
        "en": true
      },
      {
        "who": "kids",
        "text": "YES!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "오늘 배운 말 같이 해봐요~ BRIDGE!! CLIMB!! BALANCE!! THROW!!",
        "action": "손가락으로 하나씩 세며",
        "en": true
      },
      {
        "who": "kids",
        "text": "BRIDGE!! CLIMB!! BALANCE!! THROW!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "완벽해요!! 다음에 또 만나요~ Bye bye!!",
        "action": "문 앞에서 한명씩 보내기",
        "en": true
      }
    ],
    "tip": "마무리에 오늘 배운 영어 단어 4개 복습 꼭 넣기. 4개만 기억해도 성공"
  }
],
  interactive: [
  {
    "stage": "intro",
    "tagLabel": "교구 소개",
    "tagColor": "default",
    "time": "3분",
    "note": "단어 → 짧은 문장으로 확장하는 게 핵심",
    "script": [
      {
        "who": "teacher",
        "text": "Wow! Everyone look at this! What do you see?",
        "action": "교구 꺼내며 아이들 반응 기다리기",
        "en": true
      },
      {
        "who": "kids",
        "text": "다리! Bridge!",
        "action": "단어로 대답"
      },
      {
        "who": "teacher",
        "text": "Yes! It's a bridge! Can everyone say — bridge?",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "Bridge!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Good! Hmm... is this a giant bed? Can I sleep here?",
        "action": "드러눕는 척",
        "en": true
      },
      {
        "who": "kids",
        "text": "No!! It's a bridge!!",
        "action": "웃으며 외치기"
      },
      {
        "who": "teacher",
        "text": "Oh right! A bridge! We can CLIMB UP! Everyone say — climb up!",
        "action": "올라가는 동작",
        "en": true
      },
      {
        "who": "kids",
        "text": "Climb up!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Can you climb up the bridge? Tell me — yes I can or no I can't!",
        "action": "문장으로 대답 유도",
        "en": true
      },
      {
        "who": "kids",
        "text": "Yes I can!!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Let's find out!! Are you ready?",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "Yes I'm ready!!",
        "action": ""
      }
    ],
    "tip": "단어 대답 나오면 '문장으로 해봐요' 한번 더 유도. Bridge! → It's a bridge! → I can climb! 순서로"
  },
  {
    "stage": "intro",
    "tagLabel": "안전 규칙",
    "tagColor": "amber",
    "time": "1분",
    "note": "단어 대답 → 문장으로 확장",
    "script": [
      {
        "who": "teacher",
        "text": "Before we start — rules! Can I run on the bridge?",
        "action": "뛰는 동작하며",
        "en": true
      },
      {
        "who": "kids",
        "text": "No!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Right! We cannot run. Say — we cannot run!",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "We cannot run!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Can I push my friend?",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "No!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "We must keep the rules! Say — we must keep the rules!",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "We must keep the rules!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Are you ready? Yes I'm ready!!",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "Yes I'm ready!!",
        "action": ""
      }
    ],
    "tip": "No! → We cannot run! 으로 확장. 짧은 문장 패턴 반복이 핵심"
  },
  {
    "stage": "level1",
    "tagLabel": "Foundation",
    "tagColor": "default",
    "time": "5~7분",
    "note": "활동 중 질문하고 문장으로 대답하게 유도",
    "script": [
      {
        "who": "teacher",
        "text": "Okay! If I call your name — line up here!",
        "action": "이름 한명씩 부르기",
        "en": true
      },
      {
        "who": "teacher",
        "text": "Leave some space between you and your friend!",
        "action": "간격 손동작",
        "en": true
      },
      {
        "who": "teacher",
        "text": "Ready? 3, 2, 1 — GO!",
        "action": "",
        "en": true
      },
      {
        "who": "teacher",
        "text": "Climb up! Good! Keep going! Almost there!",
        "action": "이름 부르며 응원",
        "en": true
      },
      {
        "who": "teacher",
        "text": "How do you feel? Is it easy or hard?",
        "action": "내려온 아이에게 질문",
        "en": true
      },
      {
        "who": "kids",
        "text": "Easy! / Hard! / It's fun!",
        "action": "단어나 짧은 문장으로"
      },
      {
        "who": "teacher",
        "text": "Tell me in a sentence — it is easy or it is hard!",
        "action": "문장으로 확장 유도",
        "en": true
      },
      {
        "who": "kids",
        "text": "It is easy! / It is hard!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Amazing!! One more time! Can you do better?",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "Yes I can!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Freeze! Great job! Sit down please!",
        "action": "휘슬 + 손 들기",
        "en": true
      }
    ],
    "tip": "활동 중 질문하고 문장으로 대답하게 유도. 단어 대답 나오면 '문장으로 해봐요' 한번 더"
  },
  {
    "stage": "level1",
    "tagLabel": "전환 Foundation→Interactive",
    "tagColor": "amber",
    "time": "30초",
    "note": "새 표현 하나씩 심기",
    "script": [
      {
        "who": "teacher",
        "text": "This time — we flip the bridge! Everyone say — upside down!",
        "action": "뒤집으며",
        "en": true
      },
      {
        "who": "kids",
        "text": "Upside down!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "What does it look like now? Tell me!",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "A boat! It looks like a boat!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Yes!! Say — it looks like a boat!",
        "action": "",
        "en": true
      },
      {
        "who": "kids",
        "text": "It looks like a boat!",
        "action": ""
      }
    ],
    "tip": "전환마다 새로운 문장 패턴 하나씩 심기. 이 섹션: 'It looks like a ___'"
  },
  {
    "stage": "level2",
    "tagLabel": "Interactive",
    "tagColor": "default",
    "time": "5~7분",
    "note": "비교 문장 유도. harder than 패턴",
    "script": [
      {
        "who": "teacher",
        "text": "This boat moves! It goes back and forth! Say — back and forth!",
        "action": "몸으로 앞뒤 흔들기",
        "en": true
      },
      {
        "who": "kids",
        "text": "Back and forth!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Be careful! Keep your balance! Arms up like this!",
        "action": "팔 벌리는 자세",
        "en": true
      },
      {
        "who": "teacher",
        "text": "3, 2, 1 — GO! Balance balance balance!",
        "action": "",
        "en": true
      },
      {
        "who": "teacher",
        "text": "How does it feel? Is it the same as Level 1?",
        "action": "내려온 아이에게",
        "en": true
      },
      {
        "who": "kids",
        "text": "No! It's different! It moves!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Tell me — Level 2 is harder than Level 1! Say it!",
        "action": "비교 문장 유도",
        "en": true
      },
      {
        "who": "kids",
        "text": "Level 2 is harder than Level 1!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Yes!! Because it moves! Great balance everyone!!",
        "action": "",
        "en": true
      },
      {
        "who": "teacher",
        "text": "Freeze! Sit down! Interactive is coming!",
        "action": "기대감 심기",
        "en": true
      }
    ],
    "tip": "'harder than', 'different from' 비교 표현 자연스럽게 심어주기"
  },
  {
    "stage": "closing",
    "tagLabel": "마무리",
    "tagColor": "green",
    "time": "3~5분",
    "note": "오늘 배운 표현 복습으로 끝",
    "script": [
      {
        "who": "teacher",
        "text": "Oh my goodness!! I give up!! I am awake now!!",
        "action": "벌떡 일어나며",
        "en": true
      },
      {
        "who": "teacher",
        "text": "Amazing job everyone!! Clean up time! Everyone help!",
        "action": "",
        "en": true
      },
      {
        "who": "teacher",
        "text": "Did you have fun today? Tell me — I had fun because...",
        "action": "문장 완성 유도",
        "en": true
      },
      {
        "who": "kids",
        "text": "I had fun because I threw the balls! / Because I climbed!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Today we learned — climb up, climb down, balance, throw! Say them all!",
        "action": "오늘 배운 단어 복습",
        "en": true
      },
      {
        "who": "kids",
        "text": "Climb up! Climb down! Balance! Throw!",
        "action": ""
      },
      {
        "who": "teacher",
        "text": "Perfect!! See you next time! Line up please — walk!",
        "action": "문 앞에서 한명씩 보내기",
        "en": true
      }
    ],
    "tip": "마무리에 오늘 배운 단어 복습 꼭 넣기. because 문장 한번 더"
  }
],
};

export const scripts = [
  ...AIRBRIDGE_SCRIPTS.foundation,
  ...AIRBRIDGE_SCRIPTS.interactive,
];
