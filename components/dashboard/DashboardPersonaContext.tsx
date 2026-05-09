"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  DASHBOARD_PERSONA_STORAGE_KEY,
  getDashboardPersonaVisibility,
  parseDashboardPersona,
  type DashboardPersonaId,
  type DashboardPersonaVisibility,
} from "@/lib/dashboard/dashboardPersona";

export type DashboardPersonaContextValue = {
  persona: DashboardPersonaId;
  setPersona: (next: DashboardPersonaId) => void;
  visibility: DashboardPersonaVisibility;
};

const defaultVisibility = getDashboardPersonaVisibility("developer");

const fallbackContextValue: DashboardPersonaContextValue = {
  persona: "developer",
  setPersona: () => {},
  visibility: defaultVisibility,
};

const DashboardPersonaContext = createContext<DashboardPersonaContextValue | null>(
  null,
);

type DashboardPersonaProviderProps = {
  children: ReactNode;
};

export const DashboardPersonaProvider = ({ children }: DashboardPersonaProviderProps) => {
  const [persona, setPersonaState] = useState<DashboardPersonaId>("developer");

  useEffect(() => {
    const stored = parseDashboardPersona(
      window.localStorage.getItem(DASHBOARD_PERSONA_STORAGE_KEY),
    );
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persona from localStorage after mount (default matches SSR)
      setPersonaState(stored);
    }
  }, []);

  const setPersona = useCallback((next: DashboardPersonaId) => {
    setPersonaState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DASHBOARD_PERSONA_STORAGE_KEY, next);
    }
  }, []);

  const visibility = useMemo(() => getDashboardPersonaVisibility(persona), [persona]);

  const value = useMemo(
    () => ({ persona, setPersona, visibility }),
    [persona, setPersona, visibility],
  );

  return (
    <DashboardPersonaContext.Provider value={value}>{children}</DashboardPersonaContext.Provider>
  );
};

/**
 * Returns dashboard persona visibility. Outside `DashboardPersonaProvider`, defaults to
 * developer (full UI) so isolated components and tests stay unchanged.
 */
export const useDashboardPersona = (): DashboardPersonaContextValue => {
  const ctx = useContext(DashboardPersonaContext);
  return ctx ?? fallbackContextValue;
};
