import { useEffect, useMemo, useState } from "react";
import { Printer, RotateCcw, Save } from "lucide-react";

const SPORTS = {
  basketball: {
    label: "농구", english: "BASKETBALL", mark: "B", tone: "orange", background: "/assets/after-school/basketball-plan-bg.png",
    goal: "Build confident ball control, coordination, and teamwork through progressive dribbling, passing, and shooting activities.",
    rows: [
      ["Ball Familiarity", "Basketballs & net", "Explore ball taps, body wraps, and the ready position.", "Hold the ball. / Ready position."],
      ["Dominant-Hand Dribble", "Basketballs & cones", "Practice stationary dribbling and play a dribble-freeze game.", "Dribble the ball. / Keep your head up."],
      ["Both-Hand Control", "Basketballs", "Dribble with the right and left hand, then try a hand-switch game.", "Use both hands. / Nice control!"],
      ["Moving Dribble", "Basketballs & cones", "Walk while dribbling and respond to stop-and-go signals.", "Keep dribbling. / Don't stop!"],
      ["Direction Change", "Basketballs & cones", "Dribble through a zigzag course and change direction with control.", "Go around the cone. / Change direction."],
      ["Low & High Dribble", "Basketballs", "Adjust dribble height and speed while keeping the ball close.", "Dribble low. / Dribble high."],
      ["Passing Basics", "Basketballs", "Practice chest passes and bounce passes with a partner.", "Pass to your partner. / Hands ready."],
      ["Catch & Turn", "Basketballs & markers", "Catch, pivot toward a target, and pass with balanced feet.", "Catch the ball. / Turn and pass."],
      ["Shooting Form", "Basketballs & net", "Aim from close range and practice a balanced shooting motion.", "Aim at the hoop. / Bend your knees."],
      ["Dribble & Shoot", "Basketballs, cones & net", "Complete a short dribble course, stop safely, and shoot.", "Dribble, stop, and shoot."],
      ["Team Relay", "Basketballs & cones", "Take turns in a dribbling relay and encourage teammates.", "Take turns. / Cheer for your team."],
      ["Mini Basketball", "Basketballs & net", "Review key skills through stations and a friendly mini game.", "Play together. / Great teamwork!"],
    ],
  },
  soccer: {
    label: "축구", english: "SOCCER", mark: "S", tone: "green", background: "/assets/after-school/soccer-plan-bg.png",
    goal: "Develop foot-eye coordination, directional control, and cooperative play through progressive dribbling, passing, and shooting challenges.",
    rows: [
      ["Ball Familiarity", "Soccer balls", "Explore gentle taps, sole stops, and moving safely around the ball.", "Touch the ball. / Stop the ball."],
      ["Inside-Foot Dribble", "Soccer balls & cones", "Use small inside-foot touches to move through open space.", "Small touches. / Keep it close."],
      ["Stop & Control", "Soccer balls", "Move on a signal and stop the ball under the sole.", "Stop the ball. / Ready!"],
      ["Direction Change", "Soccer balls & cones", "Turn around markers and guide the ball in a new direction.", "Turn around. / Change direction."],
      ["Passing Basics", "Soccer balls & markers", "Pass with the inside of the foot toward a partner's target.", "Pass to me. / Nice pass!"],
      ["Receive & Trap", "Soccer balls", "Cushion an incoming pass and prepare the next movement.", "Receive the ball. / Soft touch."],
      ["Shooting Basics", "Soccer balls & mini goal", "Plant the non-kicking foot and shoot toward a wide target.", "Aim at the goal. / Kick the ball."],
      ["Dribble & Shoot", "Soccer balls, cones & goal", "Dribble through a short lane before taking a controlled shot.", "Dribble and shoot. / Great goal!"],
      ["Cone Course", "Soccer balls & cones", "Navigate turns, gates, and stopping zones with the ball.", "Go through the gate. / Slow down."],
      ["Partner Challenge", "Soccer balls & markers", "Pass, move to a new space, and receive with a partner.", "Pass and move. / I'm ready."],
      ["Team Relay", "Soccer balls & cones", "Complete a team dribbling relay with careful turns.", "Take turns. / Go, team!"],
      ["Mini Soccer", "Soccer balls & mini goals", "Review dribbling, passing, and shooting in a friendly game.", "Play together. / Good teamwork!"],
    ],
  },
  jump_rope: {
    label: "줄넘기", english: "JUMP ROPE", mark: "J", tone: "blue", background: "/assets/after-school/jump-rope-plan-bg.png",
    goal: "Strengthen rhythm, bilateral coordination, stamina, and body control through step-by-step rope handling and jumping challenges.",
    rows: [
      ["Rope Safety & Grip", "Individual ropes", "Learn safe spacing, correct grip, and ready position.", "Hold the handles. / Give me space."],
      ["Rope Shapes", "Individual ropes", "Make lines and shapes, then step and jump over a still rope.", "Step over. / Jump over."],
      ["Swing & Step", "Individual ropes", "Swing the rope beside the body and match each swing with a step.", "Swing and step. / Keep the rhythm."],
      ["First Jump", "Individual ropes", "Bring the rope forward, pause, and jump over it with two feet.", "Rope over. / Jump together."],
      ["Continuous Jumps", "Individual ropes", "Connect small two-foot jumps at a comfortable pace.", "Keep jumping. / Nice rhythm!"],
      ["Forward & Back", "Ropes & floor line", "Jump forward and backward across a rope or floor line.", "Jump forward. / Jump back."],
      ["Side-to-Side", "Ropes & markers", "Practice controlled side jumps while maintaining balance.", "Side to side. / Stay balanced."],
      ["Speed Control", "Individual ropes", "Compare slow and quick turns while keeping steady form.", "Slow turns. / Quick turns."],
      ["Partner Rope", "Ropes", "Work with a partner on mirror swings and shared rhythm games.", "Together. / Your turn."],
      ["Long-Rope Entry", "Long rope", "Watch the rope, enter on a signal, and jump in the center.", "Watch the rope. / Go now!"],
      ["Rhythm Challenge", "Ropes & music", "Follow simple beat changes and movement commands.", "Follow the beat. / Freeze!"],
      ["Skill Circuit", "Ropes & markers", "Review rope handling and jumping skills in a celebration circuit.", "Choose a challenge. / Well done!"],
    ],
  },
};

