import { useMemo, useState } from "react";

function normalizeName(s) {
  return String(s || "").trim().toLowerCase();
}

/**
 * 선생님 다중 선택 — 검색/엔터 + 칩 + 체크박스 목록
 * @param {{ teachers: Array<{id:string,name?:string}>, selectedIds: string[], onChange: (ids: string[]) => void, emptyText?: string }} props
 */
export default function TeacherMultiSelect({
  teachers = [],
  selectedIds = [],
  onChange,
  emptyText = "선택 가능한 선생님이 없습니다.",
}) {
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const selectedTeachers = useMemo(() => {
    const byId = new Map((teachers || []).map((t) => [t.id, t]));
    return (selectedIds || [])
      .map((id) => byId.get(id) || { id, name: "이름 없음" })
      .filter(Boolean);
  }, [teachers, selectedIds]);

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    const rows = teachers || [];
    if (!q) return rows;
    return rows.filter((t) => normalizeName(t.name).includes(q));
  }, [teachers, query]);

  const setSelected = (nextIds) => {
    onChange?.([...new Set(nextIds.filter(Boolean))]);
  };

  const toggle = (id) => {
    const cur = new Set(selectedIds || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    setSelected([...cur]);
    setHint("");
  };

  const remove = (id) => {
    setSelected((selectedIds || []).filter((x) => x !== id));
    setHint("");
  };

  const commitEnter = () => {
    const q = normalizeName(query);
    if (!q) return;

    const rows = teachers || [];
    const exact = rows.filter((t) => normalizeName(t.name) === q);
    const partial = rows.filter((t) => normalizeName(t.name).includes(q));

    let pick = null;
    if (exact.length === 1) {
      pick = exact[0];
    } else if (exact.length > 1) {
      setHint(`「${query.trim()}」동명이인이 ${exact.length}명입니다. 목록에서 골라 주세요.`);
      return;
    } else if (partial.length === 1) {
      pick = partial[0];
    } else if (partial.length === 0) {
      setHint(`「${query.trim()}」와 일치하는 선생님이 없습니다.`);
      return;
    } else {
      setHint(`「${query.trim()}」검색 결과가 ${partial.length}명입니다. 목록에서 골라 주세요.`);
      return;
    }

    if (!pick?.id) return;
    if (!selectedSet.has(pick.id)) {
      setSelected([...(selectedIds || []), pick.id]);
    }
    setQuery("");
    setHint("");
  };

  return (
    <div className="notice-audience-teachers teacher-multi-select">
      <div className="notice-audience-teachers__count">
        {(selectedIds || []).length}명 선택됨
      </div>

      {selectedTeachers.length > 0 ? (
        <div className="teacher-multi-select__chips" aria-label="선택된 선생님">
          {selectedTeachers.map((t) => (
            <button
              key={t.id}
              type="button"
              className="teacher-multi-select__chip"
              onClick={() => remove(t.id)}
              title="선택 해제"
            >
              <span>{t.name || "이름 없음"}</span>
              <span className="teacher-multi-select__chip-x" aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}

      <input
        type="search"
        className="teacher-multi-select__search"
        value={query}
        placeholder="이름 검색 후 Enter로 추가…"
        onChange={(e) => {
          setQuery(e.target.value);
          if (hint) setHint("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            commitEnter();
          }
        }}
        autoComplete="off"
      />
      {hint ? <p className="teacher-multi-select__hint">{hint}</p> : null}

      <div className="notice-audience-teachers__list">
        {(teachers || []).length === 0 ? (
          <p className="sch-muted" style={{ margin: 0 }}>{emptyText}</p>
        ) : filtered.length === 0 ? (
          <p className="sch-muted" style={{ margin: 0 }}>검색 결과가 없습니다.</p>
        ) : (
          filtered.map((t) => (
            <label key={t.id} className="notice-audience-teachers__item">
              <input
                type="checkbox"
                checked={selectedSet.has(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span>{t.name || "이름 없음"}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
