import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export default function ClientOnly({ children }: { children: ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-lg bg-gray-900/50 text-gray-500 animate-pulse">
        Chargement du lecteur...
      </div>
    );
  }

  return <>{children}</>;
}