const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

function expandedActivity(activity, sport, index) {
  const text = String(activity || "").trim();
  if (text.length > 105) return text;
  const additions = {
    basketball: [
      "Children repeat the movement at a comfortable pace while learning to keep a stable athletic posture.",
      "Simple signals and playful challenges help children improve control while staying aware of the space around them.",
      "They gradually connect the skill with movement and make confident choices during partner or team practice.",
    ],
    soccer: [
      "Children work at a comfortable pace while learning to keep the ball close and maintain a balanced posture.",
      "Guided signals and target games help children adjust direction, speed, and force with greater control.",
      "They connect the skill with partner and team play while practicing safe movement in shared space.",
    ],
    jump_rope: [
      "Children repeat the movement slowly and discover a steady rhythm that matches their individual ability.",
      "Visual and musical signals help children coordinate the rope, feet, and whole body with greater control.",
      "They combine familiar skills in playful challenges while building stamina and confidence at their own pace.",
    ],
  };
  return `${text} ${additions[sport][index < 4 ? 0 : index < 8 ? 1 : 2]}`;
}

const SPORT_PURPOSES = {
  basketball: [
    "Introduces safe ball handling while developing tactile awareness, bilateral coordination, and a stable ready posture.",
    "Builds hand-eye coordination and wrist control through repeated dominant-hand dribbling at a steady height.",
    "Strengthens coordination on both sides of the body and encourages flexible hand switching with growing confidence.",
    "Develops dynamic balance, visual awareness, and controlled forward movement while maintaining a continuous dribble.",
    "Improves agility and spatial planning as children adjust their body and ball direction around obstacles.",
    "Refines force control, rhythm, and body positioning by changing dribble height without losing possession.",
    "Develops passing accuracy, timing, upper-body control, and cooperative awareness during partner practice.",
    "Strengthens visual tracking, catching readiness, pivot balance, and quick preparation for the next movement.",
    "Builds aiming accuracy, lower-body stability, and coordinated extension through a balanced shooting sequence.",
    "Connects dribbling, controlled stopping, and shooting to improve movement sequencing and decision-making.",
    "Develops speed control, turn-taking, team communication, and confidence in a supportive relay setting.",
    "Integrates ball control, spatial awareness, simple tactics, and teamwork through an age-appropriate mini game.",
  ],
  soccer: [
    "Introduces safe ball exploration while developing foot awareness, balance, and gentle control with both feet.",
    "Builds foot-eye coordination and precise touch control by keeping the ball close during forward movement.",
    "Improves reaction time, sole control, and postural stability through repeated moving and stopping challenges.",
    "Develops agility, directional awareness, and weight shifting while guiding the ball around markers.",
    "Strengthens inside-foot accuracy, force adjustment, and partner communication during short passing activities.",
    "Develops visual tracking, soft receiving skills, and quick body preparation for the next play.",
    "Builds kicking coordination, target awareness, supporting-leg balance, and controlled power toward the goal.",
    "Connects close dribbling with accurate finishing to strengthen planning, timing, and movement control.",
    "Improves spatial awareness, speed adjustment, and obstacle navigation through a varied cone pathway.",
    "Develops pass-and-move timing, cooperative awareness, and confident communication with a partner.",
    "Strengthens agility, endurance, turn-taking, and team encouragement through a controlled dribbling relay.",
    "Integrates dribbling, passing, shooting, simple positioning, and sportsmanship in a friendly mini game.",
  ],
  jump_rope: [
    "Establishes safe spacing and correct grip while building body awareness and confidence with the rope.",
    "Develops spatial awareness, two-foot takeoff, and controlled landing through still-rope stepping and jumping.",
    "Builds bilateral arm coordination and early rhythm by matching a side swing with deliberate footwork.",
    "Introduces the full rope-over-jump sequence while strengthening timing, balance, and safe two-foot landing.",
    "Develops rhythmic consistency, lower-body endurance, and efficient rebound control during connected jumps.",
    "Improves directional balance, leg strength, and spatial control through forward and backward jumping patterns.",
    "Strengthens lateral agility, hip stability, and landing accuracy during side-to-side movement challenges.",
    "Refines pace awareness, cardiovascular control, and rope-turning rhythm by comparing slow and quick speeds.",
    "Develops shared timing, visual attention, communication, and cooperative movement during partner activities.",
    "Builds anticipation, reaction timing, courage, and central body control when entering a moving long rope.",
    "Improves auditory processing, rhythmic response, and movement adaptability through changing musical beats.",
    "Integrates rope control, stamina, coordination, independent choice, and confidence in a progressive skill circuit.",
  ],
};

