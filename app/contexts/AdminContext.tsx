"use client";

import { createContext, useContext, useMemo, useState } from "react";

type AdminContextValue = {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
};

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(false);

  const value = useMemo(
    () => ({
      isAdminMode,
      toggleAdminMode: () => setIsAdminMode((prev) => !prev),
    }),
    [isAdminMode],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminMode() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdminMode must be used within AdminProvider");
  }
  return context;
}
