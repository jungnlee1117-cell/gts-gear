import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMonthlyPlanPdfBlob, downloadPdfBlob } from "./monthlyPlanPdf.js";
import { buildMonitoringReportHtml } from "./monitoringReportPdf.js";

/** 수업 참관·모니터링 평가표 (GTS_수업모니터링_평가표)
 *  key는 저장된 기록과 연결되므로 한 번 정한 값은 바꾸지 않는다. 새 항목은 새 key를 쓴다. */
const TEMPLATE = [
  { area: "Ⅰ. 수업 전 (Pre-Class)", groups: [
    { title: "1. 교구 관리 및 환경 점검", items: [
      { key: "q1", text: "수업 시작 전 여유있는 현장 도착 및 준비상태" },
      { key: "q2", text: "복장, 용모 및 원내 태도 (밝은 에너지 및 인사)" },
      { key: "q3", text: "당일 차시 수업 계획 및 진도 숙지 상태" },
      { key: "q4", text: "수업 전 교구 및 주변 환경(위험 구역, 다칠 위험 등) 사전 점검 여부" },
      { key: "q26", text: "교구 청결 상태 (오염·파손 없이 깨끗하게 관리되는지)" },
      { key: "q27", text: "수업 계획안대로 교구를 챙겼는지" },
    ] },
  ] },
  { area: "Ⅱ. 수업 중 (In-Class)", groups: [
    { title: "2. 안전 관리", items: [
      { key: "q5", text: "준비운동(워밍업) 실시 여부" },
      { key: "q6", text: "안전 수칙 및 주의사항 전달" },
      { key: "q7", text: "기구·활동 중 보조(스팟팅) 등 지속적 안전 모니터링" },
    ] },
    { title: "3. 아동 존중 및 맞춤형 지도", items: [
      { key: "q8", text: "모든 아동에 대한 차별 없는 동등한 태도 및 긍정적 언어 사용" },
      { key: "q9", text: "위축감을 주는 표현이나 불필요한 신체 접촉 배제 여부" },
      { key: "q10", text: "어려워하는 아동에 대한 강압적 배제 대신 눈높이 설명 및 격려" },
      { key: "q11", text: "적극적 참여를 위한 동기부여·칭찬 기법 활용 및 갈등(다툼·소외 등) 중재의 적절성" },
    ] },
    { title: "4. 수업 운영 및 내용 충실도", items: [
      { key: "q12", text: "정해진 수업 시작 시간 준수 및 사전 준비 상태" },
      { key: "q13", text: "연령별 발달 수준에 맞춘 활동 난이도 조절 및 시각적 시범 병행" },
      { key: "q14", text: "다양한 교구 활용을 통한 단조로움 해소 및 몰입도 유도" },
      { key: "q15", text: "도입-전개-마무리의 체계적인 수업 구성" },
      { key: "q16", text: "지시어·설명의 명확성 및 전달력(목소리 크기·톤 포함)" },
    ] },
    { title: "5. 전문성 및 의사소통", items: [
      { key: "q17", text: "아이들 운동 발달에 맞춘 체육 지도 전문성" },
      { key: "q28", text: "정확한 영어 표현 지도 (GTS 영어 표현 기준 부합 여부)" },
      { key: "q18", text: "관리자, 담당선생님 응대 및 소통 태도" },
    ] },
  ] },
  { area: "Ⅲ. 수업 후 (마무리)", groups: [
    { title: "6. 수업 마무리", items: [
      { key: "q20", text: "정리운동(쿨다운) 및 신체 정돈 실시 여부" },
      { key: "q21", text: "아동 참여를 유도한 교구 정리정돈 지도 및 안전한 교구 회수" },
      { key: "q22", text: "수업 내용 요약 및 아동 성취에 대한 피드백·칭찬" },
      { key: "q23", text: "정규 수업 종료 시간 준수" },
      { key: "q24", text: "아동 하원·이동 시 안전 인계" },
      { key: "q25", text: "특이사항 기록 등 수업 후 행정 처리" },
    ] },
  ] },
];

const FLAT = [];
TEMPLATE.forEach(sec => sec.groups.forEach(g => g.items.forEach(it => {
  FLAT.push({ key: it.key, area: sec.area, group: g.title, criterion: it.text });
})));

const GRADES = [
  { id: "excellent", label: "우수" },
  { id: "adequate", label: "적정" },
  { id: "needs", label: "개선요망" },
];
const GRADE_LABEL = Object.fromEntries(GRADES.map(g => [g.id, g.label]));
const PURPOSES = { regular: "정기 월간 참관", intensive: "집중 모니터링" };

