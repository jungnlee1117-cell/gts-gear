// GTS 벽돌 9가지 활동 대본 (v2 - 다양한 영어 구호 적용)
// 현장 호흡 그대로: 질문으로 시작 → 위험 안내 → 한 명 뽑기 → 영어 구호 → 칭찬+다음 사람 루틴
// 레벨: Foundation / Interactive 2단계만 사용
// 영어 구호는 활동마다 다르게 — Are you ready 외에도 다양한 표현 사용

export const BRICK_ACTIVITIES = [

    // ─────────────────────────────────
    // 1. 벽돌 하나씩 받고 탐색하기
    // ─────────────────────────────────
    {
      id: "explore",
      num: 1,
      title: "벽돌 하나씩 받고 탐색하기",
      titleEn: "Explore It!",
      time: "2~3분",
      script: [
        {
          who: "teacher",
          action: "벽돌을 하나씩 나눠주며 질문",
          lines: {
            foundation: "자, 이거 받아봐요! 이게 뭘까요? 어떻게 가지고 놀 수 있을까요?",
            interactive: "Here you go! What is this? What can we do with it?",
          },
        },
        {
          who: "kids",
          action: "벽돌을 만지며 추측",
          lines: { foundation: "벽돌이에요!! 쌓을 수 있어요!!", interactive: "It's a brick! We can stack it!" },
        },
        {
          who: "teacher",
          action: "동의하며 안전하게 다루는 법 안내",
          lines: {
            foundation: "맞아요!! 근데 친구한테 던지거나 부딫히면 다칠 수 있으니까, 살살 만져봐요.",
            interactive: "That's right! But be gentle — don't throw it at friends, it could hurt.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑아서 만지는 모습 묘사",
          lines: {
            foundation: "자, 누가 제일 조심스럽게 만지고 있을까... 하은이!",
            interactive: "Who's holding it the most carefully... Ha-eun!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호로 확인 — 출발 전 패턴",
          lines: {
            foundation: "Let's go? (Let's go!) 어떤 느낌이에요?",
            interactive: "Let's go? (Let's go!) How does it feel?",
          },
        },
        {
          who: "kids",
          action: "느낌 표현",
          lines: { foundation: "딱딱해요!! 가벼워요!!", interactive: "It's hard! It's light!" },
        },
        {
          who: "teacher",
          action: "전체 칭찬 + 다음 단계 예고",
          lines: {
            foundation: "잘 탐색했어요!! 박수!! 이제 이걸로 더 신나는 거 해볼까요?",
            interactive: "Great exploring! Everyone clap! Now let's do something more fun!",
          },
        },
      ],
      tip: "처음 만지는 시간을 충분히 줘야 이후 활동에서 안전하게 다룸. 너무 빨리 다음으로 넘어가지 않기",
    },
  
    // ─────────────────────────────────
    // 2. 벽돌 머리에 올리고 걸어가기
    // ─────────────────────────────────
    {
      id: "head-walk",
      num: 2,
      title: "벽돌 머리에 올리고 걸어가기",
      titleEn: "Walk With It On Your Head!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "벽돌을 머리 위에 얹는 시범. 질문으로 시작",
          lines: {
            foundation: "이번엔 벽돌을 머리에 올려볼까요? 떨어지면 어떻게 될까?",
            interactive: "What if we put it on our head? What happens if it falls?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "떨어져요!! 균형 잡아야 해요!!", interactive: "It'll fall! We need balance!" },
        },
        {
          who: "teacher",
          action: "위험 요소 안내 + 방법 설명",
          lines: {
            foundation: "맞아요!! 머리 똑바로 들고, 천천히 걸어야 해요. 떨어지면 줍고 다시 올려요.",
            interactive: "Right! Keep your head straight, walk slowly. If it falls, pick it up and try again.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기 — 자세 디테일로",
          lines: {
            foundation: "허리 펴고 고개 똑바로 든... 민준이! 나오세요.",
            interactive: "Straight back, head up high... Min-jun, come on out!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인 후 출발 — 카운트다운 패턴",
          lines: {
            foundation: "Ready, set...? (GO!!)",
            interactive: "Ready, set...? (GO!!)",
          },
        },
        {
          who: "kids",
          action: "조심스럽게 걸어가기",
          lines: { foundation: "(천천히 걸으며) 안 떨어지게!!", interactive: "Don't fall, don't fall!" },
        },
        {
          who: "teacher",
          action: "성공 칭찬 + 다음 사람 — 끝나고 반응 패턴",
          lines: {
            foundation: "Good job — who's next? (Me, me!)",
            interactive: "Good job — who's next? (Me, me!)",
          },
        },
      ],
      tip: "벽돌이 떨어져도 괜찮다고 미리 말해주면 아이들이 부담 없이 도전함. 실패해도 웃으면서 다시 시도하게 분위기 만들기",
    },
  
    // ─────────────────────────────────
    // 3. 벽돌 다리 사이에 끼고 점프뛰기
    // ─────────────────────────────────
    {
      id: "jump-between-legs",
      num: 3,
      title: "벽돌 다리 사이에 끼고 점프뛰기",
      titleEn: "Jump With It Between Your Legs!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "벽돌을 다리 사이에 끼우는 시범",
          lines: {
            foundation: "이번엔 벽돌을 다리 사이에 끼워봐요! 이렇게 점프하면 어떨까?",
            interactive: "Let's put it between your legs! What happens if we jump like this?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "떨어질 것 같아요!! 어려워요!!", interactive: "It might drop! This looks hard!" },
        },
        {
          who: "teacher",
          action: "안전 안내 + 방법",
          lines: {
            foundation: "맞아요, 어려워요! 그래서 친구랑 멀리 떨어져서 한 명씩 해야 해요.",
            interactive: "It is hard! So we need space between friends, and one at a time.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "다리에 제일 꽉 끼운... 서윤이!",
            interactive: "Holding it tightest between the legs... Seo-yoon!",
          },
        },
        {
          who: "teacher",
          action: "구호 확인 — Can you do it 패턴",
          lines: {
            foundation: "Can you do it? (I can do it!)",
            interactive: "Can you do it? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "점프 시도",
          lines: { foundation: "(점프하며) 으악 떨어졌다!!", interactive: "Oops, it dropped!" },
        },
        {
          who: "teacher",
          action: "실패해도 격려 + 다음 사람 — 재도전 패턴",
          lines: {
            foundation: "Will you try again? (Yes, I'll try again!) 박수!!",
            interactive: "Will you try again? (Yes, I'll try again!) Everyone clap!",
          },
        },
      ],
      tip: "난이도가 꽤 있는 활동. 실패가 당연하다는 걸 미리 알려주면 아이들이 좌절하지 않고 계속 도전함",
    },
  
    // ─────────────────────────────────
    // 4. 벽돌 두 개로 박수쳐보기
    // ─────────────────────────────────
    {
      id: "clap-bricks",
      num: 4,
      title: "벽돌 두 개로 박수쳐보기",
      titleEn: "Clap With Two Bricks!",
      time: "2~3분",
      script: [
        {
          who: "teacher",
          action: "벽돌 두 개를 양손에 쥐고 부딫히는 시범",
          lines: {
            foundation: "이번엔 양손에 벽돌 하나씩! 부딫히면 무슨 소리가 날까?",
            interactive: "One brick in each hand! What sound happens when they clap together?",
          },
        },
        {
          who: "kids",
          action: "추측하며 시도",
          lines: { foundation: "딱딱 소리나요!!", interactive: "It makes a clacking sound!" },
        },
        {
          who: "teacher",
          action: "손가락 끼임 주의 안내",
          lines: {
            foundation: "맞아요!! 근데 손가락이 끼일 수 있으니까 천천히, 살살 부딫혀요.",
            interactive: "That's right! But be careful of your fingers — clap slowly and gently.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑아 리듬 만들기",
          lines: {
            foundation: "제일 신나는 리듬 만든... 진이! 한번 들려줄래요?",
            interactive: "Made the coolest rhythm... Jin! Show us!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 — One two three go 패턴",
          lines: {
            foundation: "One, two, three — go? (Go!!)",
            interactive: "One, two, three — go? (Go!!)",
          },
        },
        {
          who: "kids",
          action: "리듬 만들며 박수",
          lines: { foundation: "(부딫히며) 딱딱딱!!", interactive: "Clack clack clack!" },
        },
        {
          who: "teacher",
          action: "다같이 따라하기 유도 + 칭찬 — Was that fun 패턴",
          lines: {
            foundation: "Was that fun? (Yes, that was fun!) 다같이 따라해봐요!!",
            interactive: "Was that fun? (Yes, that was fun!) Everyone follow along!",
          },
        },
      ],
      tip: "리듬을 만드는 활동이라 음악적 감각도 자연스럽게 키울 수 있음. 한 명이 만든 리듬을 다같이 따라하면 그룹 활동으로 확장 가능",
    },
  
    // ─────────────────────────────────
    // 5. 벽돌 세운 후 발차기·주먹치기로 쓰러트리기
    // ─────────────────────────────────
    {
      id: "knock-down",
      num: 5,
      title: "벽돌 세운 후 쓰러트리기",
      titleEn: "Knock It Down!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "벽돌을 세워두고 질문",
          lines: {
            foundation: "벽돌을 이렇게 세웠어요! 어떻게 쓰러트릴 수 있을까?",
            interactive: "I stood the brick up! How can we knock it down?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "발로 차요!! 손으로 쳐요!!", interactive: "Kick it! Punch it!" },
        },
        {
          who: "teacher",
          action: "안전거리 + 순서 안내",
          lines: {
            foundation: "맞아요!! 근데 한 명씩, 자기 벽돌만 차야 해요. 친구 거 차면 안 돼요.",
            interactive: "Right! But one at a time, only your own brick. Not your friend's!",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "제일 힘있게 서있는... 우영이!",
            interactive: "Standing the strongest... Woo-young!",
          },
        },
        {
          who: "teacher",
          action: "구호 + 카운트다운 — Are you ready 패턴",
          lines: {
            foundation: "Are you ready? (Yes, I'm ready!) 차!!",
            interactive: "Are you ready? (Yes, I'm ready!) Kick!!",
          },
        },
        {
          who: "kids",
          action: "발차기로 쓰러트리기",
          lines: { foundation: "(차며) 으아!! 쓰러졌다!!", interactive: "It's down!!" },
        },
        {
          who: "teacher",
          action: "성공 환호 + 다음 사람 — Did you do it 패턴",
          lines: {
            foundation: "Did you do it? (Yes, I did it!) 박수!!",
            interactive: "Did you do it? (Yes, I did it!) Everyone clap!",
          },
        },
      ],
      tip: "에너지 발산하기 좋은 활동. 발차기/주먹치기 둘 다 시도해보게 하면 다양한 신체 움직임을 경험시킬 수 있음",
    },
  
    // ─────────────────────────────────
    // 6. 벽돌 두 개로 밸런스 잡아보기
    // ─────────────────────────────────
    {
      id: "balance-two",
      num: 6,
      title: "벽돌 두 개로 밸런스 잡아보기",
      titleEn: "Balance With Two Bricks!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "벽돌 두 개를 양손에 펴서 균형 잡는 시범",
          lines: {
            foundation: "이번엔 벽돌 두 개 들고 균형 잡기! 어떻게 하면 안 떨어질까?",
            interactive: "Let's balance with two bricks! How can we keep them from falling?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "천천히 움직여요!!", interactive: "Move slowly!" },
        },
        {
          who: "teacher",
          action: "방법 안내",
          lines: {
            foundation: "맞아요!! 양손을 펴고 벽돌을 손바닥 위에 올려요. 천천히 걸어볼까요?",
            interactive: "Right! Open your hands, put the bricks on top. Now walk slowly.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "손바닥을 제일 평평하게 펼친... 하은이!",
            interactive: "Flattest open palms... Ha-eun!",
          },
        },
        {
          who: "teacher",
          action: "구호 확인 — Let's go 패턴",
          lines: {
            foundation: "Let's go? (Let's go!)",
            interactive: "Let's go? (Let's go!)",
          },
        },
        {
          who: "kids",
          action: "균형 잡으며 걷기",
          lines: { foundation: "(천천히 걸으며) 떨어질 것 같아요!!", interactive: "I think it's gonna fall!" },
        },
        {
          who: "teacher",
          action: "활동 중 응원 — Keep going 패턴",
          lines: {
            foundation: "Keep going! (I'm doing it!) One more step! (One more step!)",
            interactive: "Keep going! (I'm doing it!) One more step! (One more step!)",
          },
        },
        {
          who: "teacher",
          action: "끝까지 가면 칭찬 + 다음 사람",
          lines: {
            foundation: "성공!! 균형감각 최고!! 박수!! 다음 사람?",
            interactive: "Success! Amazing balance! Clap! Who's next?",
          },
        },
      ],
      tip: "한 손에 한 개씩 vs 양손 위에 쌓아서 등 다양한 방식으로 변형 가능. 떨어뜨려도 다시 도전하게 격려",
    },
  
    // ─────────────────────────────────
    // 7. 높이 쌓아보기
    // ─────────────────────────────────
    {
      id: "stack-high",
      num: 7,
      title: "높이 쌓아보기",
      titleEn: "Stack It High!",
      time: "3~5분",
      script: [
        {
          who: "teacher",
          action: "벽돌을 모아두고 질문",
          lines: {
            foundation: "이 벽돌들 다 모아서 높이 쌓을 수 있을까요?",
            interactive: "Can we stack all these bricks really high?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "쌓을 수 있어요!! 무너질 것 같아요!!", interactive: "We can! But it might fall!" },
        },
        {
          who: "teacher",
          action: "안전 안내",
          lines: {
            foundation: "맞아요!! 무너지면 다칠 수 있으니까 천천히, 조심조심 쌓아요.",
            interactive: "Right! If it falls it could hurt, so stack slowly and carefully.",
          },
        },
        {
          who: "teacher",
          action: "한 명 또는 팀 뽑기",
          lines: {
            foundation: "제일 조심스럽게 손 모은... 민준이! 시작해볼까요?",
            interactive: "Hands folded so carefully... Min-jun! Let's start!",
          },
        },
        {
          who: "teacher",
          action: "구호 + 출발 — Can you do it 패턴",
          lines: {
            foundation: "Can you do it? (I can do it!) 자, 쌓아봐요!",
            interactive: "Can you do it? (I can do it!) Go ahead, stack it!",
          },
        },
        {
          who: "kids",
          action: "조심스럽게 쌓기",
          lines: { foundation: "(쌓으며) 점점 높아진다!!", interactive: "It's getting taller!" },
        },
        {
          who: "teacher",
          action: "활동 중 응원 — Almost there 패턴",
          lines: {
            foundation: "Almost there! (Almost there!) You can do it! (Yes I can!)",
            interactive: "Almost there! (Almost there!) You can do it! (Yes I can!)",
          },
        },
        {
          who: "teacher",
          action: "성공 또는 무너짐 둘 다 축하 + 다음",
          lines: {
            foundation: "와!! 엄청 높다!! 박수!! 다음엔 더 높이 가볼까?",
            interactive: "Wow, so tall! Clap! Let's go even higher next time!",
          },
        },
      ],
      tip: "무너지는 것도 활동의 일부로 받아들이게 하면 좋음. 무너졌을 때 다같이 웃으면서 다시 도전하는 분위기가 핵심",
    },
  
    // ─────────────────────────────────
    // 8. 길 만들고 걸어가기
    // ─────────────────────────────────
    {
      id: "build-path",
      num: 8,
      title: "길 만들고 걸어가기",
      titleEn: "Build a Path and Walk!",
      time: "3~5분",
      script: [
        {
          who: "teacher",
          action: "벽돌을 일렬로 늘어놓는 시범",
          lines: {
            foundation: "벽돌로 길을 만들어볼까요? 이렇게 쭉 늘어놓으면 뭐가 될까?",
            interactive: "Let's build a path with bricks! What does this become?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "다리 같아요!! 길이에요!!", interactive: "Looks like a bridge! A path!" },
        },
        {
          who: "teacher",
          action: "방법 + 안전 안내",
          lines: {
            foundation: "맞아요!! 우리가 만든 길을 따라 한 명씩 걸어가요. 옆으로 떨어지지 않게!",
            interactive: "Right! Walk along the path we made, one at a time. Don't step off!",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "발 모으고 준비한... 서윤이!",
            interactive: "Feet together, ready... Seo-yoon!",
          },
        },
        {
          who: "teacher",
          action: "구호 확인 — Ready set go 패턴",
          lines: {
            foundation: "Ready, set...? (GO!!)",
            interactive: "Ready, set...? (GO!!)",
          },
        },
        {
          who: "kids",
          action: "길 따라 걷기",
          lines: { foundation: "(걸으며) 한발 한발!!", interactive: "Step by step!" },
        },
        {
          who: "teacher",
          action: "완주 칭찬 + 다음 사람 — One more time 패턴",
          lines: {
            foundation: "도착!! One more time? (One more time!)",
            interactive: "Arrived! One more time? (One more time!)",
          },
        },
      ],
      tip: "길의 모양을 직선, 지그재그, 곡선 등으로 바꿔가며 난이도 조절 가능. 협동으로 길을 같이 만드는 시간도 의미 있음",
    },
  
    // ─────────────────────────────────
    // 9. 팀별 도미노 활동
    // ─────────────────────────────────
    {
      id: "domino",
      num: 9,
      title: "팀별 도미노 활동",
      titleEn: "Team Domino Challenge!",
      time: "5~7분",
      script: [
        {
          who: "teacher",
          action: "팀을 나누고 도미노 컨셉 소개",
          lines: {
            foundation: "마지막 도전!! 팀을 나눠서 벽돌로 도미노를 만들어볼까요?",
            interactive: "Final challenge! Let's split into teams and build a brick domino!",
          },
        },
        {
          who: "kids",
          action: "기대하며 반응",
          lines: { foundation: "도미노요?? 신난다!!", interactive: "Domino?? So exciting!" },
        },
        {
          who: "teacher",
          action: "방법 + 협동 강조",
          lines: {
            foundation: "팀끼리 협동해서 벽돌을 세워서 줄을 만들고, 마지막에 하나를 넘어뜨려서 다 쓰러지게 해요!",
            interactive: "Work together to line up bricks standing, then knock the first one to topple them all!",
          },
        },
        {
          who: "teacher",
          action: "팀별로 시간 주고 준비",
          lines: {
            foundation: "팀별로 3분 줄게요! 협동해서 만들어봐요!",
            interactive: "3 minutes per team! Work together to build it!",
          },
        },
        {
          who: "kids",
          action: "팀별로 도미노 세우기",
          lines: { foundation: "(세우며) 조심조심!! 쓰러지면 안돼!!", interactive: "Carefully! Don't knock it over yet!" },
        },
        {
          who: "teacher",
          action: "완성 확인 + 구호로 시작 신호 — One two three go 패턴",
          lines: {
            foundation: "다 됐나요? One, two, three — go? (Go!!)",
            interactive: "All done? One, two, three — go? (Go!!)",
          },
        },
        {
          who: "kids",
          action: "도미노 넘어뜨리기",
          lines: { foundation: "(넘어뜨리며) 와아아아!! 다 쓰러진다!!", interactive: "Wheee! They're all falling!" },
        },
        {
          who: "teacher",
          action: "전체 팀 축하 + 오늘 활동 마무리 — Was that fun 패턴",
          lines: {
            foundation: "Was that fun? (Yes, that was fun!) 오늘 벽돌로 9가지 다 해냈어요!! 박수!!",
            interactive: "Was that fun? (Yes, that was fun!) You completed all 9 brick challenges today! Clap!",
          },
        },
      ],
      tip: "마무리 활동으로 협동심과 성취감을 동시에 줄 수 있음. 팀 간 경쟁보다 함께 해냈다는 분위기로 마무리하는 게 좋음",
    },
  ];
  
  export const BRICK_SAFETY = [
    "벽돌을 친구에게 던지지 않도록 지도해주세요",
    "쌓기 활동은 무너질 때 다치지 않게 충분한 거리를 유지해요",
    "발차기·주먹치기 활동은 자기 벽돌만 치도록 지도해주세요",
    "손가락이 끼이지 않게 천천히 다루도록 안내해주세요",
    "활동 전후 벽돌 개수를 확인하고 정리해요",
  ];