function preparedRows(sourceRows, sport) {
  return sourceRows.map((row, index) => {
    return [row[0], row[1], expandedActivity(row[2], sport, index), SPORT_PURPOSES[sport][index]];
  });
}

export default function AfterSchoolPlanEditor({ me, month, onMonthChange }) {
  const [sport, setSport] = useState("basketball");
  const selected = SPORTS[sport];
  const storageKey = `gts-after-school-plan:v2:${me?.id || "guest"}:${month}:${sport}`;
  const [goal, setGoal] = useState(selected.goal);
  const [rows, setRows] = useState(selected.rows);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      setGoal(saved?.goal || selected.goal);
      setRows(preparedRows(saved?.rows?.length === 12 ? saved.rows : selected.rows, sport));
    } catch { setGoal(selected.goal); setRows(preparedRows(selected.rows, sport)); }
    setMessage("");
  }, [storageKey, selected, sport]);

  const updateCell = (rowIndex, cellIndex, value) => setRows((current) => current.map((row, index) => index === rowIndex ? row.map((cell, c) => c === cellIndex ? value : cell) : row));
  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify({ goal, rows, updatedAt: new Date().toISOString() }));
    setMessage("이 기기에 임시 저장했습니다.");
  };
  const reset = () => { setGoal(selected.goal); setRows(preparedRows(selected.rows, sport)); setMessage("기본 12회차 내용으로 되돌렸습니다."); };
  const printableRows = useMemo(() => rows.map((row, i) => `<tr><td><b>${String(i + 1).padStart(2, "0")}</b></td><td><strong>${esc(row[0])}</strong></td><td>${esc(row[2])}</td><td>${esc(row[3])}</td></tr>`).join(""), [rows]);

  const printPlan = () => {
    const win = window.open("", "_blank");
    if (!win) return setMessage("팝업을 허용한 뒤 다시 눌러 주세요.");
    win.opener = null;
    const backgroundUrl = new URL(selected.background, window.location.origin).href;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(month.slice(0, 4))} ${esc(selected.english)} LESSON PLAN</title><style>
      @page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{width:297mm;height:210mm}body{margin:0;font-family:Arial,sans-serif;color:#142033;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{width:297mm;height:210mm;padding:6mm 10mm 5mm;background:#fff url('${esc(backgroundUrl)}') center/cover no-repeat;position:relative;overflow:hidden}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--main);padding-bottom:2mm;position:relative}.brand{font-weight:900;font-size:22px;color:var(--main);letter-spacing:.5px}.brand small{display:block;font-size:9.5px;letter-spacing:2px;color:#64748b;margin-top:.5mm}.report{font-size:10.5px;letter-spacing:1.8px;font-weight:700;color:#64748b}.title{text-align:center;margin:2mm 0 1.8mm;position:relative}.title h1{font-size:24px;margin:0;color:#13213a;letter-spacing:.8px}.goal{display:grid;grid-template-columns:38mm 1fr;align-items:center;border:1px solid var(--line);border-left:4px solid var(--main);border-radius:3mm;background:rgba(255,255,255,.94);padding:1.4mm 4mm;margin-bottom:1.8mm;font-size:10.6px;line-height:1.18}.goal b{color:var(--main);letter-spacing:1px}.plan{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid var(--line);border-radius:3mm;overflow:hidden;background:rgba(255,255,255,.95)}.plan th{height:6.5mm;background:var(--main);color:#fff;font-size:10px;letter-spacing:.9px}.plan th:nth-child(1){width:16mm}.plan th:nth-child(2){width:47mm}.plan th:nth-child(3){width:128mm}.plan th:nth-child(4){width:83mm}.plan td{height:12mm;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:.8mm 1.8mm;font-size:9.75px;line-height:1.14;vertical-align:middle}.plan tr:last-child td{border-bottom:0}.plan td:last-child{border-right:0}.plan tbody tr:nth-child(even){background:var(--pale)}.plan td:first-child{text-align:center;color:var(--main)}.plan td:first-child b{display:block;font-size:12px}.plan td:nth-child(2){text-align:center}.plan td:nth-child(2) strong{display:block;font-size:10.2px}.foot{text-align:center;font-size:8.8px;color:#7b8798;margin-top:1.2mm;font-style:italic}
      .orange{--main:#e76f28;--soft:#fde4d2;--pale:#fff9f4;--line:#f2c9ad}.green{--main:#168653;--soft:#d9f3e4;--pale:#f5fbf7;--line:#b9ddc8}.blue{--main:#4263bd;--soft:#dfe7ff;--pale:#f6f8ff;--line:#c5d0ef}
    </style></head><body><main class="sheet ${selected.tone}"><div class="head"><div class="brand">GTS<small>GROW THROUGH SPORTS</small></div><div class="report">AFTER-SCHOOL SPORTS PROGRAM</div></div><div class="title"><h1>${esc(month.slice(0, 4))} ${esc(selected.english)} LESSON PLAN</h1></div><div class="goal"><b>PROGRAM GOAL</b><span>${esc(goal)}</span></div><table class="plan"><thead><tr><th>WEEK</th><th>SKILL FOCUS</th><th>ACTIVITY</th><th>PURPOSE</th></tr></thead><tbody>${printableRows}</tbody></table><div class="foot">This plan may be adjusted according to the class environment and children's progress.</div></main><script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    win.document.close();
  };

  return <section className={`after-school-editor after-school-editor--${selected.tone}`}>
    <header className="after-school-editor__header">
      <div><span className="after-school-editor__eyebrow">AFTER-SCHOOL SPORTS PROGRAM</span><h2>방과후 12회차 계획안</h2><p>종목별 계획안을 수정하고 A4 한 페이지로 인쇄하거나 PDF로 저장할 수 있습니다.</p></div>
      <div className="after-school-editor__actions">
        <input type="month" value={month} onChange={(e) => onMonthChange(e.target.value)} />
        <button type="button" onClick={reset}><RotateCcw size={16}/>초기화</button>
        <button type="button" onClick={save}><Save size={16}/>임시 저장</button>
        <button type="button" className="is-primary" onClick={printPlan}><Printer size={16}/>PDF·인쇄</button>
      </div>
    </header>
    <div className="after-school-editor__sports" role="tablist">
      {Object.entries(SPORTS).map(([id, item]) => <button key={id} type="button" className={`${item.tone}${sport === id ? " is-active" : ""}`} onClick={() => setSport(id)}><span>{item.mark}</span><b>{item.label}</b><small>{item.english} · 12회</small></button>)}
    </div>
    {message ? <div className="after-school-editor__message">{message}</div> : null}
    <div className="after-school-editor__goal"><label>PROGRAM GOAL</label><textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2}/></div>
    <div className="after-school-editor__table-wrap"><table className="after-school-editor__table"><thead><tr><th>WEEK</th><th>SKILL FOCUS</th><th>ACTIVITY</th><th>PURPOSE</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td><b>{String(index + 1).padStart(2, "0")}</b></td>{[0, 2, 3].map((cellIndex) => <td key={cellIndex}><textarea value={row[cellIndex]} onChange={(e) => updateCell(index, cellIndex, e.target.value)} rows={3}/></td>)}</tr>)}</tbody></table></div>
  </section>;
}
