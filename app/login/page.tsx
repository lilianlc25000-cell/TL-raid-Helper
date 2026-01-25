import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen overflow-hidden bg-black text-zinc-100">
          <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-14">
            <div className="w-full rounded-3xl border border-amber-400/30 bg-white/5 p-8 text-center text-sm text-amber-200/80 shadow-[0_0_35px_rgba(0,0,0,0.6)] backdrop-blur">
              Chargement...
            </div>
          </div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
