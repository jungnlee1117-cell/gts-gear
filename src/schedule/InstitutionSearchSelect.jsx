import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

export default function InstitutionSearchSelect({
  institutions = [],
  value,
  onChange,
  required = false,
  placeholder = "기관 이름 검색",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = useMemo(
    () => institutions.find(i => i.id === value) ?? null,
    [institutions, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return institutions;
    return institutions.filter(i => String(i.name || "").toLowerCase().includes(q));
  }, [institutions, query]);

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
          {filtered.length === 0 ? (
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
                    <span className="sch-inst-search-tag">센터</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
