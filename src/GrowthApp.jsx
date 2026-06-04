import { useState, useEffect, useRef } from "react";

// ╔══════════════════════════════════════════════════════╗
// ║  GTS 성장 기록 시스템                                  ║
// ╚══════════════════════════════════════════════════════╝
const GTS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSYwNzNr44XHkVecI0rEvuk609LtzihybGXd52v59q340NtKvUNrFoQ6nr7iigd3FG4w/exec";

// ── Sheets API 함수 ───────────────────────────────────────
async function GTS_fetchLatest(name, birthDate) {
  if (!GTS_SCRIPT_URL || !name || !birthDate) return null;
  const url = `${GTS_SCRIPT_URL}?action=getLatestRecord&name=${encodeURIComponent(name)}&birthDate=${encodeURIComponent(birthDate)}`;
  try {
    const res  = await fetch(url);
    const json = await res.json();
    if (json.result === "found") {
      return { data: json.data, nextSession: json.nextSession || 2 };
    }
    return { data: null, nextSession: 1 };
  } catch { return null; }
}

async function GTS_saveSheets(payload) {
  if (!GTS_SCRIPT_URL) return { skipped: true };
  try {
    const res = await fetch(GTS_SCRIPT_URL, {
      method: "POST",
      body:   JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) { return { result: "error", message: err.message }; }
}

// ══════════════════════════════════════════════════════════
//  GTS 브랜드 토큰
// ══════════════════════════════════════════════════════════
const GTS_G = {
  green:     "#2D9E57",
  greenDark: "#1A7A3C",
  greenLight:"#E8F5EE",
  greenMid:  "#4CAF50",
  yellow:    "#F9C846",
  orange:    "#F97316",
  blue:      "#60A5FA",
  gray:      "#6B7280",
  white:     "#FFFFFF",
  text:      "#1F2937",
  textSub:   "#6B7280",
};

function GTS_getGrowthStatus(curr, prev, lb) {
  if (!curr || curr === "") return "none";
  if (!prev || prev === "") return "first";
  const diff = parseFloat(curr) - parseFloat(prev);
  if (isNaN(diff)) return "first";
  if (lb)  return diff < -0.5 ? "up" : diff > 0.5 ? "down" : "same";
  else     return diff >  0.5 ? "up" : diff < -0.5 ? "down" : "same";
}

const GTS_STATUS = {
  up:    { emoji:"🌱", color:GTS_G.green,  bg:"#E8F5EE", text:"향상됐어요!" },
  same:  { emoji:"⭐", color:"#F59E0B",    bg:"#FFFBEB", text:"잘 유지하고 있어요" },
  down:  { emoji:"💪", color:GTS_G.orange, bg:"#FFF7ED", text:"다음엔 더 잘할 수 있어요" },
  first: { emoji:"📍", color:GTS_G.blue,   bg:"#EFF6FF", text:"첫 번째 기록이에요" },
  none:  { emoji:"—",  color:"#D1D5DB",    bg:"#F9FAFB", text:"측정 전" },
};

const GTS_ITEMS = [
  { key:"height",      label:"키",        en:"Height",      unit:"cm", icon:"📏", lb:false },
  { key:"weight",      label:"몸무게",    en:"Weight",      unit:"kg", icon:"⚖️",  lb:false },
  { key:"flexibility", label:"유연성",    en:"Flexibility", unit:"cm", icon:"🤸", lb:false },
  { key:"balance",     label:"균형 잡기", en:"Balance",     unit:"초", icon:"🦩", lb:false },
  { key:"agility",     label:"민첩성",    en:"Agility",     unit:"초", icon:"⚡", lb:true  },
  { key:"jump",        label:"점프력",    en:"Jump",        unit:"cm", icon:"🦘", lb:false },
  { key:"throw",       label:"던지기",    en:"Throwing",    unit:"m",  icon:"🎯", lb:false },
];

const GTS_BEHAVIOR = [
  { key:"participation", label:"참여도", en:"Participation", icon:"🙋", desc:"수업에 얼마나 적극적으로 참여하나요?" },
  { key:"confidence",    label:"자신감", en:"Confidence",    icon:"💪", desc:"새로운 동작에 도전하는 자세" },
  { key:"social",        label:"사회성", en:"Social Skills", icon:"🤝", desc:"친구·선생님과의 관계" },
];

const GTS_BEHAVIOR_OPTIONS = [
  { value:"A", label:"항상 적극적이에요",      emoji:"🌟", color:GTS_G.green  },
  { value:"B", label:"대체로 잘 해요",         emoji:"😊", color:GTS_G.blue   },
  { value:"C", label:"조금씩 나아지고 있어요",  emoji:"🌱", color:GTS_G.yellow },
  { value:"D", label:"따뜻한 응원이 필요해요",  emoji:"💛", color:GTS_G.orange },
];

function GTS_calcAge(b) {
  if (!b) return 5;
  const t = new Date(), d = new Date(b);
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth()-d.getMonth()<0||(t.getMonth()===d.getMonth()&&t.getDate()<d.getDate())) a--;
  return a;
}

function GTS_getDiff(curr, prev) {
  if (!curr||!prev||curr===""||prev==="") return null;
  const d = parseFloat(curr)-parseFloat(prev);
  return isNaN(d) ? null : d;
}

function GTS_generateGrowthMemo(curr, prev, behaviors) {
  const improved = GTS_ITEMS.filter(i=>GTS_getGrowthStatus(curr[i.key],prev?.[i.key],i.lb)==="up").map(i=>i.label);
  const same     = GTS_ITEMS.filter(i=>GTS_getGrowthStatus(curr[i.key],prev?.[i.key],i.lb)==="same").map(i=>i.label);
  const isFirst  = !prev || GTS_ITEMS.every(i=>!prev[i.key]||prev[i.key]==="");
  const goodBehavior = behaviors.participation==="A"||behaviors.confidence==="A";
  if (isFirst) return "오늘은 우리 아이의 첫 번째 성장 기록을 남긴 날이에요. 앞으로 GTS와 함께 균형, 민첩성, 유연성이 어떻게 자라나는지 차근차근 기록해볼게요. 🌱";
  if (improved.length >= 3) return `지난 기록보다 ${improved.slice(0,3).join(", ")} 등 여러 영역이 좋아졌어요. 움직임에 자신감이 쑥쑥 생기고 있는 것 같아 정말 기뻐요! ${goodBehavior?"수업에도 적극적으로 참여해줘서 더 빛났답니다.":""}`;
  if (improved.length > 0) return `지난 기록보다 ${improved.join("과 ")}에서 성장이 느껴졌어요. 꾸준히 도전하는 모습이 정말 멋져요. ${same.length>0?"나머지 항목도 안정적으로 유지되고 있어요.":""}`;
  if (same.length >= 3) return "이번 기록은 전반적으로 안정적으로 유지되고 있어요. 꾸준함도 성장이랍니다! 다음 수업에서도 즐겁게 함께 도전해봐요. 😊";
  return "이번 검사에서도 최선을 다해줘서 고마워요. 작은 변화들이 쌓여 큰 성장이 된답니다. 앞으로도 GTS와 함께 즐겁게 움직여요! 💚";
}

function GTS_generateComment(curr, prev, info, behaviors) {
  const name = info.studentName || "아이";
  const age  = GTS_calcAge(info.birthDate);
  const improved = GTS_ITEMS.filter(i=>GTS_getGrowthStatus(curr[i.key],prev?.[i.key],i.lb)==="up").map(i=>i.label);
  const heightDiff = GTS_getDiff(curr.height, prev?.height);
  const growthNote = heightDiff&&heightDiff>0 ? `이번 검사에서 ${name}이(가) 지난 검사보다 키가 ${heightDiff.toFixed(1)}cm 자랐어요! ` : "";
  return [
    `${name}이(가) 이번 성장 검사에 참여해주었어요. 만 ${age}세의 ${name}이(가) 정말 열심히 해줬답니다! 🌟`,
    growthNote,
    improved.length>0 ? `특히 ${improved.slice(0,3).join(", ")} 영역에서 지난 검사보다 더 잘해냈어요. 꾸준히 성장하고 있는 모습이 정말 멋져요!` : "이번 검사에서도 최선을 다해 참여해주었어요.",
    behaviors.participation==="A"||behaviors.participation==="B" ? "수업 시간에 적극적으로 참여하는 모습이 인상적이었어요." : "앞으로도 즐겁게 함께 수업해요!",
    "앞으로도 GTS와 함께 즐겁게 움직이며 건강하게 성장해나가길 응원해요! 💚",
  ].filter(Boolean).join(" ");
}

function GTS_GrowthFlower({ curr, prev }) {
  const keys   = ["flexibility","balance","agility","jump","throw"];
  const labels = ["유연성","균형","민첩성","점프","던지기"];
  const cx=110, cy=110, r=80, n=keys.length;
  const maxMap = {flexibility:30,balance:60,agility:15,jump:200,throw:30};
  const getVal = (key,session) => {
    if (!session?.[key]||session[key]==="") return 0;
    const item=GTS_ITEMS.find(i=>i.key===key);
    const v=parseFloat(session[key]), max=maxMap[key]||100;
    return item?.lb ? Math.max(0,Math.min(1,(max-v)/max*1.5)) : Math.max(0,Math.min(1,v/max));
  };
  const mkPts = s => keys.map((k,i)=>{
    const a=(i*2*Math.PI)/n-Math.PI/2, pct=getVal(k,s);
    return {x:cx+r*pct*Math.cos(a), y:cy+r*pct*Math.sin(a)};
  });
  const currPts=mkPts(curr), prevPts=prev?mkPts(prev):null;
  return(
    <svg viewBox="0 0 220 220" style={{width:"100%",maxWidth:200,margin:"0 auto",display:"block"}}>
      <defs><radialGradient id="gf" cx="50%" cy="50%"><stop offset="0%" stopColor={GTS_G.green} stopOpacity="0.25"/><stop offset="100%" stopColor={GTS_G.green} stopOpacity="0.05"/></radialGradient></defs>
      {[0.25,0.5,0.75,1].map(lv=>{
        const gp=keys.map((_,i)=>{const a=(i*2*Math.PI)/n-Math.PI/2;return`${cx+r*lv*Math.cos(a)},${cy+r*lv*Math.sin(a)}`;}).join(" ");
        return<polygon key={lv} points={gp} fill="none" stroke={lv===1?"rgba(45,158,87,0.2)":"#f0f0f0"} strokeWidth={lv===1?1.5:0.8}/>;
      })}
      {keys.map((_,i)=>{const a=(i*2*Math.PI)/n-Math.PI/2;return<line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)} stroke="#f0f0f0" strokeWidth="0.8"/>;})}
      {prevPts&&<polygon points={prevPts.map(p=>`${p.x},${p.y}`).join(" ")} fill="rgba(249,200,70,0.15)" stroke={GTS_G.yellow} strokeWidth="1.5" strokeDasharray="4 3"/>}
      <polygon points={currPts.map(p=>`${p.x},${p.y}`).join(" ")} fill="url(#gf)" stroke={GTS_G.green} strokeWidth="2.5" strokeLinejoin="round"/>
      {currPts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4" fill={GTS_G.green} stroke="#fff" strokeWidth="1.5"/>)}
      {keys.map((k,i)=>{
        const a=(i*2*Math.PI)/n-Math.PI/2;
        const st=GTS_getGrowthStatus(curr[k],prev?.[k],GTS_ITEMS.find(it=>it.key===k)?.lb);
        return(<g key={i}>
          <text x={cx+(r+18)*Math.cos(a)} y={cy+(r+18)*Math.sin(a)-5} textAnchor="middle" dominantBaseline="central" style={{fontSize:9,fill:"#555",fontFamily:"sans-serif",fontWeight:700}}>{labels[i]}</text>
          <text x={cx+(r+18)*Math.cos(a)} y={cy+(r+18)*Math.sin(a)+7} textAnchor="middle" dominantBaseline="central" style={{fontSize:9}}>{GTS_STATUS[st]?.emoji||""}</text>
        </g>);
      })}
    </svg>
  );
}

