import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { NAV_PATHS } from "./EnglishProgramSidebar.jsx";

/** 영어 프로그램 사이드바 메뉴 → React Router 경로 */
export function useEnglishProgramNavigate() {
  const navigate = useNavigate();

  return useCallback((nav) => {
    const path = NAV_PATHS[nav];
    if (!path) return;
    if (nav === "gear-scripts") {
      navigate("/english-script?picker=1");
      return;
    }
    navigate(path);
  }, [navigate]);
}
