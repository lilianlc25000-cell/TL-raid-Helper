\"use client\";

import { useMemo, useState } from \"react\";
import { createClient } from \"@/lib/supabase/client\";

type EligibilityCriteria = \"loot_received\" | \"participation_points\" | \"activity_points\";

type EligibilityCriteriaSettingsClientProps = {
  ownerId: string | null;
  initialCriteria: string[];
};

const CRITERIA_OPTIONS: Array<{
  key: EligibilityCriteria;
  label: string;
  description: string;
}> = [
  {
    key: \"loot_received\",
    label: \"Nombre de loots reçus\",
    description: \"Priorité au plus petit nombre de loots.\",
  },
  {
    key: \"participation_points\",
    label: \"Points de participation\",
    description: \"Priorité au plus grand nombre de points.\",
  },
  {
    key: \"activity_points\",
    label: \"Points d'activité\",
    description: \"Priorité au plus grand nombre de points d'activité.\",
  },
];

export default function EligibilityCriteriaSettingsClient({
  ownerId,
  initialCriteria,
}: EligibilityCriteriaSettingsClientProps) {
  const [criteria, setCriteria] = useState<EligibilityCriteria[]>(
    (initialCriteria.filter(Boolean) as EligibilityCriteria[]) ?? [],
  );
  const [status, setStatus] = useState<\"idle\" | \"saving\" | \"success\" | \"error\">(
    \"idle\",
  );
  const [message, setMessage] = useState<string | null>(null);

  const hasChanges = useMemo(() => {
    const base = (initialCriteria ?? []) as EligibilityCriteria[];
    if (base.length !== criteria.length) {
      return true;
    }
    return base.some((value) => !criteria.includes(value));
  }, [criteria, initialCriteria]);

  const handleToggle = (key: EligibilityCriteria) => {
    setCriteria((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key],
    );
  };

  const handleSave = async () => {
    if (!ownerId) {
      setStatus(\"error\");
      setMessage(\"Aucune guilde active.\");
      return;
    }
    setStatus(\"saving\");
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from(\"guild_configs\")
      .update({ eligibility_criteria: criteria })
      .eq(\"owner_id\", ownerId);
    if (error) {
      setStatus(\"error\");
      setMessage(error.message || \"Impossible de sauvegarder.\");
      return;
    }
    setStatus(\"success\");
    setMessage(\"Critères mis à jour.\");
  };

  return (
    <div className=\"rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur\">
      <p className=\"text-xs uppercase tracking-[0.25em] text-text/50\">
        Éligibilité loot
      </p>
      <h2 className=\"mt-2 text-xl font-semibold text-text\">
        Critères de priorité
      </h2>
      <p className=\"mt-2 text-sm text-text/70\">
        Les admins peuvent activer 1, 2 ou 3 conditions.
      </p>
      <div className=\"mt-4 grid gap-3 sm:grid-cols-2\">
        {CRITERIA_OPTIONS.map((option) => (
          <button
            key={option.key}
            type=\"button\"
            onClick={() => handleToggle(option.key)}
            className={[
              \"rounded-xl border px-4 py-3 text-left text-sm transition\",
              criteria.includes(option.key)
                ? \"border-amber-400/60 bg-amber-400/10 text-amber-200\"
                : \"border-white/10 bg-black/40 text-text/70 hover:border-white/20\",
            ].join(\" \")}
          >
            <div className=\"flex items-center justify-between\">
              <span className=\"font-semibold text-text\">{option.label}</span>
              <span className=\"text-xs uppercase tracking-[0.2em]\">
                {criteria.includes(option.key) ? \"Actif\" : \"Inactif\"}
              </span>
            </div>
            <p className=\"mt-1 text-xs text-text/60\">{option.description}</p>
          </button>
        ))}
      </div>
      <div className=\"mt-4 flex items-center justify-between\">
        <span className=\"text-xs text-text/60\">{message}</span>
        <button
          type=\"button\"
          onClick={handleSave}
          disabled={status === \"saving\" || !hasChanges}
          className=\"rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60\"
        >
          {status === \"saving\" ? \"Sauvegarde...\" : \"Sauvegarder\"}
        </button>
      </div>
    </div>
  );
}
