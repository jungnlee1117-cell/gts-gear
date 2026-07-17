/** 준비운동·게임 확충 콘텐츠 v1 — 제공 문서 원문 기반 */

const sameScriptForAllLevels = (label, script) => ({
  label,
  default: { easy: script, medium: script, hard: script },
  alternatives: [],
});

const preparation = (id, title, titleEn, space, duration, materials, script) => ({
  id,
  stage: "warmup",
  label: title,
  title,
  title_en: titleEn,
  space_requirement: space,
  duration_minutes: duration,
  materials,
  script,
});

const game = (id, title, titleEn, difficulty, duration, materials, script) => ({
  id,
  stage: "game",
  label: title,
  title,
  title_en: titleEn,
  difficulty,
  duration_minutes: duration,
  materials,
  script,
});

export const EXPANDED_PREPARATION_ACTIVITIES = [
  preparation(
    "shuttle-run", "왕복 달리기", "Shuttle Run", "large", 3, "콘 2~4개",
    `Teacher: (양쪽 콘을 가리키며) "Look at the two cones! One here, one over there! We are going to run back and forth, super fast! Ready position!"

(아이들을 콘 앞에 한 줄로 세운다)

Teacher: "3, 2, 1... GO! Run to the other cone! Touch it! Now run back! Go, go, go!"

(선생님도 옆에서 같이 뛰며 속도를 리드한다)

Teacher: "Wow, [아이 이름1], you touched the cone so fast! One more time! Ready... GO!"

(2~3회 반복 후 속도를 늦추며 마무리)

Teacher: "Last one, slow and steady! Walk back this time. Great job, everyone! Your legs are warm now!"`,
  ),
  preparation(
    "circle-run", "동그랗게 달리기", "Circle Run", "medium", 2, "콘 4~6개 (원형 배치)",
    `Teacher: (콘을 원형으로 가리키며) "Look! Our cones made a big circle! We are going to run around the circle, like a fast train! Choo-choo!"

(선생님이 앞장서서 원을 그리며 달린다)

Teacher: "Follow Teacher! Run, run, run! Don't push your friends, no bumping! Safety first!"

(아이들이 한 줄로 따라 돌기 시작하면)

Teacher: "Wow, look at our line! It's like a snake moving around! Faster, faster! [아이 이름1], great pace!"

(약 1분 후 반대 방향으로 전환)

Teacher: "Now, let's turn around! Run the other way! 3, 2, 1, switch!"

Teacher: "Okay, slow down... and stop! Great circle running, everyone!"`,
  ),
  preparation(
    "animal-walks", "동물 달리기", "Animal Walks", "small", 3, "없음",
    `Teacher: "Now, we are cute rabbits! Jump like a rabbit! Hop, hop, hop!" (두 손으로 토끼 귀를 만들고 점프)

Teacher: "Wow, look at [아이 이름1]! Super jump! [아이 이름2], hop like a rabbit! Good!"

Teacher: "Next, we are strong bears! Walk on your hands and feet! Slow and heavy, like this!" (곰처럼 네발로 걷는 시늉)

Teacher: "Rawr! Bears are strong! Good bear walk, [아이 이름3]!"

Teacher: "Now, we are funny crabs! Walk sideways like a crab! Snip, snip!" (게걸음으로 옆으로 이동)

Teacher: "Haha, look at everyone's crab walk! So funny! Okay, animals, freeze! Great warm-up!"`,
  ),
  preparation(
    "jumping-in-place", "제자리 점핑", "Jumping in Place", "small", 2, "없음",
    `Teacher: "Everyone, find your own spot! Don't touch your friends. Now, let's jump! Jumping jacks! Arms up, legs open! Like this!" (점핑잭 시범)

Teacher: "1, 2, 3, 4... Wow, [아이 이름1], your jump is so high! Keep going!"

Teacher: "Now, let's lift our knees high! High knees! Like a marching soldier! Left, right, left, right!"

(무릎 높이 들기로 전환)

Teacher: "Faster, faster! [아이 이름2], your knees are touching the sky! Amazing!"

Teacher: "Last one — small jumps, like popcorn! Pop, pop, pop!" (제자리 콩콩 점프)

Teacher: "Great job! Our whole body is warm now!"`,
  ),
  preparation(
    "stretch-balance", "스트레칭 & 밸런스", "Stretch & Balance", "none", 2, "없음",
    `Teacher: "Let's stretch our bodies! Stand tall, reach up high! Can you touch the sky? Stretch, stretch, stretch!"

Teacher: "Now, bend down and touch your toes! Down, down, down! Can you tickle your toes?" (아이들이 웃으며 발가락 만지기)

Teacher: "Good! Now, let's check our balance. Lift one leg up! Who can stand like a flamingo? 1, 2, 3..."

Teacher: "Wow, [아이 이름1] is balancing so well! Amazing! Switch legs! Lift your other leg!"

Teacher: "Last, let's take a deep breath. Inhale... (손을 위로) exhale... (손을 아래로) One more time. Great, our bodies are ready!"`,
  ),
];

