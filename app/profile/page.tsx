"use client";

import Image from "next/image";
import {
  Shield,
  Sparkles,
  Swords,
  WandSparkles,
} from "lucide-react";
import DiceRoller from "../components/DiceRoller";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const weapons = [
  "Arbalète",
  "Épée et Bouclier",
  "Dagues",
  "Lance",
  "Arc Long",
  "Baguette",
  "Espadon",
  "Orbe",
  "Bâton",
];

const weaponImages: Record<string, string> = {
  "Arbalète": "/weapons/arbalete.png",
  "Épée et Bouclier": "/weapons/epee_bouclier.png",
  "Dagues": "/weapons/dagues.png",
  "Lance": "/weapons/lance.png",
  "Arc Long": "/weapons/arc_long.png",
  "Baguette": "/weapons/baguette.png",
  "Espadon": "/weapons/espadon.png",
  "Orbe": "/weapons/orbe.png",
  "Bâton": "/weapons/baton.png",
};

const roleOptions = [
  { id: "Tank", label: "Tank", icon: Shield },
  { id: "DPS", label: "DPS", icon: Swords },
  { id: "Heal", label: "Heal", icon: WandSparkles },
] as const;

const archetypes: Record<string, string[]> = {
  Tank: ["Tank Caillou (Full Def)", "Tank DPS (Bruiser)", "Tank Collision (CC)"],
  DPS: ["Glass Cannon (Full Dmg)", "DPS Évasion", "DPS Robustesse"],
  Heal: ["Full Support", "Heal/DPS Hybrid", "Soutien Buff"],
};

const comboNames: Record<string, string> = {
  "Arbalète|Baguette": "Colère",
  "Arbalète|Bâton": "Tisse-Guerre",
  "Arbalète|Dagues": "Scorpion",
  "Arbalète|Épée et Bouclier": "Bandit",
  "Arbalète|Espadon": "Guide",
  "Arbalète|Lance": "Cavalier",
  "Arc Long|Arbalète": "Éclaireur",
  "Arc Long|Bâton": "Libérateur",
  "Arc Long|Baguette": "Chercheur",
  "Arc Long|Dagues": "Infiltré",
  "Arc Long|Épée et Bouclier": "Gardien",
  "Arc Long|Espadon": "Rôdeur",
  "Arc Long|Lance": "Empaleur",
  "Arc Long|Orbe": "Voyant",
  "Bâton|Baguette": "Invocateur",
  "Bâton|Dagues": "Sorcelame",
  "Bâton|Épée et Bouclier": "Disciple",
  "Bâton|Espadon": "Sentinelle",
  "Bâton|Lance": "Éradicateur",
  "Bâton|Orbe": "Énigme",
  "Dagues|Baguette": "Sombrepeste",
  "Dagues|Épée et Bouclier": "Berserker",
  "Dagues|Espadon": "Écorcheur",
  "Dagues|Lance": "Danse-Ombre",
  "Dagues|Orbe": "Lunarch",
  "Espadon|Baguette": "Paladin",
  "Espadon|Épée et Bouclier": "Croisé",
  "Espadon|Lance": "Gladiateur",
  "Espadon|Orbe": "Justicier",
  "Épée et Bouclier|Baguette": "Templier",
  "Épée et Bouclier|Lance": "Coeur-Acier",
  "Épée et Bouclier|Orbe": "Gardien",
  "Lance|Baguette": "Lance du Vide",
  "Lance|Orbe": "Polaris",
  "Orbe|Arbalète": "Crucifère",
  "Orbe|Baguette": "Oracle",
};

const normalizeComboKey = (weaponA: string, weaponB: string) =>
  [weaponA, weaponB].sort((a, b) => a.localeCompare(b, "fr")).join("|");

type RollRequest = {
  id: string;
  itemName: string;
};

type WeaponSelectorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  highlighted?: boolean;
};

