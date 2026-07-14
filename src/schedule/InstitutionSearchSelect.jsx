import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

/**
 * 기관 검색 선택.
 * allowCreate: 목록에 없으면 새 기관명으로 추가 가능
 * showInactive: 비활성 기관도 결과에 포함
 */
export default function InstitutionSearchSelect({
  institutions = [],
  value,
  onChange,
  required = false,
  placeholder = "기관 이름 검색",
  allowCreate = false,
  onCreateInstitution,
  creating = false,
  showInactive = false,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = useMemo(
    () => institutions.find(i => i.id === value) ?? null,
    [institutions, value],
  );

  const visibleInstitutions = useMemo(() => {
    if (showInactive) return institutions;
    return institutions.filter(i => i.is_active !== false || i.id === value);
  }, [institutions, showInactive, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleInstitutions;
    return visibleInstitutions.filter(i => String(i.name || "").toLowerCase().includes(q));
  }, [visibleInstitutions, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return visibleInstitutions.find(i => String(i.name || "").trim().toLowerCase() === q) ?? null;
  }, [visibleInstitutions, query]);

  const canCreate = allowCreate
    && onCreateInstitution
    && query.trim()
    && !exactMatch
    && !creating;

  useEffect(() => {
    if (!open) {
      setQuery(selected?.name || "");
    }
  }, [selected, open]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (inst) => {
    onChange(inst?.id || "");
    setQuery(inst?.name || "");
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || !onCreateInstitution) return;
    const created = await onCreateInstitution(name);
    if (created?.id) {
      pick(created);
    }
  };

  return (
    <div className="sch-inst-search" ref={rootRef}>
      <div className="sch-search-inline sch-inst-search-input">
        <Search size={16}/>
        <input
          type="text"
          className="sch-input"
          value={query}
          placeholder={placeholder}
          required={required && !value}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onChange("");
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open ? (
        <ul className="sch-inst-search-list" role="listbox">
          {filtered.length === 0 && !canCreate ? (
            <li className="sch-inst-search-empty">검색 결과가 없습니다</li>
          ) : (
            filtered.map(inst => (
              <li key={inst.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={inst.id === value}
                  className={[
                    "sch-inst-search-option",
                    inst.id === value && "sch-inst-search-option--selected",
                    inst.is_active === false && "sch-inst-search-option--inactive",
                  ].filter(Boolean).join(" ")}
                  onClick={() => pick(inst)}
                >
                  {inst.name}
                  {inst.is_active === false ? (
                    <span className="sch-inst-search-tag">비활성</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
          {canCreate ? (
            <li>
              <button
                type="button"
                className="sch-inst-search-option sch-inst-search-option--create"
                onClick={handleCreate}
              >
                「{query.trim()}」 새 기관으로 추가
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
