"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GuildSetupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/guild/join");
  }, [router]);

  return (
    <div className="min-h-screen text-zinc-100">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-surface/70 px-6 py-6 text-sm text-text/70 shadow-[0_0_35px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10">
        Redirection vers la liste des guildes...
      </div>
    </div>
  );
}
