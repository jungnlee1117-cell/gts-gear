// GTS 에어 둥글 클라이밍 매트 대본 (v3 최종)
// 예습 모드: 풀 대화체 (현장 호흡 그대로, 화자 구분 + TTS 적용)
// 현장 카드 모드: cardLines로 핵심 문장만 압축 — 수업 중 흘끗 보는 용도
// 5가지 활동

export const AIR_CLIMBING_MAT_ACTIVITIES = [

    // ─────────────────────────────────
    // 1. 기어 올라가기
    // ─────────────────────────────────
    {
      id: "crawl-up",
      num: 1,
      title: "기어 올라가기",
      titleEn: "Crawl Up!",
      time: "3~4분",
  
      // 예습 모드용 — 풀 대화체
      script: [
        {
          who: "teacher",
          action: "매트를 가리키며 아이들에게 질문",
          lines: {
            foundation: "자, 이게 뭘까요? 음... 이걸로 뭘 할 수 있을까요?",
            interactive: "What is this? Hmm... what do you think we can do with it?",
          },
        },
        {
          who: "kids",
          action: "추측하며 대답",
          lines: { foundation: "올라갈 수 있어요!! 산 같아요!!", interactive: "We can climb it! It looks like a mountain!" },
        },
        {
          who: "teacher",
          action: "동의하며 위험 요소 자연스럽게 안내",
          lines: {
            foundation: "어? 올라갈 수 있겠네!! 근데 올라갈 때는 조심해야 해요. 떨어질 수 있으니까 우리 기어서 가볼 거예요.",
            interactive: "Oh, you can climb it! But be careful going up — you might fall. So we're going to crawl.",
          },
        },
        {
          who: "teacher",
          action: "내려오는 방법까지 미리 설명",
          lines: {
            foundation: "그리고 내려올 때는 다리부터 내려와야 해요. 머리부터 내려오면 안 돼요!",
            interactive: "And when you come down, feet first — not head first!",
          },
        },
        {
          who: "teacher",
          action: "디테일하게 한 명을 뽑는 과정. 자세 묘사로 자연스럽게 집중 유도",
          lines: {
            foundation: "자, 누구부터 해볼까? 허리 펴고, 손은 무릎에 올리고, 눈 크게 뜨고 있는... 진이! 나오세요.",
            interactive: "Who wants to go first? Straight back, hands on knees, eyes wide open... Jin! Come on out.",
          },
        },
        {
          who: "teacher",
          action: "출발 전 확인 질문 — 영어 구호로",
          lines: {
            foundation: "진이가 준비됐나요? 할 수 있나요? Are you ready? (Yes I'm ready) Can you do it? (I can do it) 오케이, 출발!",
            interactive: "Are you ready, Jin? Can you do it? (Yes I'm ready / I can do it) Okay, go!",
          },
        },
        {
          who: "kids",
          action: "기어 올라가는 시도",
          lines: { foundation: "(기어 올라가며) 으아 힘들어요!", interactive: "This is hard!" },
        },
        {
          who: "teacher",
          action: "성공 후 다같이 박수 유도 + 다음 사람 모집",
          lines: {
            foundation: "진이가 너무 잘 해줬어요! 다같이 박수!! 좋아, 또 누가 하고 싶어요? 다같이 라인업! 한 명씩 출발할 거예요!",
            interactive: "Jin did so great! Everyone clap!! Who wants to go next? Everyone line up — one at a time!",
          },
        },
        {
          who: "teacher",
          action: "반복 루틴 안내",
          lines: {
            foundation: "내려온 다음에 다시 뒤에 라인업하면 또 할 수 있어요.",
            interactive: "After you come down, line up again at the back and you can go again!",
          },
        },
      ],
  
      // 현장 카드 모드용 — 진짜 필요한 핵심 문장만
      cardLines: {
        foundation: ["조심! 기어서 가요", "다리부터 내려와요", "Are you ready? Can you do it?", "박수!! 다음 줄 서요"],
        interactive: ["Be careful — crawl up", "Feet first coming down", "Are you ready? Can you do it?", "Everyone clap! Line up!"],
      },
  
      tip: "한 명을 뽑을 때 '허리 펴고 손 무릎에 눈 크게 뜨고 있는 사람'처럼 자세를 설명하면, 아이들이 자연스럽게 그 자세를 따라 하게 되고 전체 집중도가 올라감. 매번 다른 디테일로 뽑으면 계속 신선하게 유지됨",
    },
  
    // ─────────────────────────────────
    // 2. 터널 통과하기
    // ─────────────────────────────────
    {
      id: "tunnel-through",
      num: 2,
      title: "터널 통과하기",
      titleEn: "Go Through!",
      time: "3~4분",
  
      script: [
        {
          who: "teacher",
          action: "아이들 자리에 앉히고 새로운 질문",
          lines: {
            foundation: "자, 이제는 자리에 앉아. 이번엔 뭘 할 수 있을까?",
            interactive: "Okay, now sit down. What do you think we can do this time?",
          },
        },
        {
          who: "kids",
          action: "매트 아래 공간 보며 추측",
          lines: { foundation: "(생각하며) 음... 모르겠어요!", interactive: "Hmm... I'm not sure!" },
        },
        {
          who: "teacher",
          action: "터널 컨셉 소개. 가벼운 스토리텔링",
          lines: {
            foundation: "어? 이번에는 터널이 될 수 있어요! 옛날 아주 먼 옛날, 보물들은 동굴 안에 있었대요. 우리는 보물을 찾으러 터널로 들어가볼 거예요.",
            interactive: "Oh, this can become a tunnel! A long long time ago, treasures were hidden in caves. We're going inside to find them!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호로 준비 확인",
          lines: {
            foundation: "Are you ready? (Yes I'm ready) Can you do it? (I can do it) 오케이!",
            interactive: "Are you ready? (Yes I'm ready) Can you do it? (I can do it) Okay!",
          },
        },
        {
          who: "teacher",
          action: "잠시 고민하며 자세 보고 한 명 뽑기",
          lines: {
            foundation: "이번에는... 으흠, 보자, 누구를 할까... 이번에는 눈을 제일 크게 뜬 우영이 나오세요!",
            interactive: "This time... hmm, let me see who... The one with the widest open eyes — Woo-young, come on out!",
          },
        },
        {
          who: "kids",
          action: "터널 안으로 기어 들어가기",
          lines: { foundation: "(기어가며) 어두워요~! 보물 찾으러 간다!!", interactive: "It's dark! Going to find treasure!" },
        },
        {
          who: "teacher",
          action: "통과하는 동안 응원하며 보물 찾는 연출",
          lines: {
            foundation: "보물 찾았어요?? 거의 다 왔어요!! 빛이 보인다!!",
            interactive: "Did you find the treasure?? Almost there! I see the light!",
          },
        },
        {
          who: "teacher",
          action: "성공 박수 + 다음 사람",
          lines: {
            foundation: "우영이 보물 찾기 성공!! 다같이 박수!! 다음 탐험가는 누구?",
            interactive: "Woo-young found the treasure! Everyone clap! Who's our next explorer?",
          },
        },
      ],
  
      cardLines: {
        foundation: ["보물찾기! 터널 통과", "Are you ready? Can you do it?", "거의 다 왔어요! 빛이 보인다!", "박수!! 다음 탐험가는?"],
        interactive: ["Treasure hunt! Through the tunnel", "Are you ready? Can you do it?", "Almost there! I see the light!", "Everyone clap! Next explorer?"],
      },
  
      tip: "스토리는 한두 문장으로 짧게. 길게 설명하면 오히려 흐름이 끊김",
    },
  
    // ─────────────────────────────────
    // 3. 미끄럼틀 타며 내려오기
    // ─────────────────────────────────
    {
      id: "slide-down",
      num: 3,
      title: "미끄럼틀 타며 내려오기",
      titleEn: "Slide Down!",
      time: "3~4분",
  
      script: [
        {
          who: "teacher",
          action: "산 정상에서 반대편 보여주며 질문",
          lines: {
            foundation: "자, 우리 산 정상에 올라왔으니까... 이번엔 내려갈 때 뭘 할 수 있을까?",
            interactive: "We're at the top of our mountain... what can we do to get down this time?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "미끄러져요!! 미끄럼틀처럼!!", interactive: "We can slide! Like a slide!" },
        },
        {
          who: "teacher",
          action: "동의하며 자세 설명",
          lines: {
            foundation: "맞아요!! 미끄럼틀처럼 쭉 내려갈 거예요. 앉아서, 손은 옆에 짚고~",
            interactive: "That's right! We're going to slide down like a slide. Sit down, hands by your sides.",
          },
        },
        {
          who: "teacher",
          action: "위험 요소 짧게 안내",
          lines: {
            foundation: "근데 한 명씩 해야 해요. 친구가 다 내려간 다음에 출발해요.",
            interactive: "But one at a time. Wait until your friend is all the way down.",
          },
        },
        {
          who: "teacher",
          action: "디테일하게 뽑기",
          lines: {
            foundation: "이번엔... 가장 신나게 손 흔든 사람! 서윤이 나오세요!",
            interactive: "This time... whoever waved their hand the most excitedly! Seo-yoon, come on out!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인 후 출발",
          lines: {
            foundation: "Are you ready? (Yes I'm ready) 자, 출발!!",
            interactive: "Are you ready? (Yes I'm ready) Okay, go!",
          },
        },
        {
          who: "kids",
          action: "신나게 미끄러져 내려가기",
          lines: { foundation: "(미끄러지며) 와아아아!!", interactive: "Wheee!!" },
        },
        {
          who: "teacher",
          action: "환호하며 다음 사람",
          lines: {
            foundation: "신난다!! 다같이 박수!! 다음 사람은 누구?",
            interactive: "So much fun! Everyone clap! Who's next?",
          },
        },
      ],
  
      cardLines: {
        foundation: ["한 명씩! 앉아서 미끄러져요", "Are you ready?", "와아아!! 신난다!", "다음 사람은?"],
        interactive: ["One at a time — sit and slide", "Are you ready?", "Wheee! So much fun!", "Who's next?"],
      },
  
      tip: "아이들이 제일 좋아하는 활동. 줄 서서 기다리는 동안 다른 친구 응원하는 것도 자연스럽게 유도하면 분위기가 더 좋아짐",
    },
  
    // ─────────────────────────────────
    // 4. 걸어 올라가기
    // ─────────────────────────────────
    {
      id: "walk-up",
      num: 4,
      title: "걸어 올라가기",
      titleEn: "Walk Up!",
      time: "3~4분",
  
      script: [
        {
          who: "teacher",
          action: "이전 활동과 비교하며 새로운 도전 제시",
          lines: {
            foundation: "아까는 기어서 올라갔잖아요. 이번엔 다르게 올라갈 수 있을까?",
            interactive: "Earlier we crawled up. Can we go up a different way this time?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "걸어서요!! 서서 올라가요!!", interactive: "Walking! Standing up!" },
        },
        {
          who: "teacher",
          action: "동의하며 위험 요소 안내",
          lines: {
            foundation: "맞아요!! 걸어서 올라갈 거예요. 근데 이건 더 어려워요. 균형 잘 잡아야 하고, 천천히 한 발씩 가야 해요.",
            interactive: "That's right! We'll walk up. But this is harder — you need good balance and slow, careful steps.",
          },
        },
        {
          who: "teacher",
          action: "팔 벌리는 자세 시범",
          lines: {
            foundation: "팔은 이렇게 벌려요~ 비행기처럼! 그러면 안 흔들려요.",
            interactive: "Hold your arms out like this — like an airplane! It helps you not wobble.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기 — 다른 기준으로",
          lines: {
            foundation: "이번엔 가장 조용히 기다린 친구! 민준이 나오세요.",
            interactive: "This time, whoever waited the quietest! Min-jun, come on out.",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 + 출발",
          lines: {
            foundation: "Can you do it? (I can do it) 좋아요, 출발!",
            interactive: "Can you do it? (I can do it) Great, go ahead!",
          },
        },
        {
          who: "kids",
          action: "휘청거리며 걸어 올라가기",
          lines: { foundation: "(휘청거리며) 흔들려요!!", interactive: "I'm wobbling!" },
        },
        {
          who: "teacher",
          action: "정상 도착 시 큰 칭찬 + 다음 사람",
          lines: {
            foundation: "와!! 진짜 등반가다!! 다같이 박수!! 다음은 누가 해볼까?",
            interactive: "A real climber! Everyone clap! Who wants to try next?",
          },
        },
      ],
  
      cardLines: {
        foundation: ["천천히! 팔 벌려서 균형", "Can you do it?", "와!! 진짜 등반가다!", "다음은 누가?"],
        interactive: ["Slow steps, arms out", "Can you do it?", "A real climber!", "Who's next?"],
      },
  
      tip: "기어 올라가기보다 난이도가 높음. 처음 도전하는 아이는 선생님이 손을 살짝 잡아주며 자신감을 주는 게 좋음",
    },
  
    // ─────────────────────────────────
    // 5. 배 위 균형 걷기
    // ─────────────────────────────────
    {
      id: "balance-walk",
      num: 5,
      title: "배 위 균형 걷기",
      titleEn: "Balance Boat Walk!",
      time: "3~4분",
  
      script: [
        {
          who: "teacher",
          action: "매트 곡선 부분 보여주며 새로운 질문",
          lines: {
            foundation: "자, 이 모양 보니까 뭐가 생각나요?",
            interactive: "Looking at this shape, what does it remind you of?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "배요!! 보트 같아요!!", interactive: "A boat! It looks like a boat!" },
        },
        {
          who: "teacher",
          action: "동의하며 위험 요소+방법 안내",
          lines: {
            foundation: "맞아요!! 우리는 이제 배 위에 있어요. 배는 흔들리니까 균형을 잘 잡아야 해요. 떨어지지 않게 천천히 걸어가요.",
            interactive: "Right! We're on a boat now. Boats wobble, so balance carefully. Walk slowly so you don't fall.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기 — 또 다른 기준",
          lines: {
            foundation: "이번엔... 발을 제일 가지런히 모은 친구! 하은이 나오세요.",
            interactive: "This time... whoever has their feet together the neatest! Ha-eun, come on out.",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인",
          lines: {
            foundation: "Are you ready? (Yes I'm ready) Can you do it? (I can do it) 좋아요, 출발!",
            interactive: "Are you ready? (Yes I'm ready) Can you do it? (I can do it) Great, go!",
          },
        },
        {
          who: "kids",
          action: "균형 잡으며 걷기",
          lines: { foundation: "(휘청거리며) 흔들려요!! 배다!!", interactive: "It's wobbly! Like a real boat!" },
        },
        {
          who: "teacher",
          action: "끝까지 걸으면 큰 칭찬 + 다음 사람",
          lines: {
            foundation: "잘했어요!! 진짜 선원이다!! 다같이 박수!! 다음 선원은 누구?",
            interactive: "Great job! A real sailor! Everyone clap! Who's our next sailor?",
          },
        },
      ],
  
      cardLines: {
        foundation: ["배예요! 천천히 균형 잡고", "Are you ready? Can you do it?", "잘했어요!! 진짜 선원이다!", "다음 선원은?"],
        interactive: ["It's a boat — balance and walk slow", "Are you ready? Can you do it?", "A real sailor!", "Next sailor?"],
      },
  
      tip: "곡선 매트 위 균형 걷기는 의외로 어려워하는 아이들 많음. 손 잡아주거나 옆에서 같이 걸으며 보조하기",
    },
  ];
  
  export const AIR_CLIMBING_MAT_SAFETY = [
    "아이들이 흥분해서 위에서 떨어질 수 있으니 주의해요",
    "한 줄로 서서 한 명씩 이용해요",
    "뛰거나 밀지 않도록 지도해주세요",
    "매트가 미끄럽지 않은지 사용 전 확인해요",
    "활동 전후 매트를 깨끗이 정리해요",
  ];