function GTS_GrowthBar({ curr, prev, max, lb }) {
  const cp=curr&&curr!==""?Math.min(100,(parseFloat(curr)||0)/max*100*(lb?0.8:1)):0;
  const pp=prev&&prev!==""?Math.min(100,(parseFloat(prev)||0)/max*100*(lb?0.8:1)):0;
  const color=GTS_STATUS[GTS_getGrowthStatus(curr,prev,lb)]?.color||"#D1D5DB";
  return(<div style={{position:"relative",height:8,background:"#F3F4F6",borderRadius:4,overflow:"hidden"}}>
    {prev&&prev!==""&&<div style={{position:"absolute",left:0,top:0,width:`${pp}%`,height:"100%",background:"rgba(249,200,70,0.4)",borderRadius:4}}/>}
    <div style={{position:"absolute",left:0,top:0,width:`${cp}%`,height:"100%",background:color,borderRadius:4,transition:"width 0.8s"}}/>
  </div>);
}

function GTS_GrowthBadge({ curr, prev, unit, lb }) {
  if (!curr||curr==="") return <span style={{color:"#D1D5DB",fontSize:10}}>—</span>;
  const d=GTS_getDiff(curr,prev);
  if (d===null) return <span style={{fontSize:10,color:GTS_G.blue,fontWeight:600}}>첫 기록 📍</span>;
  const improved=lb?d<0:d>0, same=Math.abs(d)<=0.5;
  if (same) return <span style={{fontSize:10,color:"#F59E0B",fontWeight:600}}>⭐ 유지</span>;
  return(<span style={{display:"inline-flex",alignItems:"center",gap:2,background:improved?GTS_G.greenLight:"#FFF7ED",color:improved?GTS_G.green:GTS_G.orange,borderRadius:6,padding:"1px 8px",fontSize:10,fontWeight:700}}>
    {improved?"🌱 +":"💪 "}{improved?`${Math.abs(d).toFixed(1)}${unit} 향상`:`${Math.abs(d).toFixed(1)}${unit} 변화`}
  </span>);
}