export const EXPANDED_GAME_ACTIVITIES = [
  game(
    "freeze-game", "얼음땡 프리즈", "Freeze Game", "easy", 3, "없음 (음악 선택)",
    `Teacher: "We are going to dance and move around the room! But when Teacher says FREEZE, you must stop like a statue!"

(음악 켜고 아이들 자유롭게 움직이게 함)

Teacher: "Dance, dance, dance! And... FREEZE!" (음악 멈춤)

Teacher: "Wow, [아이 이름1] is frozen like ice! Perfect statue! Okay, dance again!"

(3~4회 반복, 점점 텐션 조절)

Teacher: "Last freeze... and FREEZE! Amazing control, everyone!"`,
  ),
  game(
    "green-red-light", "무궁화꽃이 피었습니다", "Red Light, Green Light", "easy", 4, "없음",
    `Teacher: "Teacher will turn around and count. When Teacher says STOP and turns around, you must freeze! If you move, you go back to the start line!"

Teacher: (뒤돌아서서) "Green light, green light, green light... STOP!" (휙 돌아본다)

Teacher: "Oh, [아이 이름1] is moving! Go back to the line! But [아이 이름2], perfect freeze! Stay there!"

(반복 진행, 점점 아이들이 선생님께 가까워지도록)

Teacher: "Whoever touches Teacher first wins! Green light... STOP! Wow, [아이 이름3] touched me! You win!"`,
  ),
  game(
    "simon-says", "사이먼 가라사대", "Simon Says", "medium", 3, "없음",
    `Teacher: "Listen carefully! If Teacher says 'Simon says', you do the action. If Teacher doesn't say it, don't move!"

Teacher: "Simon says, touch your nose!" (아이들 코 만지기)

Teacher: "Simon says, jump up high!" (아이들 점프)

Teacher: "Touch your toes!" (Simon says 없이) — "Oh! [아이 이름1] didn't move, great listening! [아이 이름2], oops, try again next time!"

(속도를 점점 빠르게 하며 5~6회 반복)

Teacher: "Simon says, freeze and smile! Great game, everyone!"`,
  ),
  game(
    "firefighter-mission", "소방관 미션", "Firefighter Mission", "medium", 5, "작은 공·스카프 등, 바구니 1~2개",
    `Teacher: (사이렌 소리를 내며) "Wee-woo! Wee-woo! Emergency! There's a fire in the room! We are brave firefighters!"

Teacher: "Look at the big basket! Pick up the fire (소품), run fast, and throw it in the basket to put out the fire!"

Teacher: "But remember, jump over the line first! Ready? 3, 2, 1, GO!"

(아이들이 소품 주워 바구니에 던져 넣기 반복)

Teacher: "Go, go, go! Nice shot, [아이 이름1]! You are a real firefighter!"

Teacher: "Ten seconds left! Hurry! ...STOP! Look, the fire is out! You are all heroes!"`,
  ),
  game(
    "tail-tag", "꼬리잡기 기차", "Tail Tag", "medium", 4, "스카프 또는 리본",
    `Teacher: "Put the scarf in your pants, like a tail! Look, I have a long tail! Make your tail, friends!"

Teacher: "We are fast monkeys today! Run around the cones. When Teacher comes close, protect your tail! Don't let me take it!"

(선생님이 살금살금 다가가 꼬리를 잡는 시늉)

Teacher: "Oh! I got [아이 이름1]'s tail! But wow, you ran so fast! Great try! Keep your tail, [아이 이름2]!"

Teacher: "Okay, monkeys, stop! Take out your tails. Who still has their tail? Amazing runners!"`,
  ),
  game(
    "treasure-relay", "보물찾기 계주", "Treasure Relay", "medium", 5, "작은 소품 여러 개, 팀 조끼·스카프",
    `Teacher: "We are pirates today! Somewhere in this room, there are hidden treasures! Each team must find and bring back as many treasures as possible!"

Teacher: "Team A, Team B, get ready! One at a time, run and find a treasure, bring it back, and touch the next friend's hand!"

Teacher: "3, 2, 1, GO! Find the treasure! Run, run, run!"

(계주 진행, 팀별 응원 유도)

Teacher: "Wow, Team A found 5 treasures! Team B found 4! So close! Great teamwork, everyone!"`,
  ),
  game(
    "mission-card-draw", "미션 카드 뽑기", "Mission Card Draw", "hard", 5, "동작 그림·글자 미션 카드",
    `Teacher: "Look at this magic box! Inside, there are mission cards. Each card has a fun action! Come and pick one!"

(아이가 카드를 뽑으면)

Teacher: "Oh, [아이 이름1] picked... Jump like a frog 5 times! Let's count together! 1, 2, 3, 4, 5!"

(순서대로 돌아가며 카드 뽑기 반복, 동물 흉내/점프/스트레칭 등 다양한 미션 구성)

Teacher: "Great mission, [아이 이름2]! Who wants to pick the next card?"

Teacher: "Wow, we completed all the missions! Everyone did an amazing job!"`,
  ),
  game(
    "team-point-challenge", "팀 점수 획득전", "Team Point Challenge", "hard", 7, "공·콘 등 미션 소품, 점수판",
    `Teacher: "Today, we have a big challenge! Two teams will complete missions and earn points! The team with the most points wins!"

Teacher: "Mission 1: Throw the ball into the basket! Each ball in the basket is 1 point! Ready? GO!"

(미션 진행 후 점수 집계)

Teacher: "Team A got 3 points! Team B got 4 points! Let's go to Mission 2!"

(2~3개 미션 반복, 매번 점수 누적 발표)

Teacher: "Final score! Team A: 7 points, Team B: 9 points! Great job, both teams! Everyone is a winner today!"`,
  ),
  game(
    "obstacle-relay", "장애물 릴레이", "Obstacle Relay", "hard", 7, "콘, 매트, 후프 등",
    `Teacher: "Look at our obstacle course! First, jump over the cones! Then, crawl under... wait, walk over the mat! Last, jump through the hoop!"

(장애물 코스 시범을 먼저 보여준다)

Teacher: "Everyone, line up! One at a time! Ready? GO!"

(아이들이 순서대로 장애물 통과)

Teacher: "Jump, jump, jump! Now walk carefully on the mat! Last, through the hoop! Wow, [아이 이름1], perfect course!"

Teacher: "Everyone finished the course! Give yourselves a big round of applause!"`,
  ),
  game(
    "cooperative-tower", "협동 탑쌓기", "Cooperative Tower Building", "hard", 6, "콘, 블록, 쿠션 등",
    `Teacher: "Today, we are builders! Together, as one team, we must build the tallest tower using these blocks! But you can only carry one block at a time!"

Teacher: "Run, get a block, and stack it carefully! Ready? GO!"

(아이들이 하나씩 블록을 옮겨 쌓기)

Teacher: "Careful, careful! Don't let it fall! Wow, [아이 이름1] placed that block so gently!"

Teacher: "Look at our tower! It's so tall! We built it together, as a team! Amazing teamwork, everyone!"`,
  ),
];

export const EXPANDED_PREPARATION_VARIANTS = Object.fromEntries(
  EXPANDED_PREPARATION_ACTIVITIES.map(item => [item.id, sameScriptForAllLevels(item.label, item.script)]),
);

export const EXPANDED_GAME_VARIANTS = Object.fromEntries(
  EXPANDED_GAME_ACTIVITIES.map(item => [item.id, sameScriptForAllLevels(item.label, item.script)]),
);
