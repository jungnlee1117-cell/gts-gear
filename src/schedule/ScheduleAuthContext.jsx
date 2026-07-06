import { createContext, useContext } from "react";

export const ScheduleAuthContext = createContext(true);

export function useScheduleAuthReady() {
  return useContext(ScheduleAuthContext);
}
