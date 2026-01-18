"use client";

import { usePathname } from "next/navigation";

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main
      key={pathname}
      className="page-transition mx-auto w-full max-w-6xl px-4 pb-28 pt-20 sm:px-6 xl:max-w-7xl"
    >
      {children}
    </main>
  );
}
