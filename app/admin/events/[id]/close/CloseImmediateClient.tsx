"use client";

import { useActionState, useEffect } from "react";

type ActionState = {
  ok: boolean;
  message: string;
};

type CloseImmediateClientProps = {
  eventId: string;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
};

const initialState: ActionState = { ok: false, message: "" };

export default function CloseImmediateClient({
  eventId,
  action,
}: CloseImmediateClientProps) {
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    const formData = new FormData();
    formData.set("eventId", eventId);
    formAction(formData);
  }, [eventId, formAction]);

  return (
    <div className="min-h-screen text-zinc-100">
      <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-400/60 bg-emerald-500/10 px-6 py-10 text-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
          Événement terminé
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-emerald-100">
          {state.ok
            ? state.message || "L'événement a été clôturé."
            : "Clôture en cours..."}
        </h1>
      </div>
    </div>
  );
}
