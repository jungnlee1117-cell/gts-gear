import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";

export default function UserMenuDropdown({
  me,
  email,
  onLogout,
  extraItems = [],
  triggerClassName = "",
  menuClassName = "",
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={`user-menu ${menuClassName}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`user-menu__trigger ${triggerClassName}`.trim()}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-menu__name">{me?.name || "선생님"}님</span>
        <span className="user-menu__caret" aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__head">
            <div className="user-menu__head-name">{me?.name}</div>
            {email ? <div className="user-menu__head-email">{email}</div> : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="user-menu__item"
            onClick={() => {
              setOpen(false);
              navigate("/my-profile");
            }}
          >
            <Settings size={15} strokeWidth={2} />
            내 정보
          </button>
          {extraItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="user-menu__item"
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              {item.icon || null}
              {item.label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="user-menu__item user-menu__item--danger"
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
          >
            <LogOut size={15} strokeWidth={2} />
            로그아웃
          </button>
        </div>
      ) : null}
    </div>
  );
}
