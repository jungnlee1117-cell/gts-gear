// GTS 빌리보 9가지 활동 대본
// 현장 호흡 그대로: 질문으로 시작 → 위험 안내 → 한 명 뽑기 → 영어 구호 → 칭찬+다음 사람 루틴
// 레벨: Foundation / Interactive 2단계만 사용
// 영어 구호는 활동마다 다르게 — 다양한 표현 사용

export const BILBO_ACTIVITIES = [

    // ─────────────────────────────────
    // 1. 탐색하기
    // ─────────────────────────────────
    {
      id: "explore",
      num: 1,
      title: "탐색하기",
      titleEn: "Explore It!",
      time: "2~3분",
      script: [
        {
          who: "teacher",
          action: "빌리보를 보여주며 질문",
          lines: {
            foundation: "자, 이게 뭘까요? 동글동글하게 생겼죠? 만져볼까요?",
            interactive: "What is this? It's round and curvy! Let's explore it!",
          },
        },
        {
          who: "kids",
          action: "만지며 추측",
          lines: { foundation: "모자 같아요!! 그릇 같아요!!", interactive: "It looks like a hat! Or a bowl!" },
        },
        {
          who: "teacher",
          action: "동의하며 안전 안내",
          lines: {
            foundation: "맞아요!! 이건 빌리보예요. 던지지 말고 살살 만져봐요.",
            interactive: "That's right! This is called a Bilibo. Don't throw it — touch it gently.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑아서 만지는 모습 묘사",
          lines: {
            foundation: "가장 조심스럽게 들고 있는... 지후!",
            interactive: "Holding it so carefully... Jihoo!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호로 확인 — 출발 패턴",
          lines: {
            foundation: "Let's go? (Let's go!) 어떤 모양이에요?",
            interactive: "Let's go? (Let's go!) What shape is it?",
          },
        },
        {
          who: "kids",
          action: "느낌 표현",
          lines: { foundation: "둥글둥글해요!! 미끄러워요!!", interactive: "It's round! It's slippery!" },
        },
        {
          who: "teacher",
          action: "전체 칭찬 + 다음 단계 예고",
          lines: {
            foundation: "잘 탐색했어요!! 박수!! 이제 이걸로 놀아볼까요?",
            interactive: "Great exploring! Everyone clap! Now let's play with it!",
          },
        },
      ],
      tip: "빌리보는 처음 보는 아이들이 많음. 충분히 만지고 모양을 익힐 시간을 주는 게 중요",
    },
  
    // ─────────────────────────────────
    // 2. 빌리보에 앉아보기
    // ─────────────────────────────────
    {
      id: "sit",
      num: 2,
      title: "빌리보에 앉아보기",
      titleEn: "Sit On It!",
      time: "2~3분",
      script: [
        {
          who: "teacher",
          action: "빌리보 위에 앉는 시범. 질문으로 시작",
          lines: {
            foundation: "이번엔 여기 앉아볼까요? 앉으면 어떤 느낌일까?",
            interactive: "What if we sit on this? How do you think it'll feel?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "흔들릴 것 같아요!!", interactive: "It might wobble!" },
        },
        {
          who: "teacher",
          action: "위험 요소 안내 + 방법",
          lines: {
            foundation: "맞아요!! 흔들리니까 균형을 잡아야 해요. 천천히 앉아요.",
            interactive: "Right! It wobbles, so balance carefully. Sit down slowly.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "엉덩이를 가운데로 잘 맞춘... 미나!",
            interactive: "Sitting right in the center... Mina!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인 — Can you 패턴",
          lines: {
            foundation: "Can you sit on the Bilibo and balance? (I can do it!)",
            interactive: "Can you sit on the Bilibo and balance? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "앉으며 균형 잡기 시도",
          lines: { foundation: "(앉으며) 흔들흔들!!", interactive: "Wobble wobble!" },
        },
        {
          who: "teacher",
          action: "성공 칭찬 + 다음 사람",
          lines: {
            foundation: "Good job — who's next? (Me, me!)",
            interactive: "Good job — who's next? (Me, me!)",
          },
        },
      ],
      tip: "처음엔 손으로 잡아주며 앉는 연습을 시키면 안전하게 시작할 수 있음",
    },
  
    // ─────────────────────────────────
    // 3. 빌리보 위에 일어서보기
    // ─────────────────────────────────
    {
      id: "stand",
      num: 3,
      title: "빌리보 위에 일어서보기",
      titleEn: "Stand On It!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "한 단계 업그레이드 예고",
          lines: {
            foundation: "앉는 거 잘했으니 이번엔 일어서볼까요? 어떨 것 같아요?",
            interactive: "You sat well — now let's try standing! What do you think?",
          },
        },
        {
          who: "kids",
          action: "긴장하며 추측",
          lines: { foundation: "더 어려울 것 같아요!! 무서워요!!", interactive: "This looks harder! A little scary!" },
        },
        {
          who: "teacher",
          action: "안내 + 안심시키기",
          lines: {
            foundation: "맞아요, 더 어려워요. 선생님이 손 잡아줄게요. 천천히 일어서요.",
            interactive: "Yes, it's harder. I'll hold your hand. Stand up slowly.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "발을 가운데로 잘 모은... 진이!",
            interactive: "Feet centered so well... Jin!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인",
          lines: {
            foundation: "Can you stand on the Bilibo by yourself? (I can do it!)",
            interactive: "Can you stand on the Bilibo by yourself? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "조심스럽게 일어서기",
          lines: { foundation: "(일어서며) 으아 흔들려요!!", interactive: "Whoa, it's wobbly!" },
        },
        {
          who: "teacher",
          action: "성공 환호 + 다음 사람",
          lines: {
            foundation: "Did you do it? (Yes, I did it!) 박수!!",
            interactive: "Did you do it? (Yes, I did it!) Everyone clap!",
          },
        },
      ],
      tip: "난이도가 확 올라가는 활동. 처음 도전하는 아이는 선생님이 손을 잡아주며 자신감을 키워주는 게 중요",
    },
  
    // ─────────────────────────────────
    // 4. 거북이 놀이
    // ─────────────────────────────────
    {
      id: "turtle",
      num: 4,
      title: "거북이 놀이",
      titleEn: "Turtle Walk!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "빌리보를 뒤집어 등에 지는 시범",
          lines: {
            foundation: "이번엔 빌리보를 등에 지고 거북이가 돼볼까요?",
            interactive: "Let's put it on your back and become a turtle!",
          },
        },
        {
          who: "kids",
          action: "신나하며 반응",
          lines: { foundation: "거북이다!! 느려요!!", interactive: "I'm a turtle! So slow!" },
        },
        {
          who: "teacher",
          action: "방법 안내",
          lines: {
            foundation: "맞아요!! 네발로 기어가요. 떨어지지 않게 천천히.",
            interactive: "Right! Crawl on hands and knees. Slowly so it doesn't fall.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "제일 거북이처럼 천천히 기어가는... 서윤이!",
            interactive: "Crawling the slowest, just like a turtle... Seo-yoon!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인",
          lines: {
            foundation: "Can you walk like a turtle with the Bilibo? (I can do it!)",
            interactive: "Can you walk like a turtle with the Bilibo? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "거북이처럼 기어가기",
          lines: { foundation: "(기어가며) 느릿느릿!!", interactive: "Slow and steady!" },
        },
        {
          who: "teacher",
          action: "성공 칭찬 + 다음 거북이",
          lines: {
            foundation: "Was that fun? (Yes, that was fun!) 다음 거북이는 누구?",
            interactive: "Was that fun? (Yes, that was fun!) Who's our next turtle?",
          },
        },
      ],
      tip: "거북이 컨셉이 들어가면 아이들이 훨씬 적극적으로 참여함. 느린 속도가 오히려 안전하게 활동하기 좋음",
    },
  
    // ─────────────────────────────────
    // 5. 빌리보 위에 서서 빙글 돌기
    // ─────────────────────────────────
    {
      id: "spin-standing",
      num: 5,
      title: "빌리보 위에 서서 빙글 돌기",
      titleEn: "Spin While Standing!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "서서 도는 시범",
          lines: {
            foundation: "이번엔 서서 빙글빙글 돌아볼까요? 균형 잡을 수 있을까?",
            interactive: "Let's try spinning while standing! Can you keep your balance?",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "어지러울 것 같아요!!", interactive: "I might get dizzy!" },
        },
        {
          who: "teacher",
          action: "안전 안내",
          lines: {
            foundation: "맞아요!! 천천히 돌아야 해요. 너무 빨리 돌면 넘어질 수 있어요.",
            interactive: "Right! Spin slowly. If you go too fast, you might fall.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "균형을 제일 잘 잡고 있는... 민준이!",
            interactive: "Best balance I've seen... Min-jun!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인",
          lines: {
            foundation: "Can you spin around while keeping your balance? (I can do it!)",
            interactive: "Can you spin around while keeping your balance? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "천천히 돌기 시도",
          lines: { foundation: "(돌며) 빙글빙글!!", interactive: "Spinning, spinning!" },
        },
        {
          who: "teacher",
          action: "성공 칭찬 + 다음 사람",
          lines: {
            foundation: "Good job — who's next? (Me, me!)",
            interactive: "Good job — who's next? (Me, me!)",
          },
        },
      ],
      tip: "어지러워하는 아이가 있을 수 있으니 너무 많이 돌지 않게 횟수를 제한해주는 게 좋음",
    },
  
    // ─────────────────────────────────
    // 6. 빌리보 머리에 써서 걸어가기
    // ─────────────────────────────────
    {
      id: "head-walk",
      num: 6,
      title: "빌리보 머리에 써서 걸어가기",
      titleEn: "Walk With It On Your Head!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "빌리보를 모자처럼 머리에 쓰는 시범",
          lines: {
            foundation: "이번엔 모자처럼 머리에 써볼까요? 걸을 수 있을까?",
            interactive: "Let's wear it like a hat! Can we walk like this?",
          },
        },
        {
          who: "kids",
          action: "신기해하며 반응",
          lines: { foundation: "모자다!! 신기해요!!", interactive: "It's a hat! So funny!" },
        },
        {
          who: "teacher",
          action: "안내",
          lines: {
            foundation: "맞아요!! 떨어지지 않게 머리 똑바로 들고 천천히 걸어요.",
            interactive: "Right! Keep your head straight so it doesn't fall, and walk slowly.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "고개를 제일 똑바로 든... 하은이!",
            interactive: "Head held the straightest... Ha-eun!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인",
          lines: {
            foundation: "Can you walk carefully with the Bilibo on your head? (I can do it!)",
            interactive: "Can you walk carefully with the Bilibo on your head? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "조심스럽게 걸어가기",
          lines: { foundation: "(걸으며) 안 떨어지게!!", interactive: "Don't fall, don't fall!" },
        },
        {
          who: "teacher",
          action: "성공 칭찬 + 다음 사람",
          lines: {
            foundation: "Did you do it? (Yes, I did it!) 박수!!",
            interactive: "Did you do it? (Yes, I did it!) Everyone clap!",
          },
        },
      ],
      tip: "떨어져도 괜찮다고 미리 말해주면 부담 없이 도전함. 실패해도 웃으면서 다시 시도하게 분위기 만들기",
    },
  
    // ─────────────────────────────────
    // 7. 빌리보 뒤집어서 빙글 돌려보기
    // ─────────────────────────────────
    {
      id: "spin-flipped",
      num: 7,
      title: "빌리보 뒤집어서 빙글 돌려보기",
      titleEn: "Spin It Fast!",
      time: "2~3분",
      script: [
        {
          who: "teacher",
          action: "빌리보를 뒤집어서 바닥에 두고 돌리는 시범",
          lines: {
            foundation: "이번엔 직접 타지 않고, 빌리보를 손으로 돌려볼까요?",
            interactive: "This time, let's not ride it — let's spin it with our hands!",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "팽이처럼요!!", interactive: "Like a spinning top!" },
        },
        {
          who: "teacher",
          action: "안내",
          lines: {
            foundation: "맞아요!! 손으로 힘껏 돌려봐요. 누가 제일 빠르게 돌릴 수 있을까?",
            interactive: "Right! Spin it hard with your hands. Who can spin it the fastest?",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "손에 힘이 제일 센... 우영이!",
            interactive: "Strongest hands here... Woo-young!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인",
          lines: {
            foundation: "Can you spin the Bilibo as fast as you can? (I can do it!)",
            interactive: "Can you spin the Bilibo as fast as you can? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "빠르게 돌리기 시도",
          lines: { foundation: "(돌리며) 빙글빙글빙글!!", interactive: "Spin, spin, spin!" },
        },
        {
          who: "teacher",
          action: "성공 환호 + 다음 사람",
          lines: {
            foundation: "Was that fun? (Yes, that was fun!) 다음은 누구?",
            interactive: "Was that fun? (Yes, that was fun!) Who's next?",
          },
        },
      ],
      tip: "타는 활동 사이에 잠깐 쉬어가는 느낌으로 좋은 활동. 손 힘 조절 연습도 자연스럽게 됨",
    },
  
    // ─────────────────────────────────
    // 8. 뒤집힌 빌리보에 앉아서 빙글 돌기
    // ─────────────────────────────────
    {
      id: "sit-spin-flipped",
      num: 8,
      title: "뒤집힌 빌리보에 앉아서 빙글 돌기",
      titleEn: "Sit Inside and Spin!",
      time: "3~4분",
      script: [
        {
          who: "teacher",
          action: "뒤집은 빌리보 안에 앉는 시범",
          lines: {
            foundation: "이번엔 빌리보 안에 들어가 앉아서 천천히 돌아볼까요?",
            interactive: "Let's sit inside the Bilibo and spin slowly!",
          },
        },
        {
          who: "kids",
          action: "추측",
          lines: { foundation: "둥지 같아요!!", interactive: "It's like a nest!" },
        },
        {
          who: "teacher",
          action: "안내",
          lines: {
            foundation: "맞아요!! 안에 들어가서 발로 살짝 밀면서 천천히 돌아요.",
            interactive: "Right! Sit inside, push gently with your feet, and spin slowly.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "안에 제일 편하게 앉은... 지후!",
            interactive: "Sitting so comfortably inside... Jihoo!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인",
          lines: {
            foundation: "Can you sit inside and spin around slowly? (I can do it!)",
            interactive: "Can you sit inside and spin around slowly? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "안에 앉아 천천히 돌기",
          lines: { foundation: "(돌며) 둥지 안이 좋아요!!", interactive: "I love it in here!" },
        },
        {
          who: "teacher",
          action: "성공 칭찬 + 다음 사람",
          lines: {
            foundation: "Good job — who's next? (Me, me!)",
            interactive: "Good job — who's next? (Me, me!)",
          },
        },
      ],
      tip: "안에 들어가는 활동이라 아늑하고 편안한 느낌을 줌. 흥분한 아이들 텐션을 조금 가라앉히는 용도로도 좋음",
    },
  
    // ─────────────────────────────────
    // 9. 빌리보 징검다리 건너기
    // ─────────────────────────────────
    {
      id: "stepping-stones",
      num: 9,
      title: "빌리보 징검다리 건너기",
      titleEn: "Stepping Stones!",
      time: "3~5분",
      script: [
        {
          who: "teacher",
          action: "빌리보 여러 개를 일렬로 늘어놓는 시범",
          lines: {
            foundation: "마지막 도전!! 빌리보를 징검다리처럼 늘어놨어요. 건너볼까요?",
            interactive: "Final challenge! I lined up the Bilibos like stepping stones. Let's cross!",
          },
        },
        {
          who: "kids",
          action: "기대하며 반응",
          lines: { foundation: "징검다리다!! 신난다!!", interactive: "Stepping stones! So exciting!" },
        },
        {
          who: "teacher",
          action: "안전 안내",
          lines: {
            foundation: "맞아요!! 떨어지지 않게 한 발씩 천천히 건너가요.",
            interactive: "Right! Step carefully, one foot at a time, so you don't fall.",
          },
        },
        {
          who: "teacher",
          action: "한 명 뽑기",
          lines: {
            foundation: "발끝을 제일 잘 모은... 진이!",
            interactive: "Toes lined up so well... Jin!",
          },
        },
        {
          who: "teacher",
          action: "영어 구호 확인",
          lines: {
            foundation: "Can you step across the Bilibos without falling? (I can do it!)",
            interactive: "Can you step across the Bilibos without falling? (I can do it!)",
          },
        },
        {
          who: "kids",
          action: "징검다리 건너기 시도",
          lines: { foundation: "(건너며) 한발 한발 조심!!", interactive: "Step by step, carefully!" },
        },
        {
          who: "teacher",
          action: "완주 칭찬 + 전체 마무리",
          lines: {
            foundation: "Did you do it? (Yes, I did it!) 오늘 빌리보로 9가지 다 해냈어요!! 박수!!",
            interactive: "Did you do it? (Yes, I did it!) You completed all 9 Bilibo challenges today! Clap!",
          },
        },
      ],
      tip: "마무리 활동으로 완벽함. 빌리보 개수와 간격을 조절해서 난이도 쉽게 변형 가능",
    },
  ];
  
  export const BILBO_SAFETY = [
    "빌리보 위에서 뛰거나 장난치지 않도록 지도해주세요",
    "친구와 충분한 간격을 유지해요",
    "빙글빙글 도는 활동은 어지러워할 수 있으니 횟수를 제한해주세요",
    "맨발이나 미끄럼 방지 양말을 신고 사용해요",
    "활동 전후 빌리보 개수를 확인하고 정리해요",
  ];