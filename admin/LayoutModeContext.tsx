"use client";

import { createContext, useContext, useState } from "react";

interface LayoutModeContextValue {
  hideNav: boolean;
  setHideNav: (hide: boolean) => void;
}

const LayoutModeContext = createContext<LayoutModeContextValue | null>(null);

export function LayoutModeProvider({ children }: { children: React.ReactNode }) {
  const [hideNav, setHideNav] = useState(false);
  return (
    <LayoutModeContext.Provider value={{ hideNav, setHideNav }}>
      {children}
    </LayoutModeContext.Provider>
  );
}

export function useLayoutMode() {
  const ctx = useContext(LayoutModeContext);
  if (!ctx) {
    throw new Error("useLayoutMode moet binnen LayoutModeProvider gebruikt worden");
  }
  return ctx;
}
