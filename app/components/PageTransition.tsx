"use client";

import { usePathname } from "next/navigation";

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main key={pathname} className="page-transition px-5 pb-24 pt-20">
      {children}
    </main>
  );
}
