"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const WARNING_MESSAGE =
  "Je hebt niet-opgeslagen wijzigingen. Als je verdergaat, gaan deze verloren. Toch doorgaan?";

interface UnsavedChangesContextValue {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** Toont een bevestigingsvenster als er niet-opgeslagen wijzigingen zijn.
   *  Geeft true terug als het veilig is om verder te gaan (geen wijzigingen,
   *  of de gebruiker bevestigde dat hij ze wil verliezen). */
  confirmDiscard: () => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);

  // Beschermt tegen tab sluiten / verversen / weg-navigeren buiten de app.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = WARNING_MESSAGE;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const confirmDiscard = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(WARNING_MESSAGE);
  }, [isDirty]);

  return (
    <UnsavedChangesContext.Provider value={{ isDirty, setDirty: setIsDirty, confirmDiscard }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges moet binnen UnsavedChangesProvider gebruikt worden");
  }
  return ctx;
}

/**
 * Meldt de huidige "dirty" status van een pagina/formulier bij de gedeelde
 * context. Ruimt automatisch op bij het verlaten van de pagina (zodat de
 * vlag niet blijft "aanstaan" voor de volgende pagina).
 */
export function useSyncUnsavedChanges(dirty: boolean) {
  const { setDirty } = useUnsavedChanges();

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

  useEffect(() => {
    return () => setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
