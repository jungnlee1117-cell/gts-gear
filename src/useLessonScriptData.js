import { useCallback, useEffect, useState } from "react";
import {
  initLessonScriptAdminData,
  invalidateLessonScriptAdminData,
} from "./lessonScriptDataRepository.js";

export function useLessonScriptAdminData() {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    invalidateLessonScriptAdminData();
    setReady(false);
    setVersion(v => v + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    setError(null);

    initLessonScriptAdminData()
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch(err => {
        if (mounted) {
          setError(err);
          setReady(true);
        }
      });

    return () => { mounted = false; };
  }, [version]);

  return { ready, error, refresh, version };
}