function WeaponSelector({ label, value, onChange, highlighted }: WeaponSelectorProps) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const handleScroll = (event: Event) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleResize = () => setOpen(false);
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!buttonRef.current) {
      return;
    }
    setMenuRect(buttonRef.current.getBoundingClientRect());
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border bg-black/40 px-4 py-3 text-left text-sm transition ${
          highlighted
            ? "border-primary/60 ring-2 ring-primary/30 text-text"
            : "border-white/10 text-text/80 hover:text-text"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          {value ? (
            <Image
              src={weaponImages[value]}
              alt={value}
              width={36}
              height={36}
              className="h-9 w-9 rounded-md object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/50 text-text/40">
              <Swords className="h-4 w-4" />
            </span>
          )}
          <span className="min-w-0 truncate text-sm text-text/80">
            {value || "Choisir une arme..."}
          </span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-text/40 sm:text-xs sm:tracking-[0.25em]">
          {label}
        </span>
      </button>

      {open && menuRect
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[999] max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-surface/95 p-2 shadow-[0_0_25px_rgba(0,0,0,0.45)] backdrop-blur"
              style={{
                top: menuRect.bottom + 8,
                left: menuRect.left,
                width: menuRect.width,
              }}
            >
              {weapons.map((weapon) => (
                <button
                  key={weapon}
                  type="button"
                  onClick={() => {
                    onChange(weapon);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-text/80 transition hover:bg-primary/20 hover:text-text"
                >
                  <Image
                    src={weaponImages[weapon]}
                    alt={weapon}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-md object-cover"
                  />
                  <span>{weapon}</span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cp, setCp] = useState("");
  const [weapon1, setWeapon1] = useState("");
  const [weapon2, setWeapon2] = useState("");
  const [role, setRole] = useState("");
  const [archetype, setArchetype] = useState("");
  const [rollRequest, setRollRequest] = useState<RollRequest | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [discordLinked, setDiscordLinked] = useState(false);
  const [discordLinkLoading, setDiscordLinkLoading] = useState(false);
  const [discordLinkError, setDiscordLinkError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const rollChannelRef = useRef<BroadcastChannel | null>(null);
  const playerName = name || "Mozorh";
  const isProfileValid =
    Boolean(name.trim()) &&
    Number.isFinite(Number(cp)) &&
    Number(cp) > 0 &&
    Boolean(weapon1) &&
    Boolean(weapon2) &&
    Boolean(role) &&
    Boolean(archetype);

  useEffect(() => {
    let isMounted = true;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setProfileError("Supabase n'est pas configuré (URL / ANON KEY).");
      return () => {
        isMounted = false;
      };
    }

    const syncUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }
      const sessionUser = data.session?.user;
      if (!sessionUser?.id) {
        setProfileError(
          "Veuillez vous connecter pour sauvegarder votre profil.",
        );
        return;
      }
      setUserId(sessionUser.id);
    };

    syncUser();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadDiscordIdentity = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!isMounted) {
        return;
      }
      const identities = data.user?.identities ?? [];
      setDiscordLinked(identities.some((identity) => identity.provider === "discord"));
    };
    loadDiscordIdentity();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setProfileError("Supabase n'est pas configuré (URL / ANON KEY).");
        setIsProfileLoaded(true);
        return;
      }
      if (!userId) {
        setIsProfileLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("ingame_name,main_weapon,off_weapon,role,archetype,gear_score")
        .eq("user_id", userId)
        .single();
      if (!isMounted) {
        return;
      }
      if (data) {
        setName(data.ingame_name ?? "");
        setCp(
          typeof data.gear_score === "number" ? String(data.gear_score) : "",
        );
        setWeapon1(data.main_weapon ?? "");
        setWeapon2(data.off_weapon ?? "");
        setRole(data.role ?? "");
        setArchetype(data.archetype ?? "");
      }
      setIsProfileLoaded(true);
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleSaveProfile = async () => {
    if (!userId) {
      setProfileError("Veuillez vous connecter pour sauvegarder votre profil.");
      return;
    }
    if (!isProfileValid) {
      setProfileError(
        "Complète toutes les cases (pseudo, puissance, armes, rôle et sous-classe).",
      );
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setProfileError("Supabase n'est pas configuré.");
      return;
    }
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);
    const { data: existingProfile, error: existingError } = await supabase
      .from("profiles")
      .select("id,guild_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) {
      setProfileError(
        `Impossible de sauvegarder le profil (${existingError.message}).`,
      );
      setIsSavingProfile(false);
      return;
    }

    const payload = {
      user_id: userId,
      ingame_name: name.trim(),
      main_weapon: weapon1,
      off_weapon: weapon2,
      role,
      archetype,
      gear_score: Number(cp),
    };

    const { error } = existingProfile?.id
      ? await supabase.from("profiles").update(payload).eq("id", existingProfile.id)
      : await supabase.from("profiles").insert(payload);

    if (error) {
      setProfileError(`Impossible de sauvegarder le profil (${error.message}).`);
      setIsSavingProfile(false);
      return;
    }
    setProfileSuccess("Profil sauvegardé.");
    setIsSavingProfile(false);
    const targetRoute = existingProfile?.guild_id ? "/" : "/guild/join";
    router.replace(targetRoute);
  };

  useEffect(() => {
    const handlePayload = (payload: {
      type?: string;
      requestId?: string;
      playerId?: string;
      playerName?: string;
      itemName?: string;
    }) => {
      if (payload?.type !== "REQUEST_ROLL") {
        return;
      }
      setRollRequest({
        id: payload.requestId ?? crypto.randomUUID(),
        itemName: payload.itemName ?? "Objet inconnu",
      });
    };

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel("loot-rolls");
      rollChannelRef.current = channel;
      channel.addEventListener("message", (event) => {
        handlePayload(event.data ?? {});
      });
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "loot-rolls" || !event.newValue) {
        return;
      }
      try {
        handlePayload(JSON.parse(event.newValue));
      } catch {
        return;
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      if (channel) {
        channel.close();
      }
      rollChannelRef.current = null;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const className = useMemo(() => {
    if (!weapon1 || !weapon2) {
      return "Classe inconnue";
    }
    const key = normalizeComboKey(weapon1, weapon2);
    return comboNames[key] ?? `${weapon1} / ${weapon2}`;
  }, [weapon1, weapon2]);

  const handleDiscordLink = async () => {
    setDiscordLinkError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setDiscordLinkError("Supabase n'est pas configuré.");
      return;
    }
    setDiscordLinkLoading(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/profile` },
    });
    if (error) {
      setDiscordLinkError(error.message);
      setDiscordLinkLoading(false);
      return;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="rounded-3xl border border-gold/50 bg-surface/70 px-5 py-5 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold/70 sm:tracking-[0.4em]">
              Profil Agent
            </p>
            <h1 className="mt-2 font-display text-2xl tracking-[0.12em] text-text sm:text-3xl sm:tracking-[0.15em]">
              Identité de Combat
            </h1>
            {profileError ? (
              <p className="mt-2 text-sm text-red-300">{profileError}</p>
            ) : null}
            {profileSuccess ? (
              <p className="mt-2 text-sm text-emerald-300">{profileSuccess}</p>
            ) : null}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-text/50 sm:tracking-[0.25em]">
              Rang de Guilde
            </p>
            <p className="mt-2 text-lg font-semibold text-text">Soldat</p>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={!isProfileValid || isSavingProfile}
              className="mt-4 w-full rounded-2xl border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSavingProfile ? "Sauvegarde..." : "Sauvegarder"}
            </button>
            {!isProfileValid ? (
              <p className="mt-2 text-xs text-text/50">
                Complète toutes les infos pour sauvegarder.
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="relative z-20 rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <h2 className="text-sm uppercase tracking-[0.3em] text-text/50">
              Identité
            </h2>
            <div className="mt-5 grid gap-4">
              <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Pseudo (Ingame Name)
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Nyxara"
                  className="bg-transparent text-sm text-text outline-none"
                />
              </label>

              <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-text/50">
                  <Sparkles className="h-4 w-4 text-gold" />
                  Gear Score (Puissance)
                </span>
                <input
                  value={cp}
                  onChange={(event) => setCp(event.target.value)}
                  type="number"
                  placeholder="Ex: 18900"
                  className="bg-transparent text-sm text-text outline-none"
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <h2 className="text-sm uppercase tracking-[0.3em] text-text/50">
              Arsenal
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <WeaponSelector
                label="Arme 1"
                value={weapon1}
                onChange={setWeapon1}
                highlighted={Boolean(weapon1)}
              />
              <WeaponSelector
                label="Arme 2"
                value={weapon2}
                onChange={setWeapon2}
                highlighted={Boolean(weapon2)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-indigo-400/30 bg-indigo-500/5 p-6 text-center shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-200/80 sm:tracking-[0.25em]">
              Compte Discord
            </p>
            <p className="mt-2 text-sm text-indigo-100/80">
              {discordLinked
                ? "Votre compte Discord est lié."
                : "Liez votre compte Discord pour une connexion rapide."}
            </p>
            {discordLinkError ? (
              <p className="mt-3 text-xs text-red-300">{discordLinkError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleDiscordLink}
              disabled={discordLinked || discordLinkLoading}
              className="mt-4 w-full rounded-2xl border border-indigo-400/50 bg-indigo-400/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-indigo-200 transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {discordLinked
                ? "Discord déjà lié"
                : discordLinkLoading
                  ? "Connexion..."
                  : "Lier Discord"}
            </button>
          </div>
          <div className="relative z-0 rounded-3xl border border-white/10 bg-surface/70 p-6 text-center shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-text/50 sm:tracking-[0.25em]">
              Nom de Classe
            </p>
            <p
              key={className}
              className="mt-4 animate-fade-in break-words font-cinzel text-3xl tracking-[0.12em] text-transparent bg-clip-text bg-gradient-to-r from-gold via-orange-300 to-primary sm:text-4xl sm:tracking-[0.15em]"
            >
              {className}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-text/40 sm:tracking-[0.3em]">
              Déterminé par vos armes
            </p>
          </div>

          <div className="relative z-0 rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <h2 className="text-sm uppercase tracking-[0.3em] text-text/50">
              Rôle Principal
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = role === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setRole(option.id);
                      setArchetype("");
                    }}
                    className={`flex flex-col items-center gap-2 rounded-2xl border bg-black/40 px-4 py-3 text-sm transition ${
                      isSelected
                        ? "border-primary/60 ring-2 ring-primary/30 text-text"
                        : "border-white/10 text-text/70 hover:text-text"
                    }`}
                  >
                    <Icon className="h-5 w-5 text-gold" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.25em] text-text/50">
                Sous-classe
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(archetypes[role] ?? []).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setArchetype(label)}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                      archetype === label
                        ? "border-primary/60 ring-2 ring-primary/30 text-text"
                        : "border-white/10 bg-black/40 text-text/70 hover:text-text"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {!role && (
                  <span className="text-xs text-text/40">
                    Sélectionnez un rôle pour voir les archetypes.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <DiceRoller
        isOpen={Boolean(rollRequest)}
        itemName={rollRequest?.itemName ?? ""}
        playerName={playerName}
        requestId={rollRequest?.id}
        onClose={() => setRollRequest(null)}
        onSubmitRoll={async (rollValue) => {
          rollChannelRef.current?.postMessage({
            type: "ROLL_RESULT",
            requestId: rollRequest?.id,
            playerId,
            playerName,
            itemName: rollRequest?.itemName ?? "Objet inconnu",
            rollValue,
          });

          await fetch("/api/loot-rolls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: playerId,
              item_name: rollRequest?.itemName ?? "Objet inconnu",
              roll_value: rollValue,
            }),
          }).catch(() => null);
        }}
      />
    </div>
  );
}