function GTSReportPage({ curr, prev, info, behaviors, comment, growthMemo }) {
  const age=GTS_calcAge(info.birthDate);
  const today=new Date();
  const dateStr=`${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;
  const improvedCount=GTS_ITEMS.filter(i=>GTS_getGrowthStatus(curr[i.key],prev?.[i.key],i.lb)==="up").length;
  const sameCount=GTS_ITEMS.filter(i=>GTS_getGrowthStatus(curr[i.key],prev?.[i.key],i.lb)==="same").length;
  const maxMap={height:170,weight:80,flexibility:30,balance:60,agility:15,jump:200,throw:30};
  return(
    <div style={{fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",background:"#fff",width:"210mm",minHeight:"297mm",margin:"0 auto",color:GTS_G.text,fontSize:12,lineHeight:1.5}}>
      <div style={{background:`linear-gradient(135deg,${GTS_G.greenDark} 0%,${GTS_G.green} 60%,${GTS_G.greenMid} 100%)`,padding:"20px 26px 16px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-20,width:130,height:130,borderRadius:"50%",background:"rgba(255,255,255,0.06)"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{background:"#fff",borderRadius:6,padding:"3px 10px"}}><span style={{fontSize:16,fontWeight:900,color:GTS_G.greenDark,letterSpacing:1}}>GTS</span></div>
              <span style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.95)"}}>우리 아이 성장 기록</span>
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.8)"}}>운동을 통해 성장하는 {info.studentName||"아이"}의 이야기 🌱</div>
            {info.studentId&&<div style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginTop:2}}>ID: {info.studentId}</div>}
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginBottom:2}}>검사일</div>
            <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{info.examDate||dateStr}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:4}}>{info.branch} · {info.program}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>담당: {info.teacher}</div>
          </div>
        </div>
        <div style={{marginTop:14,display:"flex",gap:8}}>
          {improvedCount>0&&<div style={{background:"rgba(255,255,255,0.18)",borderRadius:20,padding:"5px 14px",fontSize:11,fontWeight:600,color:"#fff"}}>🌱 {improvedCount}개 항목 향상</div>}
          {sameCount>0&&<div style={{background:"rgba(255,255,255,0.12)",borderRadius:20,padding:"5px 14px",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.85)"}}>⭐ {sameCount}개 항목 유지</div>}
          {!prev&&<div style={{background:"rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 14px",fontSize:11,fontWeight:600,color:"#fff"}}>📍 첫 번째 성장 기록</div>}
        </div>
      </div>
      <div style={{padding:"14px 26px 0",display:"flex",gap:16}}>
        <div style={{flex:"0 0 185px",border:"1.5px solid #E8F5EE",borderRadius:10,padding:"14px",background:"#FAFFFE"}}>
          <div style={{fontSize:11,color:GTS_G.green,fontWeight:700,marginBottom:10}}>👶 아이 정보</div>
          {[["이름",info.studentName||"-"],["생년월일",info.birthDate||"-"],["만 나이",`${age}세`],["성별",info.gender==="남자"?"남자 🚀":"여자 🌸"],["기관",info.school||info.branch||"-"],["선생님",info.teacher||"-"]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:5,paddingBottom:5,borderBottom:"1px solid #F0FFF4",fontSize:11}}>
              <span style={{color:"#9CA3AF"}}>{l}</span><span style={{fontWeight:600,color:GTS_G.text}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{flex:"0 0 200px"}}>
          <div style={{fontSize:11,color:GTS_G.green,fontWeight:700,marginBottom:8}}>🌸 성장 변화 모습</div>
          <div style={{border:"1.5px solid #E8F5EE",borderRadius:10,padding:"8px",background:"#FAFFFE"}}>
            <GTS_GrowthFlower curr={curr} prev={prev}/>
            <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:6}}>
              <div style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:GTS_G.green}}><div style={{width:12,height:2,background:GTS_G.green,borderRadius:1}}/> 이번</div>
              {prev&&<div style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:GTS_G.yellow}}><div style={{width:12,height:2,background:GTS_G.yellow,borderRadius:1}}/> 이전</div>}
            </div>
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:GTS_G.green,fontWeight:700,marginBottom:8}}>📊 이번 검사 한눈에 보기</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {[{label:"키",val:curr.height,unit:"cm",prev:prev?.height,lb:false},{label:"몸무게",val:curr.weight,unit:"kg",prev:prev?.weight,lb:false}].map(({label,val,unit,prev:p,lb})=>{
              const st=GTS_STATUS[GTS_getGrowthStatus(val,p,lb)];
              return(<div key={label} style={{flex:1,border:`1.5px solid ${GTS_getGrowthStatus(val,p,lb)==="up"?GTS_G.green:"#E5E7EB"}`,borderRadius:10,padding:"10px",textAlign:"center",background:GTS_getGrowthStatus(val,p,lb)==="up"?GTS_G.greenLight:"#FAFAFA"}}>
                <div style={{fontSize:10,color:"#9CA3AF",marginBottom:3}}>{label}</div>
                <div style={{fontSize:20,fontWeight:900,color:GTS_G.text,lineHeight:1}}>{val||"-"}<span style={{fontSize:11,color:"#9CA3AF",fontWeight:400}}>{unit}</span></div>
                <div style={{marginTop:6}}><GTS_GrowthBadge curr={val} prev={p} unit={unit} lb={lb}/></div>
              </div>);
            })}
          </div>
          <div style={{background:GTS_G.greenLight,border:`1.5px solid #BBE8CA`,borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,fontWeight:700,color:GTS_G.greenDark,marginBottom:6}}>💬 오늘의 성장 한마디</div>
            <div style={{fontSize:11,color:GTS_G.greenDark,lineHeight:1.8}}>{growthMemo}</div>
          </div>
        </div>
      </div>
      <div style={{padding:"14px 26px 0"}}>
        <div style={{fontSize:11,color:GTS_G.green,fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          <span style={{background:GTS_G.green,color:"#fff",borderRadius:"50%",width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>1</span>
          신체 성장 기록
        </div>
        <div style={{border:"1.5px solid #E8F5EE",borderRadius:10,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 1fr 90px",background:"#E8F5EE",padding:"7px 14px",fontSize:10,fontWeight:700,color:GTS_G.greenDark}}>
            <span>항목</span><span style={{textAlign:"center"}}>이전</span><span style={{textAlign:"center"}}>지금</span><span style={{padding:"0 8px"}}>변화 흐름</span><span style={{textAlign:"center"}}>성장 메시지</span>
          </div>
          {GTS_ITEMS.map((item,idx)=>{
            const st=GTS_STATUS[GTS_getGrowthStatus(curr[item.key],prev?.[item.key],item.lb)];
            const diff=GTS_getDiff(curr[item.key],prev?.[item.key]);
            return(<div key={item.key} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 1fr 90px",padding:"8px 14px",alignItems:"center",background:idx%2===0?"#fff":"#FAFFFE",borderTop:"1px solid #E8F5EE"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:16}}>{item.icon}</span>
                <div><div style={{fontSize:11,fontWeight:600}}>{item.label}</div><div style={{fontSize:9,color:"#9CA3AF"}}>{item.en}</div></div>
              </div>
              <div style={{textAlign:"center",fontSize:11,color:"#9CA3AF"}}>{prev?.[item.key]||<span style={{color:"#E5E7EB"}}>—</span>}{prev?.[item.key]&&<span style={{fontSize:9,color:"#C4C4C4"}}>{item.unit}</span>}</div>
              <div style={{textAlign:"center",fontSize:12,fontWeight:700,color:curr[item.key]?GTS_G.text:"#E5E7EB"}}>{curr[item.key]||"—"}{curr[item.key]&&<span style={{fontSize:9,color:"#9CA3AF",fontWeight:400}}>{item.unit}</span>}</div>
              <div style={{padding:"0 8px"}}>
                <GTS_GrowthBar curr={curr[item.key]} prev={prev?.[item.key]} max={maxMap[item.key]||100} lb={item.lb}/>
                <div style={{fontSize:9,color:"#C4C4C4",marginTop:2,display:"flex",justifyContent:"space-between"}}><span>이전</span><span>지금</span></div>
              </div>
              <div style={{textAlign:"center"}}>
                {curr[item.key]&&<div style={{display:"inline-flex",alignItems:"center",gap:3,background:st.bg,borderRadius:6,padding:"2px 7px"}}>
                  <span style={{fontSize:11}}>{st.emoji}</span>
                  <span style={{fontSize:9,color:st.color,fontWeight:600}}>{diff!==null?(Math.abs(diff)<=0.5?"유지":diff>0?(item.lb?"빨라졌어요":"늘었어요"):(item.lb?"느려졌어요":"줄었어요")):"첫 기록"}</span>
                </div>}
              </div>
            </div>);
          })}
        </div>
      </div>
      <div style={{padding:"14px 26px 0"}}>
        <div style={{fontSize:11,color:GTS_G.green,fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          <span style={{background:GTS_G.green,color:"#fff",borderRadius:"50%",width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>2</span>
          마음 성장 기록 <span style={{fontSize:9,color:"#9CA3AF",fontWeight:400}}>참여도 · 자신감 · 사회성</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {GTS_BEHAVIOR.map(beh=>{
            const val=behaviors[beh.key];
            const opt=GTS_BEHAVIOR_OPTIONS.find(o=>o.value===val)||GTS_BEHAVIOR_OPTIONS[1];
            return(<div key={beh.key} style={{border:`1.5px solid ${opt.color}22`,borderRadius:10,padding:"14px",background:`${opt.color}08`,textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>{beh.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:GTS_G.text,marginBottom:2}}>{beh.label}</div>
              <div style={{fontSize:9,color:"#9CA3AF",marginBottom:10}}>{beh.desc}</div>
              <div style={{display:"inline-flex",alignItems:"center",gap:5,background:opt.color+"18",borderRadius:20,padding:"5px 12px"}}>
                <span style={{fontSize:14}}>{opt.emoji}</span>
                <span style={{fontSize:10,color:opt.color,fontWeight:700}}>{opt.label}</span>
              </div>
              <div style={{marginTop:10,height:4,background:"#F3F4F6",borderRadius:2,overflow:"hidden"}}>
                <div style={{width:val==="A"?"100%":val==="B"?"72%":val==="C"?"45%":"20%",height:"100%",background:opt.color,borderRadius:2}}/>
              </div>
            </div>);
          })}
        </div>
      </div>
      <div style={{padding:"14px 26px 0"}}>
        <div style={{fontSize:11,color:GTS_G.green,fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          <span style={{background:GTS_G.green,color:"#fff",borderRadius:"50%",width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>3</span>
          🏠 집에서 함께해요!
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{icon:"🦩",title:"균형 감각 키우기",items:["한발 서기 놀이","30초 도전!","눈 감고 서보기"]},{icon:"🦘",title:"점프력 키우기",items:["제자리 점프 놀이","멀리뛰기 라인 그리기","계단 오르내리기"]},{icon:"🤸",title:"유연성 키우기",items:["아침 스트레칭","요가 놀이","앞으로 굽히기"]}].map(({icon,title,items})=>(
            <div key={title} style={{border:"1.5px solid #E8F5EE",borderRadius:9,padding:"10px 12px",background:"#FAFFFE",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:3}}>{icon}</div>
              <div style={{fontSize:10,fontWeight:700,color:GTS_G.greenDark,marginBottom:6}}>{title}</div>
              {items.map(i=><div key={i} style={{fontSize:9,color:GTS_G.text,padding:"2px 0",borderTop:"1px solid #E8F5EE"}}>✓ {i}</div>)}
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"14px 26px 0"}}>
        <div style={{fontSize:11,color:GTS_G.green,fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          <span style={{background:GTS_G.green,color:"#fff",borderRadius:"50%",width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>4</span>
          💌 선생님 한마디
        </div>
        <div style={{border:"1.5px solid #E8F5EE",borderLeft:`4px solid ${GTS_G.green}`,borderRadius:"0 10px 10px 0",padding:"14px 18px",background:"#FAFFFE"}}>
          <div style={{fontSize:11,color:GTS_G.text,lineHeight:1.9}}>{comment}</div>
        </div>
      </div>
      <div style={{margin:"14px 26px 0",paddingTop:12,paddingBottom:20,borderTop:"1px solid #E8F5EE",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:9,color:"#C4C4C4",lineHeight:1.7}}>※ 본 리포트는 아이의 건강한 성장을 돕기 위한 참고 자료입니다.</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{background:GTS_G.greenDark,borderRadius:5,padding:"3px 10px"}}><span style={{fontSize:12,fontWeight:900,color:"#fff",letterSpacing:1}}>GTS</span></div>
          <span style={{fontSize:10,fontWeight:700,color:GTS_G.green}}>우리 아이 성장 기록</span>
        </div>
      </div>
    </div>
  );
}

const GTS_EMPTY_M = { height:"",weight:"",flexibility:"",balance:"",agility:"",jump:"",throw:"" };
const GTS_EMPTY_B = { participation:"A",confidence:"A",social:"A" };
const GTS_EMPTY_I = { studentId:"",branch:"지티에스",teacher:"",program:"영어체육 (English PE)",school:"",studentName:"",birthDate:"",gender:"남자",examDate:"" };

function mapGrowthBranch(branch) {
  if (!branch) return null;
  const b = branch.replace(/점$/, "");
  const map = { 하남:"한남", 한남:"한남", 청담:"청담", 성동:"지티에스" };
  return map[b] || b;
}

function GTSApp({ onBack, supabaseUser }) {
  const [step,      setStep]      = useState("input");
  const [info,      setInfo]      = useState({...GTS_EMPTY_I});
  const [curr,      setCurr]      = useState({...GTS_EMPTY_M});
  const [prev,      setPrev]      = useState(null);
  const [behaviors, setBehaviors] = useState({...GTS_EMPTY_B});
  const [comment,   setComment]   = useState("");
  const [growthMemo,setGrowthMemo]= useState("");
  const [memo,      setMemo]      = useState("");
  const [isSaving,  setIsSaving]  = useState(false);
  const [fetchStatus, setFetchStatus] = useState("idle");
  const fetchTimer = useRef(null);

  useEffect(() => {
    if (!supabaseUser) return;
    const mapped = mapGrowthBranch(supabaseUser.branch);
    setInfo(p => ({
      ...p,
      teacher: supabaseUser.name || p.teacher,
      ...(mapped ? { branch: mapped } : {}),
    }));
  }, [supabaseUser]);

  // ✅ 수정: nextSession 반영
  useEffect(() => {
    if (!info.studentName || !info.birthDate) return;
    clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      setFetchStatus("loading");
      const result = await GTS_fetchLatest(info.studentName, info.birthDate);
      if (result && result.data) {
        const record = result.data;
        setPrev({
          height:      record.height,
          weight:      record.weight,
          flexibility: record.flexibility,
          balance:     record.balance,
          agility:     record.agility,
          jump:        record.jump,
          throw:       record.throw,
        });
        setInfo(p => ({...p, studentId: record.studentId}));
        setFetchStatus("found");
      } else {
        setPrev(null);
        setFetchStatus("notfound");
      }
    }, 800);
    return () => clearTimeout(fetchTimer.current);
  }, [info.studentName, info.birthDate]);

  const GTS_II = k => ({value:info[k], onChange:e=>setInfo(p=>({...p,[k]:e.target.value}))});
  const IC = k => ({value:curr[k], onChange:e=>setCurr(p=>({...p,[k]:e.target.value}))});

  const inp  = {width:"100%",boxSizing:"border-box",border:"1.5px solid #E5E7EB",borderRadius:8,padding:"9px 12px",fontSize:13,fontFamily:"inherit",background:"#fff",color:GTS_G.text,outline:"none"};
  const lbl  = {fontSize:11,fontWeight:600,color:"#555",marginBottom:5,display:"block"};
  const sec  = {background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:12,padding:"18px 20px",marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"};
  const secT = {fontSize:13,fontWeight:700,color:GTS_G.greenDark,marginBottom:14,paddingBottom:8,borderBottom:`2px solid ${GTS_G.green}`};
  const g2   = {display:"grid",gridTemplateColumns:"1fr 1fr",gap:12};

  async function GTS_handleGenerate() {
    const auto  = GTS_generateComment(curr, prev, info, behaviors);
    const gMemo = GTS_generateGrowthMemo(curr, prev, behaviors);
    const full  = memo ? auto + "\n\n" + memo : auto;
    setComment(full);
    setGrowthMemo(gMemo);
    setStep("report");
    setIsSaving(true);
    const payload = {
      brand:"GTS", studentId:info.studentId||"auto",
      examDate:info.examDate, studentName:info.studentName,
      birthDate:info.birthDate, gender:info.gender,
      branch:info.branch, program:info.program,
      height:curr.height, weight:curr.weight,
      flexibility:curr.flexibility, balance:curr.balance,
      agility:curr.agility, jump:curr.jump, throw:curr.throw,
      participation:behaviors.participation,
      confidence:behaviors.confidence, social:behaviors.social, memo,
    };
    try {
      const result = await GTS_saveSheets(payload);
      if (result?.skipped) { setIsSaving(false); return; }
      if (result?.result === "success") {
        if (result.studentId) setInfo(p=>({...p, studentId: result.studentId}));
        alert("✅ Google Sheets 저장 완료!\n학생: " + info.studentName);
      } else {
        alert("⚠️ 저장 오류: " + (result?.message||"알 수 없는 오류"));
      }
    } catch (err) { alert("❌ 네트워크 오류\n" + err.message); }
    setIsSaving(false);
  }

  const fetchBadge = () => {
    if (fetchStatus==="loading") return <span style={{fontSize:11,color:GTS_G.blue}}>⏳ 이전 기록 불러오는 중...</span>;
    if (fetchStatus==="found")   return <span style={{fontSize:11,color:GTS_G.green,fontWeight:600}}>🌱 지난 기록을 불러왔어요!</span>;
    if (fetchStatus==="notfound") return <span style={{fontSize:11,color:"#9CA3AF"}}>📍 첫 번째 성장 기록입니다</span>;
    return null;
  };

  return(
    <div style={{minHeight:"100vh",background:"#F0FFF4",fontFamily:"'Noto Sans KR',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;900&display=swap');
        @media print{.no-print{display:none!important}body{background:#fff!important;margin:0}.report-wrap{box-shadow:none!important;border-radius:0!important}}
        input:focus,select:focus,textarea:focus{border-color:${GTS_G.green}!important;box-shadow:0 0 0 3px rgba(45,158,87,0.1)!important}
      `}</style>
      <div className="no-print" style={{background:GTS_G.greenDark,padding:"11px 26px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:"#fff",borderRadius:6,padding:"2px 9px"}}><span style={{fontSize:15,fontWeight:900,color:GTS_G.greenDark}}>GTS</span></div>
          <span style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.9)"}}>우리 아이 성장 기록 시스템</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          {onBack&&<button onClick={onBack} style={{padding:"6px 14px",borderRadius:7,border:"1.5px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:500}}>← 홈</button>}
          <button onClick={()=>setStep("input")} style={{padding:"6px 14px",borderRadius:7,border:"1.5px solid rgba(255,255,255,0.3)",background:step==="input"?"rgba(255,255,255,0.15)":"transparent",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:500}}>✏️ 데이터 입력</button>
          <button onClick={GTS_handleGenerate} disabled={isSaving} style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#fff",color:GTS_G.greenDark,fontSize:12,cursor:"pointer",fontWeight:700,opacity:isSaving?0.7:1}}>{isSaving?"저장 중...":"🌱 리포트 생성"}</button>
          {step==="report"&&<button onClick={()=>window.print()} style={{padding:"6px 14px",borderRadius:7,border:"1.5px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:500}}>🖨️ PDF 출력</button>}
        </div>
      </div>
      {step==="input"&&(
        <div className="no-print" style={{maxWidth:700,margin:"0 auto",padding:"24px 16px"}}>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:21,fontWeight:900,color:GTS_G.greenDark,margin:"0 0 4px"}}>성장 검사 데이터 입력</h1>
            <p style={{fontSize:12,color:"#6B7280",margin:0}}>아이 이름과 생년월일을 입력하면 이전 기록을 자동으로 불러와요 💚</p>
          </div>
          <div style={sec}>
            <div style={secT}>📋 수업 및 선생님 정보</div>
            <div style={g2}>
              <div><label style={lbl}>소속</label><select {...GTS_II("branch")} style={inp}>{["지티에스","엘리트코어","한남","청담"].map(b=><option key={b}>{b}</option>)}</select></div>
              <div><label style={lbl}>선생님 이름</label><input {...GTS_II("teacher")} placeholder="예: 김선생님" style={inp}/></div>
              <div><label style={lbl}>검사 날짜</label><input type="date" {...GTS_II("examDate")} style={inp}/></div>
              <div><label style={lbl}>프로그램</label><select {...GTS_II("program")} style={inp}><option>영어체육 (English PE)</option><option>한국어체육</option></select></div>
              <div style={{gridColumn:"1/-1"}}><label style={lbl}>학교 / 기관명</label><input {...GTS_II("school")} placeholder="예: ○○유치원, □□국제학교" style={inp}/></div>
            </div>
          </div>
          <div style={sec}>
            <div style={secT}>👶 아이 기본 정보</div>
            <div style={g2}>
              <div><label style={lbl}>아이 이름</label><input {...GTS_II("studentName")} placeholder="예: 홍길동" style={inp}/></div>
              <div><label style={lbl}>생년월일</label><input type="date" {...GTS_II("birthDate")} style={inp}/></div>
              <div><label style={lbl}>성별</label><select {...GTS_II("gender")} style={inp}><option>남자</option><option>여자</option></select></div>
            </div>
            {fetchStatus!=="idle"&&(
              <div style={{marginTop:12,padding:"10px 14px",background:fetchStatus==="found"?GTS_G.greenLight:fetchStatus==="notfound"?"#F9FAFB":"#EFF6FF",borderRadius:8,border:`1px solid ${fetchStatus==="found"?"#BBE8CA":fetchStatus==="notfound"?"#E5E7EB":"#BFDBFE"}`}}>
                {fetchBadge()}
                {fetchStatus==="found"&&prev&&(<div style={{marginTop:6,fontSize:10,color:"#6B7280"}}>이전 기록: 키 {prev.height||"-"}cm · 몸무게 {prev.weight||"-"}kg · 유연성 {prev.flexibility||"-"}cm</div>)}
                {info.studentId&&<div style={{marginTop:4,fontSize:9,color:"#9CA3AF"}}>학생 ID: {info.studentId}</div>}
              </div>
            )}
          </div>
          <div style={sec}>
            <div style={secT}>📏 이번 검사 측정값 <span style={{fontSize:10,fontWeight:400,color:"#9CA3AF"}}>(측정한 항목만 입력)</span></div>
            <div style={g2}>
              {GTS_ITEMS.map(item=>(
                <div key={item.key}>
                  <label style={lbl}>{item.icon} {item.label} <span style={{fontSize:9,color:"#C4C4C4",fontWeight:400}}>({item.unit}{item.lb?" · 낮을수록 좋아요":""})</span></label>
                  <input type="number" {...IC(item.key)} placeholder={`예: ${item.lb?"9.5":"35"}`} style={inp}/>
                  {prev?.[item.key]&&curr[item.key]&&(<div style={{marginTop:3}}><GTS_GrowthBadge curr={curr[item.key]} prev={prev[item.key]} unit={item.unit} lb={item.lb}/></div>)}
                </div>
              ))}
            </div>
          </div>
          <div style={sec}>
            <div style={secT}>💛 마음 성장 관찰</div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {GTS_BEHAVIOR.map(beh=>(
                <div key={beh.key}>
                  <label style={{...lbl,marginBottom:8}}>{beh.icon} {beh.label} <span style={{fontSize:10,color:"#9CA3AF",fontWeight:400}}>— {beh.desc}</span></label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {GTS_BEHAVIOR_OPTIONS.map(opt=>(
                      <label key={opt.value} style={{flex:1,minWidth:130,display:"flex",alignItems:"center",gap:8,border:`1.5px solid ${behaviors[beh.key]===opt.value?opt.color:"#E5E7EB"}`,borderRadius:8,padding:"8px 12px",background:behaviors[beh.key]===opt.value?opt.color+"12":"#fff",cursor:"pointer",transition:"all 0.15s"}}>
                        <input type="radio" name={beh.key} value={opt.value} checked={behaviors[beh.key]===opt.value} onChange={()=>setBehaviors(p=>({...p,[beh.key]:opt.value}))} style={{display:"none"}}/>
                        <span style={{fontSize:16}}>{opt.emoji}</span>
                        <span style={{fontSize:11,fontWeight:behaviors[beh.key]===opt.value?700:400,color:behaviors[beh.key]===opt.value?opt.color:GTS_G.text}}>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={sec}>
            <div style={secT}>💬 선생님 메모 <span style={{fontSize:10,fontWeight:400,color:"#9CA3AF"}}>(부모님께 전하고 싶은 한마디)</span></div>
            <textarea value={memo} onChange={e=>setMemo(e.target.value)} placeholder="예: 오늘 한발 서기를 처음으로 10초 성공했어요! 너무 뿌듯해했습니다." style={{...inp,height:70,resize:"vertical",lineHeight:1.7}}/>
          </div>
          <button onClick={GTS_handleGenerate} disabled={isSaving} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${GTS_G.greenDark},${GTS_G.green})`,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 15px rgba(45,158,87,0.3)",opacity:isSaving?0.7:1}}>
            {isSaving?"⏳ 저장 중...":"🌱 성장 리포트 생성하기 →"}
          </button>
        </div>
      )}
      {step==="report"&&(
        <div>
          <div className="no-print" style={{maxWidth:820,margin:"0 auto",padding:"12px 14px 0",display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
            <button onClick={()=>setStep("input")} style={{padding:"7px 16px",borderRadius:8,border:"1.5px solid #D1D5DB",background:"#fff",fontSize:12,cursor:"pointer",color:GTS_G.greenDark,fontWeight:600}}>← 수정하기</button>
            <button onClick={()=>window.print()} style={{padding:"7px 16px",borderRadius:8,border:"none",background:GTS_G.greenDark,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:700}}>🖨️ PDF 출력</button>
          </div>
          <div className="no-print" style={{maxWidth:820,margin:"10px auto 0",padding:"0 14px"}}>
            <div style={{background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:10,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{fontSize:11,fontWeight:700,color:GTS_G.greenDark,marginBottom:8}}>✏️ 선생님 코멘트 수정</div>
              <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4} style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #E5E7EB",borderRadius:7,padding:"8px 12px",fontSize:12,fontFamily:"'Noto Sans KR',sans-serif",lineHeight:1.8,resize:"vertical",outline:"none",color:GTS_G.text}}/>
            </div>
          </div>
          <div className="report-wrap" style={{maxWidth:820,margin:"10px auto 40px",boxShadow:"0 8px 40px rgba(45,158,87,0.12)",borderRadius:14,overflow:"hidden"}}>
            <GTSReportPage curr={curr} prev={prev} info={info} behaviors={behaviors} comment={comment} growthMemo={growthMemo}/>
          </div>
        </div>
      )}
    </div>
  );
}


// ╔══════════════════════════════════════════════════════╗
// ║  Elite Core 4회차 평가 시스템                          ║
// ╚══════════════════════════════════════════════════════╝
const EC_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyQu3vxJ8csatZh4Je5paFdnDQncVcbX43HJq-grsCMQB4ioPE82UnyizyGu1KAo0OOVQ/exec";

// ✅ 수정: nextSession 포함해서 반환
async function EC_fetchLatest(name, birthDate) {
  if (!EC_SCRIPT_URL || !name || !birthDate) return null;
  const url = `${EC_SCRIPT_URL}?action=getLatestRecord&name=${encodeURIComponent(name)}&birthDate=${encodeURIComponent(birthDate)}`;
  try {
    const res  = await fetch(url);
    const json = await res.json();
    if (json.result === "found") {
      return { data: json.data, nextSession: json.nextSession || 2 };
    }
    return { data: null, nextSession: 1 };
  } catch { return null; }
}

async function EC_saveSheets(payload) {
  if (!EC_SCRIPT_URL) return { skipped: true };
  try {
    const res = await fetch(EC_SCRIPT_URL, { method:"POST", body:JSON.stringify(payload) });
    return await res.json();
  } catch (err) { return { result:"error", message:err.message }; }
}

const EC_C = {
  red:"#C8102E", lightRed:"#E8324A", navy:"#1C2951",
  darkNavy:"#0D1829", gold:"#B8941F", goldLight:"#D4AA35",
  gray:"#6B7A99", grayLight:"#F0F2F7", white:"#FFFFFF",
  text:"#1A1E2E", textSub:"#6B7A99",
};

const EC_SESSIONS_META = [
  { label:"기준 측정", sub:"Baseline",        color:EC_C.navy, bg:"rgba(28,41,81,0.06)"   },
  { label:"성장 분석", sub:"Growth Analysis", color:EC_C.red,  bg:"rgba(200,16,46,0.05)"  },
  { label:"성장 추적", sub:"Progress Track",  color:EC_C.gold, bg:"rgba(184,148,31,0.07)" },
  { label:"최종 평가", sub:"Final Assessment",color:EC_C.gray, bg:"rgba(107,122,153,0.07)"},
];

const EC_ITEMS = [
  { key:"height",      label:"신장",      en:"Height",         unit:"cm", icon:"📏", lb:false, max:170, grade:false },
  { key:"weight",      label:"체중",      en:"Weight",         unit:"kg", icon:"⚖️",  lb:false, max:80,  grade:false },
  { key:"agility",     label:"지그재그",  en:"Agility",        unit:"초", icon:"⚡", lb:true,  max:15,  grade:true  },
  { key:"jump",        label:"멀리뛰기",  en:"Long Jump",      unit:"cm", icon:"🦘", lb:false, max:200, grade:true  },
  { key:"throw",       label:"공 던지기", en:"Ball Throw",     unit:"m",  icon:"🎯", lb:false, max:30,  grade:true  },
  { key:"balance",     label:"균형",      en:"Balance",        unit:"초", icon:"🦩", lb:false, max:60,  grade:true  },
  { key:"flexibility", label:"유연성",    en:"Flexibility",    unit:"cm", icon:"🤸", lb:false, max:30,  grade:true  },
  { key:"core",        label:"코어",      en:"Core Stability", unit:"초", icon:"💪", lb:false, max:120, grade:true  },
];

const EC_NORMS = {
  agility:     { 8:[11.5,10.5,9.8,9.2],  9:[11.0,10.0,9.3,8.7],  10:[10.5,9.5,8.8,8.2],  11:[10.0,9.0,8.3,7.7],  12:[9.5,8.5,7.8,7.2],  13:[9.2,8.2,7.5,6.9]  },
  jump:        { 8:[85,100,115,130],      9:[95,112,128,143],      10:[105,122,140,155],    11:[115,133,152,168],    12:[125,145,165,182],   13:[132,152,172,190]   },
  throw:       { 8:[7,10,14,18],          9:[9,13,17,22],          10:[11,15,20,26],        11:[13,18,23,29],        12:[15,20,27,34],       13:[17,22,29,37]       },
  balance:     { 8:[9,16,26,38],          9:[11,18,28,42],         10:[13,20,32,46],        11:[14,22,34,48],        12:[15,24,36,50],       13:[16,25,38,52]       },
  flexibility: { 8:[2,5,9,13],            9:[2,5,9,12],            10:[2,5,8,12],           11:[2,5,9,13],           12:[2,5,9,14],          13:[3,6,10,15]         },
  core:        { 8:[15,25,40,60],         9:[20,32,50,72],         10:[25,40,60,85],        11:[30,48,70,98],        12:[35,55,80,110],      13:[40,62,90,122]      },
};

function EC_calcAge(b) {
  if (!b) return 10;
  const t = new Date(), d = new Date(b);
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth()-d.getMonth()<0||(t.getMonth()===d.getMonth()&&t.getDate()<d.getDate())) a--;
  return Math.min(13, Math.max(8, a));
}

function EC_getGrade(key, value, age) {
  if (!value||value===""||!EC_NORMS[key]) return "-";
  const norm = EC_NORMS[key][Math.min(13,Math.max(8,age))];
  if (!norm) return "-";
  const [d,c,b,a] = norm, v = parseFloat(value);
  const item = EC_ITEMS.find(i=>i.key===key);
  if (item?.lb) { if(v<=a)return"A+";if(v<=b)return"A";if(v<=c)return"B";if(v<=d)return"C";return"D"; }
  else          { if(v>=a)return"A+";if(v>=b)return"A";if(v>=c)return"B";if(v>=d)return"C";return"D"; }
}

function EC_gPct(g)   { return {"A+":95,A:80,B:60,C:35,D:15,"-":0}[g]||0; }
function EC_gColor(g) { return {"A+":EC_C.red,A:EC_C.lightRed,B:EC_C.gold,C:EC_C.gray,D:"#4a5568","-":"#e5e7eb"}[g]||"#e5e7eb"; }
function EC_gLabel(g) { return {"A+":"최우수",A:"우수",B:"보통",C:"노력 필요",D:"미흡","-":"미측정"}[g]||"-"; }
function EC_gStars(g) { return {"A+":5,A:4,B:3,C:2,D:1,"-":0}[g]||0; }

function EC_getDelta(curr, base, lb) {
  if (!curr||!base||curr===""||base==="") return null;
  const diff = parseFloat(curr)-parseFloat(base);
  if (isNaN(diff)) return null;
  const improved = lb ? diff<0 : diff>0;
  return { diff, improved, abs:Math.abs(diff).toFixed(1), sign:diff>0?"+":"" };
}

function EC_generateComment(sessions, name, age) {
  const n = name||"선수";
  const valid = sessions.filter(s=>s&&Object.values(s).some(v=>v!==""));
  const cnt = valid.length;
  if (cnt===0) return `${n} 선수의 측정 데이터를 바탕으로 종합 평가를 작성합니다.`;
  const last=valid[cnt-1], first=valid[0];
  const grades={};
  EC_ITEMS.filter(i=>i.grade).forEach(item=>{ grades[item.key]=EC_getGrade(item.key,last[item.key],age); });
  const measured=Object.values(grades).filter(g=>g!=="-");
  const avg=measured.length?Math.round(measured.reduce((s,g)=>s+EC_gPct(g),0)/measured.length):0;
  const overall=avg>=88?"A+":avg>=75?"A":avg>=50?"B":avg>=25?"C":"D";
  const excellent=EC_ITEMS.filter(i=>i.grade&&(grades[i.key]==="A+"||grades[i.key]==="A")).map(i=>i.label);
  const needWork =EC_ITEMS.filter(i=>i.grade&&(grades[i.key]==="C" ||grades[i.key]==="D")).map(i=>i.label);
  const improved=[];
  if (cnt>=2) {
    EC_ITEMS.filter(i=>i.grade).forEach(item=>{
      if (!first[item.key]||!last[item.key]) return;
      const d=EC_getDelta(last[item.key],first[item.key],item.lb);
      if (d?.improved) improved.push(`${item.label}(${d.sign}${d.abs}${item.unit})`);
    });
  }
  const sessionName=EC_SESSIONS_META[cnt-1]?.label||`${cnt}회차`;
  return [
    `${n} 선수는 ${sessionName}까지 총 ${cnt}회차에 걸친 Elite Core 평가를 완료하였으며, 종합 등급 ${overall}(${EC_gLabel(overall)})을 기록하였습니다.`,
    excellent.length>0?`특히 ${excellent.slice(0,2).join("·")} 영역에서 또래 대비 뛰어난 수행 능력을 보여주었습니다.`:"전반적으로 균형 잡힌 체력 기반을 보유하고 있습니다.",
    improved.length>0?`기준 측정 대비 ${improved.slice(0,3).join(", ")} 등에서 유의미한 향상이 확인되어 꾸준한 훈련 효과가 측정되고 있습니다.`:cnt>=2?"전반적인 수행 능력을 안정적으로 유지하고 있습니다.":"",
    needWork.length>0?`향후 ${needWork.slice(0,2).join("·")} 영역의 집중 훈련을 통해 더욱 완성도 높은 선수로 성장할 수 있을 것으로 기대됩니다.`:"모든 영역에서 고른 역량을 발휘하고 있으며, 다음 평가에서의 성과가 더욱 기대됩니다.",
    `Elite Core 코칭팀은 ${n} 선수의 지속적인 성장을 전심으로 지원하겠습니다.`,
  ].filter(Boolean).join(" ");
}

function EC_MiniLineChart({ sessions, itemKey, unit, lb }) {
  const vals=sessions.map(s=>s?parseFloat(s[itemKey]):null).filter(v=>v!==null&&!isNaN(v));
  if (vals.length<2) return <div style={{height:44,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#ccc"}}>데이터 부족</div>;
  const min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const W=160,H=44,px=8,py=8,step=(W-px*2)/(vals.length-1);
  const pts=vals.map((v,i)=>({x:px+i*step,y:H-py-((v-min)/range)*(H-py*2)}));
  const poly=pts.map(p=>`${p.x},${p.y}`).join(" ");
  return(<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",display:"block"}}>
    <defs><linearGradient id={`g_${itemKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={EC_C.red} stopOpacity="0.18"/><stop offset="100%" stopColor={EC_C.red} stopOpacity="0.01"/></linearGradient></defs>
    <polygon points={`${pts[0].x},${H-py} ${poly} ${pts[pts.length-1].x},${H-py}`} fill={`url(#g_${itemKey})`}/>
    <polyline points={poly} fill="none" stroke={EC_C.red} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
    {pts.map((p,i)=>(<g key={i}><circle cx={p.x} cy={p.y} r="3.5" fill={EC_C.red} stroke="#fff" strokeWidth="1.2"/><text x={p.x} y={p.y-6} textAnchor="middle" style={{fontSize:7,fill:"#444",fontWeight:700}}>{vals[i]}</text><text x={p.x} y={H-1} textAnchor="middle" style={{fontSize:6.5,fill:"#bbb"}}>{i+1}</text></g>))}
  </svg>);
}

function EC_RadarChart({ data }) {
  const cx=95,cy=95,r=72,keys=["agility","jump","throw","balance","flexibility","core"],labels=["민첩성","점프","던지기","균형","유연성","코어"],n=keys.length;
  const pts=keys.map((k,i)=>{const a=(i*2*Math.PI)/n-Math.PI/2,pct=(data[k]||0)/100;return{x:cx+r*pct*Math.cos(a),y:cy+r*pct*Math.sin(a)};});
  const avg=keys.map((_,i)=>{const a=(i*2*Math.PI)/n-Math.PI/2;return`${cx+r*0.5*Math.cos(a)},${cy+r*0.5*Math.sin(a)}`;}).join(" ");
  return(<svg viewBox="0 0 190 190" style={{width:"100%",display:"block"}}>
    <defs><radialGradient id="rg4" cx="50%" cy="50%"><stop offset="0%" stopColor={EC_C.red} stopOpacity="0.15"/><stop offset="100%" stopColor={EC_C.red} stopOpacity="0.02"/></radialGradient></defs>
    {[0.25,0.5,0.75,1.0].map(lv=>{const gp=keys.map((_,i)=>{const a=(i*2*Math.PI)/n-Math.PI/2;return`${cx+r*lv*Math.cos(a)},${cy+r*lv*Math.sin(a)}`;}).join(" ");return<polygon key={lv} points={gp} fill="none" stroke={lv===1?"rgba(200,16,46,0.2)":"#f0f0f0"} strokeWidth={lv===1?1.2:0.7}/>;
    })}
    {keys.map((_,i)=>{const a=(i*2*Math.PI)/n-Math.PI/2;return<line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)} stroke="#f0f0f0" strokeWidth="0.7"/>;})}
    <polygon points={avg} fill="none" stroke="rgba(184,148,31,0.5)" strokeWidth="1.2" strokeDasharray="3 3"/>
    <polygon points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="url(#rg4)" stroke={EC_C.red} strokeWidth="2" strokeLinejoin="round"/>
    {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill={EC_C.red} stroke="#fff" strokeWidth="1.2"/>)}
    {keys.map((k,i)=>{const a=(i*2*Math.PI)/n-Math.PI/2;return<text key={i} x={cx+(r+16)*Math.cos(a)} y={cy+(r+16)*Math.sin(a)} textAnchor="middle" dominantBaseline="central" style={{fontSize:8.5,fill:"#777",fontFamily:"sans-serif",fontWeight:700}}>{labels[i]}</text>;})}
  </svg>);
}

function EC_Delta({ curr, base, unit, lb, tiny }) {
  const d=EC_getDelta(curr,base,lb);
  if (!d) return <span style={{color:"#ddd",fontSize:tiny?8:10}}>—</span>;
  return(<span style={{display:"inline-flex",alignItems:"center",gap:1,background:d.improved?"rgba(200,16,46,0.07)":"rgba(107,122,153,0.08)",color:d.improved?EC_C.red:EC_C.gray,borderRadius:3,padding:tiny?"0 4px":"1px 6px",fontSize:tiny?9:10,fontWeight:800}}>
    {d.improved?"▲":"▼"} {d.sign}{d.abs}{unit}
  </span>);
}

function EC_GBox({ g, small }) {
  return(<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",background:EC_gColor(g),borderRadius:3,padding:small?"1px 5px":"2px 8px",minWidth:small?20:28}}>
    <span style={{fontSize:small?10:13,fontWeight:900,color:"#fff"}}>{g}</span>
  </span>);
}

function EC_SectionTitle({ children }) {
  return(<div style={{fontSize:8,color:EC_C.red,fontWeight:800,letterSpacing:1.5,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
    <div style={{width:2,height:10,background:EC_C.red,borderRadius:1,flexShrink:0}}/>
    {children}
  </div>);
}

function ECReportPage({ info, sessions, comment }) {
  const age=EC_calcAge(info.birthDate);
  const valid=sessions.filter(s=>s&&Object.values(s).some(v=>v!==""));
  const cnt=valid.length, last=valid[cnt-1]||{}, s1=sessions[0];
  const grades={};
  EC_ITEMS.filter(i=>i.grade).forEach(item=>{grades[item.key]=EC_getGrade(item.key,last[item.key],age);});
  const radarData={};
  Object.entries(grades).forEach(([k,g])=>{radarData[k]=EC_gPct(g);});
  const measured=Object.values(grades).filter(g=>g!=="-");
  const avgPct=measured.length?Math.round(measured.reduce((s,g)=>s+EC_gPct(g),0)/measured.length):0;
  const overall=avgPct>=88?"A+":avgPct>=75?"A":avgPct>=50?"B":avgPct>=25?"C":"D";
  const today=new Date(), dateStr=`${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}`;
  return(<div style={{fontFamily:"'Noto Sans KR',sans-serif",background:"#fff",width:"210mm",minHeight:"297mm",margin:"0 auto",color:EC_C.text,fontSize:12,lineHeight:1.5}}>
    <div style={{background:EC_C.navy,padding:"14px 24px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`3px solid ${EC_C.red}`}}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3}}>
          <div style={{background:EC_C.red,borderRadius:3,padding:"3px 10px"}}><span style={{fontSize:15,fontWeight:900,color:"#fff",letterSpacing:2}}>ELITE CORE</span></div>
          <div style={{borderLeft:"1px solid rgba(255,255,255,0.2)",paddingLeft:10}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.5)",letterSpacing:1}}>by GTS</div>
            <div style={{fontSize:10,fontWeight:700,color:"#fff"}}>4-Session Growth Assessment Report</div>
          </div>
        </div>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>초등학생 프리미엄 스포츠 성장 리포트 · {cnt}회차 완료</div>
        {info.studentId&&<div style={{fontSize:8,color:"rgba(255,255,255,0.3)",marginTop:2}}>ID: {info.studentId}</div>}
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:2}}>REPORT DATE</div>
        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{dateStr}</div>
        <div style={{marginTop:4,display:"flex",gap:5,justifyContent:"flex-end"}}>
          <span style={{background:"rgba(255,255,255,0.1)",borderRadius:3,padding:"2px 7px",fontSize:8,color:"rgba(255,255,255,0.7)"}}>{info.branch}</span>
          <span style={{background:EC_C.red,borderRadius:3,padding:"2px 7px",fontSize:8,color:"#fff",fontWeight:700}}>{cnt}회차 평가</span>
        </div>
      </div>
    </div>
    <div style={{padding:"12px 24px 0",display:"flex",gap:12}}>
      <div style={{flex:"0 0 175px",border:"1.5px solid #f0f0f0",borderTop:`3px solid ${EC_C.red}`,borderRadius:"0 0 6px 6px",padding:"12px 14px",background:"#fafafa"}}>
        <div style={{fontSize:8,color:EC_C.red,fontWeight:800,marginBottom:8,letterSpacing:2}}>ATHLETE PROFILE</div>
        {[["이름",info.studentName||"-"],["생년월일",info.birthDate||"-"],["만 나이",`${age}세`],["성별",info.gender==="남자"?"Male / 남":"Female / 여"],["학교",info.school||info.branch||"-"],["코치",info.teacher||"-"]].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:5,paddingBottom:4,borderBottom:"1px solid #f0f0f0",fontSize:9}}>
            <span style={{color:"#aaa"}}>{l}</span><span style={{fontWeight:700,color:EC_C.text}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{flex:1}}>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          {[0,1,2,3].map(i=>{
            const s=sessions[i],m=EC_SESSIONS_META[i];
            const has=s&&Object.values(s).some(v=>v!=="");
            const isLast=has&&i===valid.length-1;
            return(<div key={i} style={{flex:1,border:`1.5px solid ${has?(isLast?m.color:"#e5e7eb"):"#f5f5f5"}`,borderTop:`3px solid ${has?m.color:"#f0f0f0"}`,borderRadius:"0 0 6px 6px",padding:"7px 6px",background:has?(isLast?m.bg:"#fafafa"):"#fcfcfc",textAlign:"center"}}>
              <div style={{fontSize:8,fontWeight:800,color:has?m.color:"#ddd",letterSpacing:0.5,marginBottom:2}}>{m.label}</div>
              <div style={{fontSize:7,color:"#bbb",marginBottom:3}}>{m.sub}</div>
              {has?(<>
                <div style={{fontSize:11,fontWeight:900,color:isLast?m.color:EC_C.text}}>{s.height||"-"}<span style={{fontSize:7,color:"#aaa",fontWeight:400}}>cm</span></div>
                <div style={{fontSize:9,color:"#bbb"}}>{s.weight||"-"}<span style={{fontSize:7}}>kg</span></div>
                {i>0&&s1?.height&&s.height&&<div style={{marginTop:2}}><EC_Delta curr={s.height} base={s1.height} unit="cm" lb={false} tiny/></div>}
              </>):<div style={{fontSize:8,color:"#e0e0e0",marginTop:4}}>—</div>}
            </div>);
          })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 10px"}}>
          {EC_ITEMS.filter(i=>i.grade).map(item=>{
            const g=grades[item.key];
            return(<div key={item.key} style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:11}}>{item.icon}</span>
              <span style={{fontSize:8.5,color:"#666",width:48,flexShrink:0}}>{item.label}</span>
              <div style={{flex:1,height:5,background:"#f0f0f0",borderRadius:2,overflow:"hidden"}}><div style={{width:`${EC_gPct(g)}%`,height:"100%",background:EC_gColor(g),borderRadius:2}}/></div>
              <span style={{fontSize:9.5,fontWeight:800,color:EC_gColor(g),width:20,textAlign:"right"}}>{g}</span>
            </div>);
          })}
        </div>
      </div>
      <div style={{flex:"0 0 66px",border:`2px solid ${EC_C.red}`,borderRadius:8,padding:"10px 6px",textAlign:"center",background:"rgba(200,16,46,0.03)",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
        <div style={{fontSize:8,color:EC_C.red,fontWeight:800,letterSpacing:1,marginBottom:2}}>OVERALL</div>
        <div style={{fontSize:32,fontWeight:900,color:EC_C.red,lineHeight:1}}>{overall}</div>
        <div style={{fontSize:8,color:"#aaa",marginTop:4}}>{EC_gLabel(overall)}</div>
        <div style={{marginTop:6,display:"flex",justifyContent:"center"}}>{[1,2,3,4,5].map(s=><span key={s} style={{fontSize:9,color:s<=EC_gStars(overall)?EC_C.gold:"#e5e7eb"}}>★</span>)}</div>
      </div>
    </div>
    <div style={{padding:"10px 24px 0"}}>
      <EC_SectionTitle>SESSION COMPARISON / 회차별 기록 비교</EC_SectionTitle>
      <div style={{border:"1px solid #ebebeb",borderRadius:6,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"85px repeat(4,1fr) 62px 62px",background:EC_C.navy,padding:"5px 10px",fontSize:8,fontWeight:800,color:"#fff",letterSpacing:0.5}}>
          <span>항목</span>
          {EC_SESSIONS_META.map((m,i)=><span key={i} style={{textAlign:"center",opacity:sessions[i]&&Object.values(sessions[i]).some(v=>v!=="")?"1":"0.35"}}>{m.label}</span>)}
          <span style={{textAlign:"center",fontSize:7}}>↔기준 대비</span>
          <span style={{textAlign:"center",fontSize:7}}>↔직전 대비</span>
        </div>
        {EC_ITEMS.map((item,idx)=>{
          const valids=sessions.filter(s=>s&&s[item.key]!=="");
          const lastV=valids.length>0?valids[valids.length-1][item.key]:null;
          const prevV=valids.length>1?valids[valids.length-2][item.key]:null;
          const g=item.grade?EC_getGrade(item.key,lastV,age):"-";
          return(<div key={item.key} style={{display:"grid",gridTemplateColumns:"85px repeat(4,1fr) 62px 62px",padding:"5px 10px",alignItems:"center",background:idx%2===0?"#fff":"#fafafa",borderTop:"1px solid #f5f5f5"}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:12}}>{item.icon}</span><div><div style={{fontSize:9.5,fontWeight:700,color:EC_C.text}}>{item.label}</div><div style={{fontSize:7.5,color:"#bbb"}}>{item.unit}</div></div></div>
            {sessions.map((s,si)=>{
              const v=s?.[item.key];
              const sg=item.grade?EC_getGrade(item.key,v,age):"-";
              const isLast=si===valid.length-1&&v&&v!=="";
              return(<div key={si} style={{textAlign:"center"}}>
                {v&&v!==""?(<><div style={{fontSize:11,fontWeight:isLast?800:500,color:isLast&&item.grade?EC_gColor(sg):EC_C.text}}>{v}<span style={{fontSize:7.5,color:"#bbb",fontWeight:400}}>{item.unit}</span></div>{item.grade&&sg!=="-"&&<EC_GBox g={sg} small/>}</>):<span style={{color:"#e5e7eb",fontSize:10}}>—</span>}
              </div>);
            })}
            <div style={{textAlign:"center"}}>{s1?.[item.key]?<EC_Delta curr={lastV} base={s1[item.key]} unit={item.unit} lb={item.lb} tiny/>:<span style={{color:"#e5e7eb",fontSize:8}}>—</span>}</div>
            <div style={{textAlign:"center"}}><EC_Delta curr={lastV} base={prevV} unit={item.unit} lb={item.lb} tiny/></div>
          </div>);
        })}
      </div>
    </div>
    <div style={{padding:"10px 24px 0",display:"flex",gap:12}}>
      <div style={{flex:1}}>
        <EC_SectionTitle>GROWTH TREND / 성장 그래프</EC_SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
          {EC_ITEMS.filter(i=>i.key!=="weight").map(item=>(
            <div key={item.key} style={{border:"1px solid #ebebeb",borderRadius:6,padding:"7px 8px",background:"#fafafa"}}>
              <div style={{fontSize:9,fontWeight:700,color:EC_C.text,marginBottom:3}}>{item.icon} {item.label} <span style={{fontSize:7.5,color:"#bbb",fontWeight:400}}>({item.unit})</span></div>
              <EC_MiniLineChart sessions={sessions} itemKey={item.key} unit={item.unit} lb={item.lb}/>
            </div>
          ))}
        </div>
      </div>
      <div style={{flex:"0 0 165px",display:"flex",flexDirection:"column",gap:7}}>
        <EC_SectionTitle>RADAR</EC_SectionTitle>
        <div style={{border:"1px solid #ebebeb",borderRadius:6,padding:"7px",background:"#fafafa"}}>
          <EC_RadarChart data={radarData}/>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:3}}>
            <div style={{display:"flex",alignItems:"center",gap:2,fontSize:7,color:EC_C.red}}><div style={{width:10,height:2,background:EC_C.red}}/> 최근</div>
            <div style={{display:"flex",alignItems:"center",gap:2,fontSize:7,color:EC_C.gold}}><div style={{width:10,height:2,background:EC_C.gold}}/> 평균</div>
          </div>
        </div>
        <div style={{border:"1px solid #ebebeb",borderRadius:6,padding:"8px 10px",background:"#fafafa"}}>
          <div style={{fontSize:8,color:EC_C.red,fontWeight:800,letterSpacing:1,marginBottom:5}}>GRADE</div>
          {[["A+","최우수","상위 10%"],["A","우수","상위 25%"],["B","보통","평균"],["C","노력필요","하위 25%"],["D","미흡","하위 10%"]].map(([g,l,p])=>(
            <div key={g} style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
              <div style={{background:EC_gColor(g),borderRadius:2,padding:"0px 5px",minWidth:18,textAlign:"center"}}><span style={{fontSize:8,fontWeight:900,color:"#fff"}}>{g}</span></div>
              <span style={{fontSize:8,color:"#555",fontWeight:600}}>{l}</span>
              <span style={{fontSize:7,color:"#bbb",marginLeft:"auto"}}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div style={{padding:"10px 24px 14px"}}>
      <EC_SectionTitle>COACH ANALYSIS / 종합 성장 분석</EC_SectionTitle>
      <div style={{border:"1px solid #ebebeb",borderLeft:`4px solid ${EC_C.red}`,borderRadius:"0 6px 6px 0",padding:"12px 16px",background:"#fafafa",display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{flex:"0 0 54px",background:EC_C.navy,borderRadius:6,padding:"7px 5px",textAlign:"center"}}>
          <div style={{fontSize:7,color:EC_C.gray,fontWeight:800,letterSpacing:1}}>GRADE</div>
          <div style={{fontSize:24,fontWeight:900,color:EC_C.red,lineHeight:1}}>{overall}</div>
          <div style={{fontSize:6.5,color:EC_C.gray,marginTop:2}}>{cnt}회차</div>
        </div>
        <div style={{flex:1,fontSize:10.5,color:"#333",lineHeight:1.9}}>{comment}</div>
      </div>
    </div>
    <div style={{margin:"0 24px",paddingTop:10,paddingBottom:16,borderTop:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{fontSize:9,color:"#ccc",lineHeight:1.7}}>※ 본 리포트는 운동 발달을 위한 참고 자료이며, 의학적 진단이 아닙니다.</div>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        <div style={{background:EC_C.red,borderRadius:3,padding:"2px 8px"}}><span style={{fontSize:10,fontWeight:900,color:"#fff",letterSpacing:2}}>ELITE CORE</span></div>
        <span style={{fontSize:8,color:"#bbb",letterSpacing:0.5}}>BY GTS</span>
      </div>
    </div>
  </div>);
}

const EC_EMPTY_S = { height:"",weight:"",agility:"",jump:"",throw:"",balance:"",flexibility:"",core:"" };
const EC_EMPTY_I = { studentId:"",branch:"엘리트코어",teacher:"",program:"한국어체육",school:"",studentName:"",birthDate:"",gender:"남자",examDate:"" };

function EliteCoreApp({ onBack, supabaseUser }) {
  const [step,    setStep]    = useState("input");
  const [tab,     setTab]     = useState(0);
  const [info,    setInfo]    = useState({...EC_EMPTY_I});
  const [sessions,setSessions]= useState([{...EC_EMPTY_S},{...EC_EMPTY_S},{...EC_EMPTY_S},{...EC_EMPTY_S}]);
  const [comment, setComment] = useState("");
  const [isSaving,setIsSaving]= useState(false);
  const [fetchStatus,setFetchStatus] = useState("idle");
  const fetchTimer = useRef(null);

  const setS = (si,key,val) => setSessions(prev=>prev.map((s,i)=>i===si?{...s,[key]:val}:s));
  const EC_II = k => ({value:info[k],onChange:e=>setInfo(p=>({...p,[k]:e.target.value}))});

  useEffect(() => {
    if (!supabaseUser) return;
    const mapped = mapGrowthBranch(supabaseUser.branch);
    setInfo(p => ({
      ...p,
      teacher: supabaseUser.name || p.teacher,
      ...(mapped ? { branch: mapped } : {}),
    }));
  }, [supabaseUser]);

  // ✅ 핵심 수정: 다음 회차 탭으로 자동 이동
  useEffect(()=>{
    if (!info.studentName||!info.birthDate) return;
    clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async()=>{
      setFetchStatus("loading");
      const result = await EC_fetchLatest(info.studentName, info.birthDate);
      if (result && result.data) {
        const record = result.data;
        const nextSess = result.nextSession || 2;
        const prevTabIdx = nextSess - 2; // 직전 회차 인덱스 (0-based)
        setSessions(prev=>prev.map((s,i)=>i===prevTabIdx?{
          height:      record.height      ||"",
          weight:      record.weight      ||"",
          agility:     record.agility     ||"",
          jump:        record.jump        ||"",
          throw:       record.throw       ||"",
          balance:     record.balance     ||"",
          flexibility: record.flexibility ||"",
          core:        record.core        ||"",
        }:s));
        setInfo(p=>({...p, studentId: record.studentId}));
        setTab(Math.min(nextSess - 1, 3)); // 다음 회차 탭으로 이동 (최대 3)
        setFetchStatus("found");
      } else {
        setTab(0);
        setFetchStatus("notfound");
      }
    }, 800);
    return ()=>clearTimeout(fetchTimer.current);
  },[info.studentName, info.birthDate]);

  const inp = {width:"100%",boxSizing:"border-box",border:"1.5px solid #e5e7eb",borderRadius:7,padding:"8px 11px",fontSize:13,fontFamily:"inherit",background:"#fff",color:EC_C.text,outline:"none"};
  const lbl = {fontSize:11,fontWeight:600,color:"#444",marginBottom:4,display:"block"};
  const sec = {background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"16px 18px",marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"};
  const secT= {fontSize:12,fontWeight:700,color:EC_C.navy,marginBottom:12,paddingBottom:7,borderBottom:`2px solid ${EC_C.red}`};
  const g2  = {display:"grid",gridTemplateColumns:"1fr 1fr",gap:10};

  const age = EC_calcAge(info.birthDate);
  const validCnt = sessions.filter(s=>Object.values(s).some(v=>v!=="")).length;

  async function EC_handleGenerate() {
    const auto = EC_generateComment(sessions, info.studentName, age);
    setComment(auto);
    setStep("report");
    setIsSaving(true);
    const validSessions = sessions.map((s,i)=>({...s,sessionNum:i+1})).filter(s=>Object.values(s).some(v=>v!==""&&v!==s.sessionNum));
    let savedCount = 0;
    for (const s of validSessions) {
      const payload = {
        brand:"EliteCore", studentId:info.studentId||"auto",
        examDate:info.examDate||new Date().toLocaleDateString("ko-KR"),
        studentName:info.studentName, birthDate:info.birthDate,
        gender:info.gender, branch:info.branch, program:info.program,
        session:s.sessionNum,
        height:s.height, weight:s.weight, flexibility:s.flexibility,
        balance:s.balance, agility:s.agility, jump:s.jump,
        throw:s.throw, core:s.core||"",
        participation:"", confidence:"", social:"", memo:"",
      };
      try {
        const result = await EC_saveSheets(payload);
        if (result?.skipped) break;
        if (result?.result==="success") {
          if (result.studentId&&!info.studentId) setInfo(p=>({...p,studentId:result.studentId}));
          savedCount++;
        } else {
          alert("⚠️ "+s.sessionNum+"회차 저장 오류: "+(result?.message||"알 수 없는 오류"));
        }
      } catch(err) { alert("❌ 네트워크 오류: "+err.message); break; }
    }
    if (savedCount>0) alert("✅ Google Sheets 저장 완료!\n학생: "+info.studentName+" · "+savedCount+"회차 저장됨");
    setIsSaving(false);
  }

  // ✅ 수정: 몇 번째 회차인지 표시
  const fetchBadge = () => {
    if (fetchStatus==="loading") return <span style={{fontSize:11,color:"#60A5FA"}}>⏳ 기존 기록 확인 중...</span>;
    if (fetchStatus==="found")   return <span style={{fontSize:11,color:EC_C.red,fontWeight:600}}>📋 기존 기록 확인! 다음 회차 탭으로 자동 이동했어요</span>;
    if (fetchStatus==="notfound") return <span style={{fontSize:11,color:"#9CA3AF"}}>📍 첫 번째 Elite Core 기록입니다</span>;
    return null;
  };

  return(<div style={{minHeight:"100vh",background:"#f5f7fa",fontFamily:"'Noto Sans KR',sans-serif"}}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;900&display=swap');
      @media print{.no-print{display:none!important}body{background:#fff!important;margin:0;padding:0}.report-wrap{box-shadow:none!important;border-radius:0!important;margin:0!important}}
      input:focus,select:focus,textarea:focus{border-color:${EC_C.red}!important;box-shadow:0 0 0 2px rgba(200,16,46,0.12)!important}
      select option{background:#fff;color:#000}
      @page{margin:8mm;size:A4}
    `}</style>
    <div className="no-print" style={{background:EC_C.navy,borderBottom:`3px solid ${EC_C.red}`,padding:"10px 26px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{background:EC_C.red,borderRadius:3,padding:"3px 9px"}}><span style={{fontSize:14,fontWeight:900,color:"#fff",letterSpacing:2}}>ELITE CORE</span></div>
        <span style={{fontSize:10,color:EC_C.gray}}>4-Session Growth Report · by GTS</span>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {onBack&&<button onClick={onBack} style={{padding:"5px 13px",borderRadius:5,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700}}>← HOME</button>}
        <span style={{fontSize:9,color:EC_C.gray,background:"rgba(255,255,255,0.08)",borderRadius:4,padding:"2px 8px"}}>{validCnt}/4 입력</span>
        <button onClick={()=>setStep("input")} style={{padding:"5px 13px",borderRadius:5,border:"1px solid rgba(255,255,255,0.2)",background:step==="input"?"rgba(200,16,46,0.3)":"transparent",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700}}>✏ 입력</button>
        <button onClick={EC_handleGenerate} disabled={isSaving} style={{padding:"5px 13px",borderRadius:5,border:"none",background:EC_C.red,color:"#fff",fontSize:11,cursor:"pointer",fontWeight:800,opacity:isSaving?0.7:1}}>{isSaving?"저장 중...":"▶ 리포트 생성"}</button>
        {step==="report"&&<button onClick={()=>window.print()} style={{padding:"5px 13px",borderRadius:5,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:700}}>⊡ PDF 출력</button>}
      </div>
    </div>
    {step==="input"&&(
      <div className="no-print" style={{maxWidth:740,margin:"0 auto",padding:"22px 16px"}}>
        <div style={{marginBottom:18}}>
          <h1 style={{fontSize:20,fontWeight:900,color:EC_C.navy,margin:"0 0 4px"}}>4회차 누적 평가 입력</h1>
          <p style={{fontSize:11,color:"#888",margin:0}}>이름과 생년월일을 입력하면 기존 기록을 자동으로 불러와요</p>
        </div>
        <div style={sec}>
          <div style={secT}>👤 선수 기본 정보</div>
          <div style={g2}>
            <div><label style={lbl}>소속</label><select {...EC_II("branch")} style={inp}>{["엘리트코어","한남","지티에스","청담"].map(b=><option key={b}>{b}</option>)}</select></div>
            <div><label style={lbl}>담당 코치</label><input {...EC_II("teacher")} placeholder="예: 김코치" style={inp}/></div>
            <div><label style={lbl}>선수 이름</label><input {...EC_II("studentName")} placeholder="예: 홍길동" style={inp}/></div>
            <div><label style={lbl}>생년월일</label><input type="date" {...EC_II("birthDate")} style={inp}/></div>
            <div><label style={lbl}>성별</label><select {...EC_II("gender")} style={inp}><option>남자</option><option>여자</option></select></div>
            <div><label style={lbl}>프로그램</label><select {...EC_II("program")} style={inp}><option>한국어체육</option><option>영어체육 (English PE)</option></select></div>
            <div style={{gridColumn:"1/-1"}}><label style={lbl}>학교 / 기관명</label><input {...EC_II("school")} placeholder="예: ○○초등학교" style={inp}/></div>
          </div>
          {fetchStatus!=="idle"&&(
            <div style={{marginTop:12,padding:"10px 14px",background:fetchStatus==="found"?"rgba(200,16,46,0.04)":fetchStatus==="notfound"?"#f9fafb":"#eff6ff",borderRadius:8,border:`1px solid ${fetchStatus==="found"?EC_C.red:fetchStatus==="notfound"?"#e5e7eb":"#bfdbfe"}`}}>
              {fetchBadge()}
              {info.studentId&&<div style={{marginTop:4,fontSize:9,color:"#9CA3AF"}}>선수 ID: {info.studentId}</div>}
            </div>
          )}
        </div>
        <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",borderBottom:"1.5px solid #f0f0f0"}}>
            {EC_SESSIONS_META.map((m,i)=>{
              const has=sessions[i]&&Object.values(sessions[i]).some(v=>v!=="");
              const isActive=tab===i;
              return(<button key={i} onClick={()=>setTab(i)} style={{flex:1,padding:"10px 6px",border:"none",borderBottom:isActive?`3px solid ${m.color}`:"3px solid transparent",background:isActive?"#fff":"#fafafa",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                <div style={{fontSize:11,fontWeight:700,color:isActive?m.color:"#aaa"}}>{m.label}</div>
                <div style={{fontSize:8.5,color:isActive?"#888":"#ccc"}}>{m.sub}</div>
                <div style={{fontSize:8,color:has?"#2d9e57":"#e0e0e0",marginTop:2}}>{has?"✓ 입력됨":"미입력"}</div>
              </button>);
            })}
          </div>
          <div style={{padding:"16px 18px"}}>
            <div style={{marginBottom:12,padding:"8px 12px",background:EC_SESSIONS_META[tab].bg,borderRadius:6,borderLeft:`3px solid ${EC_SESSIONS_META[tab].color}`,fontSize:11,color:EC_SESSIONS_META[tab].color,fontWeight:600}}>
              {tab===0&&"📌 기준 측정 — 초기 기록을 정확히 입력해주세요."+(fetchStatus==="found"?" (기존 최근 기록이 자동 입력됨)":"")}
              {tab===1&&"📈 성장 분석 — 기준 측정 대비 변화를 확인합니다."}
              {tab===2&&"📊 성장 추적 — 기준·직전 회차 대비 성장 흐름을 분석합니다."}
              {tab===3&&"🏆 최종 평가 — 4회차 전체 성장을 종합 평가합니다."}
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#444",marginBottom:8}}>신체 측정</div>
              <div style={g2}>
                {[["신장 (cm)","height","예: 132"],["체중 (kg)","weight","예: 28"]].map(([l,k,p])=>(
                  <div key={k}>
                    <label style={lbl}>{l}</label>
                    <input type="number" value={sessions[tab][k]} onChange={e=>setS(tab,k,e.target.value)} placeholder={p} style={inp}/>
                    {tab>0&&sessions[0][k]&&sessions[tab][k]&&(
                      <div style={{marginTop:3}}><EC_Delta curr={sessions[tab][k]} base={sessions[0][k]} unit={k==="height"?"cm":"kg"} lb={false} tiny/><span style={{fontSize:8,color:"#bbb",marginLeft:3}}>기준 대비</span></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#444",marginBottom:8}}>운동 능력 측정</div>
              <div style={g2}>
                {EC_ITEMS.filter(i=>i.grade).map(item=>(
                  <div key={item.key}>
                    <label style={lbl}>{item.icon} {item.label} <span style={{fontSize:9,color:"#bbb",fontWeight:400}}>({item.unit} · {item.lb?"낮을수록 우수":"높을수록 우수"})</span></label>
                    <input type="number" value={sessions[tab][item.key]} onChange={e=>setS(tab,item.key,e.target.value)} placeholder={`예: ${item.lb?"9.5":"45"}`} style={inp}/>
                    {tab>0&&sessions[0][item.key]&&sessions[tab][item.key]&&(
                      <div style={{marginTop:3,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                        <EC_Delta curr={sessions[tab][item.key]} base={sessions[0][item.key]} unit={item.unit} lb={item.lb} tiny/><span style={{fontSize:8,color:"#bbb"}}>기준</span>
                        {tab>1&&sessions[tab-1][item.key]&&<><EC_Delta curr={sessions[tab][item.key]} base={sessions[tab-1][item.key]} unit={item.unit} lb={item.lb} tiny/><span style={{fontSize:8,color:"#bbb"}}>직전</span></>}
                        {sessions[tab][item.key]&&<EC_GBox g={EC_getGrade(item.key,sessions[tab][item.key],age)} small/>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <button onClick={EC_handleGenerate} disabled={isSaving} style={{width:"100%",marginTop:14,padding:"13px",borderRadius:9,border:"none",background:`linear-gradient(135deg,${EC_C.red},${EC_C.lightRed})`,color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer",letterSpacing:1,boxShadow:"0 4px 14px rgba(200,16,46,0.28)",opacity:isSaving?0.7:1}}>
          {isSaving?"⏳ 저장 중...":"▶ 리포트 생성하기"}
        </button>
      </div>
    )}
    {step==="report"&&(
      <div>
        <div className="no-print" style={{maxWidth:820,margin:"0 auto",padding:"10px 14px 0",display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setStep("input")} style={{padding:"7px 14px",borderRadius:6,border:"1.5px solid #e5e7eb",background:"#fff",fontSize:11,cursor:"pointer",color:EC_C.navy,fontWeight:600}}>← 수정</button>
          <button onClick={()=>window.print()} style={{padding:"7px 14px",borderRadius:6,border:"none",background:EC_C.red,color:"#fff",fontSize:11,cursor:"pointer",fontWeight:800}}>⊡ PDF 출력</button>
        </div>
        <div className="no-print" style={{maxWidth:820,margin:"10px auto 0",padding:"0 14px"}}>
          <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <div style={{fontSize:11,fontWeight:700,color:EC_C.navy,marginBottom:8}}>✏ 코치 코멘트 수정 <span style={{fontSize:10,color:"#aaa",fontWeight:400}}>(PDF 출력 전 확인·수정하세요)</span></div>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4} style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #e5e7eb",borderRadius:6,padding:"8px 12px",fontSize:12,fontFamily:"'Noto Sans KR',sans-serif",lineHeight:1.8,resize:"vertical",outline:"none",color:EC_C.text}}/>
          </div>
        </div>
        <div className="report-wrap" style={{maxWidth:820,margin:"10px auto 40px",boxShadow:"0 4px 30px rgba(0,0,0,0.10)",borderRadius:10,overflow:"hidden"}}>
          <ECReportPage info={info} sessions={sessions} comment={comment}/>
        </div>
      </div>
    )}
  </div>);
}


// ╔══════════════════════════════════════════════════════╗
// ║  성장 리포트 랜딩 (GTS × ELITE CORE 선택)              ║
// ╚══════════════════════════════════════════════════════╝
export default function GrowthApp({ onBack, supabaseUser }) {
  const [brand, setBrand] = useState(null);
  if (brand === "gts") return <GTSApp onBack={() => setBrand(null)} supabaseUser={supabaseUser} />;
  if (brand === "ec")  return <EliteCoreApp onBack={() => setBrand(null)} supabaseUser={supabaseUser} />;
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0D1829 0%,#1C2951 50%,#0D1829 100%)",fontFamily:"'Noto Sans KR',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;900&display=swap');
        *{box-sizing:border-box}
        .lp-card{transition:transform .2s,box-shadow .2s;cursor:pointer}
        .lp-card:hover{transform:translateY(-5px)}
        @media(max-width:640px){.lp-grid{grid-template-columns:1fr!important}}
      `}</style>
      {onBack && (
        <div style={{position:"absolute",top:16,left:16,right:16,display:"flex",justifyContent:"flex-start"}}>
          <button onClick={onBack} style={{
            background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",
            borderRadius:8,padding:"6px 12px",color:"#fff",fontSize:11,fontWeight:700,
            cursor:"pointer",fontFamily:"inherit",
          }}>← 홈</button>
        </div>
      )}
      <div style={{textAlign:"center",marginBottom:48}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:16}}>
          <div style={{background:"#1A7A3C",borderRadius:6,padding:"3px 10px"}}><span style={{fontSize:14,fontWeight:700,color:"#fff",letterSpacing:1}}>GTS</span></div>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.25)"}}>×</span>
          <div style={{background:"#C8102E",borderRadius:5,padding:"3px 10px"}}><span style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:1.5}}>ELITE CORE</span></div>
        </div>
        <h1 style={{fontSize:24,fontWeight:700,color:"#fff",marginBottom:8,letterSpacing:0.5}}>운동발달 평가 시스템</h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>프로그램에 맞는 시스템을 선택하세요</p>
      </div>
      <div className="lp-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,width:"100%",maxWidth:780}}>
        <div className="lp-card" onClick={()=>setBrand("gts")} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(45,158,87,0.3)",borderRadius:16,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
          <div style={{background:"linear-gradient(135deg,#1A7A3C,#2D9E57)",padding:"24px 24px 20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{background:"#fff",borderRadius:5,padding:"2px 8px"}}><span style={{fontSize:13,fontWeight:700,color:"#1A7A3C"}}>GTS</span></div>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>성장 기록 시스템</span>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:"#fff",marginBottom:4}}>유치부 성장 기록</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.65)"}}>4~7세 · 아이의 성장 변화 중심</div>
          </div>
          <div style={{padding:"18px 24px 22px"}}>
            <div style={{marginBottom:16}}>
              {["이전 기록 대비 변화 자동 확인","참여도 · 자신감 · 사회성 기록","따뜻한 부모용 성장 리포트","Google Sheets 자동 누적 저장"].map(t=>(
                <div key={t} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:12,color:"rgba(255,255,255,0.7)"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"#2D9E57",flexShrink:0}}/>{t}
                </div>
              ))}
            </div>
            <button onClick={e=>{e.stopPropagation();setBrand("gts");}} style={{width:"100%",padding:"11px",borderRadius:9,border:"none",background:"#1A7A3C",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>GTS 시작하기 →</button>
          </div>
        </div>
        <div className="lp-card" onClick={()=>setBrand("ec")} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(200,16,46,0.3)",borderRadius:16,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
          <div style={{background:"linear-gradient(135deg,#0D1829,#1C2951)",padding:"24px 24px 20px",borderBottom:"2px solid #C8102E"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{background:"#C8102E",borderRadius:4,padding:"2px 8px"}}><span style={{fontSize:11,fontWeight:700,color:"#fff",letterSpacing:1.5}}>ELITE CORE</span></div>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>by GTS</span>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:"#fff",marginBottom:4}}>초등 운동발달 평가</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>8~13세 · 4회차 누적 성장 분석</div>
          </div>
          <div style={{padding:"18px 24px 22px"}}>
            <div style={{marginBottom:16}}>
              {["4회차 누적 데이터 자동 관리","기준·직전 회차 대비 변화량","성장 라인 그래프 + 레이더","코치 분석 자동 생성"].map(t=>(
                <div key={t} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:12,color:"rgba(255,255,255,0.7)"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"#C8102E",flexShrink:0}}/>{t}
                </div>
              ))}
            </div>
            <button onClick={e=>{e.stopPropagation();setBrand("ec");}} style={{width:"100%",padding:"11px",borderRadius:9,border:"none",background:"#C8102E",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Elite Core 시작하기 →</button>
          </div>
        </div>
      </div>
      <div style={{marginTop:40,fontSize:11,color:"rgba(255,255,255,0.2)"}}>두 시스템 모두 PDF 출력 · 코멘트 수정 · Google Sheets 자동 저장 지원</div>
    </div>
  );
}