function todayYmd() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function countGrades(items) {
  const c = { excellent: 0, adequate: 0, needs: 0 };
  (items || []).forEach(it => { if (c[it.grade] !== undefined) c[it.grade] += 1; });
  return c;
}

function pct(row) {
  const total = (row.excellent_count || 0) + (row.adequate_count || 0) + (row.needs_count || 0);
  return total ? Math.round(((row.excellent_count || 0) / total) * 100) : null;
}

function emptyForm(me) {
  return {
    id: null,
    teacher_id: "",
    teacher_name: "",
    facility_name: "",
    class_name: "",
    observed_on: todayYmd(),
    observed_time: "",
    purpose: "regular",
    grades: {},
    positive_comment: "",
    improvement_comment: "",
    observer_name: me?.name || "",
  };
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function TeacherMonitoringHub({ supabase, me }) {
  const [rows, setRows] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [showSummary, setShowSummary] = useState(false);
  const [notice, setNotice] = useState("");
  const [pdfBusyId, setPdfBusyId] = useState("");
  const cardRef = useRef(null);

  const scrollToCard = () => {
    window.setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const flash = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("teacher_monitoring_evaluations")
      .select("*")
      .order("observed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (err) setError(/does not exist|relation/i.test(err.message) ? "평가표 저장소(DB)가 아직 준비되지 않았습니다. SQL 실행이 필요합니다." : err.message);
    else { setError(""); setRows(data || []); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let alive = true;
    supabase.from("teachers").select("id, name").is("resigned_at", null).order("name")
      .then(({ data }) => { if (alive) setTeachers(data || []); });
    return () => { alive = false; };
  }, [supabase]);

  const teacherNames = useMemo(
    () => [...new Set(rows.map(r => r.teacher_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")),
    [rows],
  );
  const visibleRows = useMemo(
    () => rows.filter(r => filterTeacher === "all" || r.teacher_name === filterTeacher),
    [rows, filterTeacher],
  );

  const summary = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const cur = map.get(r.teacher_name) || { name: r.teacher_name, n: 0, ex: 0, ad: 0, ne: 0, last: "" };
      cur.n += 1; cur.ex += r.excellent_count || 0; cur.ad += r.adequate_count || 0; cur.ne += r.needs_count || 0;
      if (!cur.last || r.observed_on > cur.last) cur.last = r.observed_on;
      map.set(r.teacher_name, cur);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [rows]);

  const openEdit = (row) => {
    const grades = {};
    (row.items || []).forEach(it => { if (it.grade) grades[it.key] = it.grade; });
    setForm({
      id: row.id,
      teacher_id: row.teacher_id || "",
      teacher_name: row.teacher_name || "",
      facility_name: row.facility_name || "",
      class_name: row.class_name || "",
      observed_on: row.observed_on,
      observed_time: row.observed_time || "",
      purpose: row.purpose || "regular",
      grades,
      positive_comment: row.positive_comment || "",
      improvement_comment: row.improvement_comment || "",
      observer_name: row.observer_name || me?.name || "",
    });
  };

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.teacher_name.trim()) { alert("담당 강사를 입력해 주세요."); return; }
    if (!form.observed_on) { alert("참관 일자를 선택해 주세요."); return; }
    const items = FLAT.map(q => ({ key: q.key, area: q.area, group: q.group, criterion: q.criterion, grade: form.grades[q.key] || null }));
    const answered = items.filter(i => i.grade).length;
    if (answered < items.length && !window.confirm(`평가 항목 ${items.length}개 중 ${answered}개만 체크했습니다. 이대로 저장할까요?`)) return;
    const c = countGrades(items);
    const payload = {
      teacher_id: form.teacher_id || null,
      teacher_name: form.teacher_name.trim(),
      facility_name: form.facility_name.trim(),
      class_name: form.class_name.trim(),
      observed_on: form.observed_on,
      observed_time: form.observed_time.trim(),
      purpose: form.purpose,
      items,
      excellent_count: c.excellent,
      adequate_count: c.adequate,
      needs_count: c.needs,
      positive_comment: form.positive_comment.trim(),
      improvement_comment: form.improvement_comment.trim(),
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    const res = form.id
      ? await supabase.from("teacher_monitoring_evaluations").update(payload).eq("id", form.id)
      : await supabase.from("teacher_monitoring_evaluations").insert({ ...payload, observer_id: me?.id || null, observer_name: me?.name || "" });
    setSaving(false);
    if (res.error) { alert(`저장하지 못했습니다: ${res.error.message}`); return; }
    const wasEdit = Boolean(form.id);
    setForm(null);
    flash(wasEdit ? "수정되었습니다." : "저장되었습니다.");
    scrollToCard();
    load();
  };

  const remove = async (row) => {
    if (!window.confirm(`${row.observed_on} ${row.teacher_name} 평가를 삭제할까요?`)) return;
    const { error: err } = await supabase.from("teacher_monitoring_evaluations").delete().eq("id", row.id);
    if (err) { alert(err.message); return; }
    flash("삭제되었습니다.");
    load();
  };

  const downloadPdf = async (row) => {
    setPdfBusyId(row.id);
    try {
      const html = buildMonitoringReportHtml(row, {
        template: TEMPLATE,
        logoUrl: new URL("/brand/gts-company-logo.png", window.location.origin).href,
      });
      const blob = await buildMonthlyPlanPdfBlob(html);
      downloadPdfBlob(blob, `수업모니터링_${row.teacher_name}_${row.observed_on}.pdf`);
      flash("PDF를 만들었습니다. 다운로드 폴더를 확인해 주세요.");
    } catch (err) {
      alert(`PDF를 만들지 못했습니다: ${err?.message || "알 수 없는 오류"}`);
    } finally {
      setPdfBusyId("");
    }
  };

  const exportCsv = () => {
    const head = ["참관일", "참관시간", "시설명", "참관 반명", "담당 강사", "참관자", "참관 목적", "우수", "적정", "개선요망", "우수율(%)",
      ...FLAT.map(q => `${q.group} | ${q.criterion}`), "우수 및 긍정 소견", "개선 필요 사항"];
    const lines = [head.map(csvCell).join(",")];
    visibleRows.forEach(r => {
      const byKey = Object.fromEntries((r.items || []).map(i => [i.key, i.grade]));
      lines.push([
        r.observed_on, r.observed_time, r.facility_name, r.class_name, r.teacher_name, r.observer_name, PURPOSES[r.purpose] || "",
        r.excellent_count, r.adequate_count, r.needs_count, pct(r) ?? "",
        ...FLAT.map(q => GRADE_LABEL[byKey[q.key]] || ""), r.positive_comment, r.improvement_comment,
      ].map(csvCell).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `수업모니터링평가_${todayYmd()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (form) {
    const answered = FLAT.filter(q => form.grades[q.key]).length;
    return (
      <section className="tme-card" ref={cardRef}>
        <div className="tme-head">
          <h3>{form.id ? "평가 수정" : "수업 참관 및 모니터링 리포트"}</h3>
          <span className="tme-muted">{answered} / {FLAT.length} 체크</span>
        </div>

        <h4 className="tme-sec">1. 참관 기본 정보</h4>
        <div className="tme-info">
          <label>시설명(원명)<input value={form.facility_name} onChange={e => setField("facility_name", e.target.value)} /></label>
          <label>참관 반명<input value={form.class_name} onChange={e => setField("class_name", e.target.value)} /></label>
          <label>담당 강사
            <input list="tme-teachers" value={form.teacher_name}
              onChange={e => {
                const name = e.target.value;
                const t = teachers.find(x => x.name === name);
                setForm(prev => ({ ...prev, teacher_name: name, teacher_id: t?.id || "" }));
              }} />
            <datalist id="tme-teachers">{teachers.map(t => <option key={t.id} value={t.name} />)}</datalist>
          </label>
          <label>참관 슈퍼바이저<input value={form.observer_name} readOnly /></label>
          <label>참관 일자<input type="date" value={form.observed_on} onChange={e => setField("observed_on", e.target.value)} /></label>
          <label>참관 시간<input value={form.observed_time} placeholder="예: 10:30" onChange={e => setField("observed_time", e.target.value)} /></label>
          <label className="tme-info__wide">참관 목적
            <span className="tme-radios">
              {Object.entries(PURPOSES).map(([id, label]) => (
                <label key={id} className="tme-radio"><input type="radio" checked={form.purpose === id} onChange={() => setField("purpose", id)} />{label}</label>
              ))}
            </span>
          </label>
        </div>

        <h4 className="tme-sec">2. 현장 모니터링 평가표</h4>
        <div className="tme-table">
          <div className="tme-row tme-row--head"><span>평가 영역</span><span>세부 점검 기준</span><span>평가 결과</span></div>
          {TEMPLATE.map(sec => (
            <div key={sec.area}>
              <div className="tme-area">{sec.area}</div>
              {sec.groups.map(g => g.items.map((it, idx) => {
                const q = it;
                return (
                  <div key={q.key} className="tme-row">
                    <span className="tme-group">{idx === 0 ? g.title : ""}</span>
                    <span>{it.text}</span>
                    <span className="tme-grades">
                      {GRADES.map(gr => (
                        <button key={gr.id} type="button"
                          className={`tme-grade tme-grade--${gr.id}${form.grades[q.key] === gr.id ? " is-on" : ""}`}
                          onClick={() => setForm(prev => ({ ...prev, grades: { ...prev.grades, [q.key]: prev.grades[q.key] === gr.id ? undefined : gr.id } }))}>
                          {gr.label}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              }))}
            </div>
          ))}
        </div>

        <h4 className="tme-sec">3. 종합 피드백 및 개선 이행 사항</h4>
        <label className="tme-text">우수 및 긍정 소견
          <textarea rows={3} value={form.positive_comment} onChange={e => setField("positive_comment", e.target.value)} />
        </label>
        <label className="tme-text">개선 필요 사항 (피드백 및 조치 계획)
          <textarea rows={3} value={form.improvement_comment} onChange={e => setField("improvement_comment", e.target.value)} />
        </label>

        <div className="tme-actions">
          <button type="button" className="tme-btn" onClick={() => { setForm(null); scrollToCard(); }} disabled={saving}>취소</button>
          <button type="button" className="tme-btn tme-btn--primary" onClick={save} disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="tme-card" ref={cardRef}>
      {notice ? <p className="tme-toast" role="status">✓ {notice}</p> : null}
      <div className="tme-head">
        <div>
          <h3>교사 모니터링 평가표</h3>
          <p className="tme-muted">대표·양의인·오정석만 볼 수 있습니다. 수업을 참관하고 체크한 평가가 데이터로 저장됩니다.</p>
        </div>
        <div className="tme-head__actions">
          <button type="button" className="tme-btn" onClick={exportCsv} disabled={!visibleRows.length}>엑셀(CSV) 내보내기</button>
          <button type="button" className="tme-btn tme-btn--primary" onClick={() => { setForm(emptyForm(me)); scrollToCard(); }}>+ 새 평가 작성</button>
        </div>
      </div>

      {error ? <p className="tme-error">{error}</p> : null}

      <div className="tme-filter">
        <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
          <option value="all">전체 강사</option>
          {teacherNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="button" className="tme-link" onClick={() => setShowSummary(v => !v)}>{showSummary ? "강사별 요약 닫기" : "강사별 요약 보기"}</button>
      </div>

      {showSummary && (
        <div className="tme-table tme-table--summary">
          <div className="tme-sum tme-sum--head"><span>강사</span><span>평가 횟수</span><span>우수</span><span>적정</span><span>개선요망</span><span>우수율</span><span>최근 참관</span></div>
          {summary.map(s => {
            const total = s.ex + s.ad + s.ne;
            return (
              <div key={s.name} className="tme-sum">
                <span>{s.name}</span><span>{s.n}</span><span>{s.ex}</span><span>{s.ad}</span><span>{s.ne}</span>
                <span>{total ? `${Math.round((s.ex / total) * 100)}%` : "-"}</span><span>{s.last}</span>
              </div>
            );
          })}
          {!summary.length && <p className="tme-empty">평가 기록이 없습니다.</p>}
        </div>
      )}

      <div className="tme-table">
        <div className="tme-list tme-list--head">
          <span>참관일</span><span>시설 / 반</span><span>강사</span><span>참관자</span><span>우수</span><span>적정</span><span>개선</span><span>우수율</span><span aria-hidden />
        </div>
        {loading ? <p className="tme-empty">불러오는 중...</p> : !visibleRows.length ? <p className="tme-empty">평가 기록이 없습니다. "새 평가 작성"으로 시작하세요.</p> : visibleRows.map(r => (
          <div key={r.id} className="tme-list">
            <span>{r.observed_on}</span>
            <span>{[r.facility_name, r.class_name].filter(Boolean).join(" / ") || "-"}</span>
            <span>{r.teacher_name}</span>
            <span>{r.observer_name || "-"}</span>
            <span>{r.excellent_count}</span><span>{r.adequate_count}</span><span>{r.needs_count}</span>
            <span>{pct(r) === null ? "-" : `${pct(r)}%`}</span>
            <span className="tme-row-actions">
              <button type="button" className="tme-link" onClick={() => downloadPdf(r)} disabled={pdfBusyId === r.id}>{pdfBusyId === r.id ? "생성 중..." : "PDF"}</button>
              <button type="button" className="tme-link" onClick={() => { openEdit(r); scrollToCard(); }}>보기·수정</button>
              <button type="button" className="tme-link tme-link--danger" onClick={() => remove(r)}>삭제</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
