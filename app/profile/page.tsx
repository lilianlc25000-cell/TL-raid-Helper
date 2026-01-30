"use client";

import Image from "next/image";
import {
  Crown,
  Shield,
  Sparkles,
  Swords,
  WandSparkles,
} from "lucide-react";
import DiceRoller from "../components/DiceRoller";
import { createClient } from "../../lib/supabase/client";
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

const getClassNameFromWeapons = (weaponA: string, weaponB: string) => {
  if (!weaponA || !weaponB) {
    return "";
  }
  const key = normalizeComboKey(weaponA, weaponB);
  return comboNames[key] ?? `${weaponA} / ${weaponB}`;
};


type RollRequest = {
  id: string;
  itemName: string;
};

type BuildEntry = {
  id: string;
  name: string;
  role: string;
  archetype: string | null;
  mainWeapon: string;
  offWeapon: string;
  contentType: "PVE" | "PVP" | null;
  gearScore: number | null;
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [builds, setBuilds] = useState<BuildEntry[]>([]);
  const [buildWeapon1, setBuildWeapon1] = useState("");
  const [buildWeapon2, setBuildWeapon2] = useState("");
  const [buildRole, setBuildRole] = useState("");
  const [buildArchetype, setBuildArchetype] = useState("");
  const [buildContentType, setBuildContentType] = useState<"PVE" | "PVP" | "">(
    "",
  );
  const [buildGearScore, setBuildGearScore] = useState("");
  const [editingBuildId, setEditingBuildId] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildSuccess, setBuildSuccess] = useState<string | null>(null);
  const [isSavingBuild, setIsSavingBuild] = useState(false);
  const [isMainBuildPickerOpen, setIsMainBuildPickerOpen] = useState(false);
  const [isBuildPanelOpen, setIsBuildPanelOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [participationPoints, setParticipationPoints] = useState<number>(0);
  const [activityPoints, setActivityPoints] = useState<number>(0);
  const [activityFile, setActivityFile] = useState<File | null>(null);
  const [activityStatus, setActivityStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [roleRank, setRoleRank] = useState<string>("soldat");
  const [profileGuildId, setProfileGuildId] = useState<string | null>(null);
  const rollChannelRef = useRef<BroadcastChannel | null>(null);
  const didAutoApplyMainBuild = useRef(false);
  const playerName = name || "Mozorh";
  const isProfileValid =
    Boolean(name.trim());

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

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
    const loadProfile = async () => {
      const supabase = createClient();
      if (!userId) {
        setIsProfileLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(
          "ingame_name,main_weapon,off_weapon,role,archetype,gear_score,cohesion_points,activity_points,guild_id,role_rank",
        )
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
        setParticipationPoints(data.cohesion_points ?? 0);
        setActivityPoints(data.activity_points ?? 0);
        setProfileGuildId(data.guild_id ?? null);
        setRoleRank(data.role_rank ?? "soldat");
      }
      setIsProfileLoaded(true);
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          const base64 = result.split(",")[1] ?? "";
          resolve(base64);
        } else {
          reject(new Error("Format de fichier invalide."));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleActivityUpload = async () => {
    if (!activityFile) {
      setActivityMessage("Sélectionnez une image.");
      setActivityStatus("error");
      return;
    }
    setActivityStatus("loading");
    setActivityMessage(null);
    try {
      const base64 = await fileToBase64(activityFile);
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("activity-ocr", {
        body: { image_base64: base64, source: "app" },
      });
      if (error) {
        setActivityStatus("error");
        setActivityMessage(
          error.message || "Impossible d'analyser l'image.",
        );
        return;
      }
      const points =
        typeof data?.points === "number" ? data.points : Number(data?.points);
      if (Number.isNaN(points)) {
        setActivityStatus("error");
        setActivityMessage("Aucun score détecté.");
        return;
      }
      setActivityPoints(points);
      setActivityStatus("success");
      setActivityMessage("Points d'activité mis à jour.");
    } catch (err) {
      setActivityStatus("error");
      setActivityMessage(
        err instanceof Error ? err.message : "Erreur inconnue.",
      );
    }
  };

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    let isMounted = true;
    const loadBuilds = async () => {
      if (!userId) {
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("player_builds")
        .select(
          "id,build_name,role,archetype,main_weapon,off_weapon,content_type,gear_score",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (!isMounted) {
        return;
      }
      if (error) {
        setBuildError(error.message || "Impossible de charger vos builds.");
        return;
      }
      const nextBuilds =
        (data ?? []).map((build) => ({
          id: build.id,
          name: build.build_name,
          role: build.role,
          archetype: build.archetype,
          mainWeapon: build.main_weapon,
          offWeapon: build.off_weapon,
          contentType:
            build.content_type === "PVP" || build.content_type === "PVE"
              ? build.content_type
              : null,
          gearScore:
            typeof build.gear_score === "number" ? build.gear_score : null,
        })) ?? [];
      setBuilds(nextBuilds);
      if (
        nextBuilds.length === 1 &&
        !didAutoApplyMainBuild.current &&
        !(weapon1 && weapon2 && role)
      ) {
        didAutoApplyMainBuild.current = true;
        handleApplyMainBuild(nextBuilds[0].id, nextBuilds[0]);
      }
    };
    loadBuilds();
    return () => {
      isMounted = false;
    };
  }, [userId, weapon1, weapon2, role]);

  const handleSaveProfile = async () => {
    if (!userId) {
      setProfileError("Veuillez vous connecter pour sauvegarder votre profil.");
      return;
    }
    if (!isProfileValid) {
      setProfileError(
        "Renseigne ton pseudo pour sauvegarder le profil.",
      );
      return;
    }
    const supabase = createClient();
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
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const { error: grantError } = await supabase.functions.invoke(
      "discord-grant-role",
      {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
    );
    if (!grantError) {
      setToastMessage(
        "Compte lié ! Vous avez maintenant accès aux salons Discord.",
      );
    }
    const targetRoute = existingProfile?.guild_id ? "/" : "/guild/join";
    window.setTimeout(() => {
      router.replace(targetRoute);
    }, 900);
  };

  const resetBuildForm = () => {
    setBuildWeapon1("");
    setBuildWeapon2("");
    setBuildRole("");
    setBuildArchetype("");
    setBuildContentType("");
    setBuildGearScore("");
    setEditingBuildId(null);
  };

  const handleSaveBuild = async () => {
    if (!userId) {
      setBuildError("Veuillez vous connecter pour créer un build.");
      return;
    }
    const gearScoreValue = Number(buildGearScore);
    if (
      !buildWeapon1 ||
      !buildWeapon2 ||
      !buildRole ||
      !buildContentType ||
      !Number.isFinite(gearScoreValue) ||
      gearScoreValue <= 0
    ) {
      setBuildError(
        "Complète le nom, le rôle, le contenu, le gear score et les deux armes.",
      );
      return;
    }
    const computedName = getClassNameFromWeapons(buildWeapon1, buildWeapon2);
    const supabase = createClient();
    setBuildError(null);
    setBuildSuccess(null);
    setIsSavingBuild(true);
    const payload = {
      user_id: userId,
      guild_id: profileGuildId,
      build_name: computedName,
      role: buildRole,
      archetype: buildArchetype || null,
      main_weapon: buildWeapon1,
      off_weapon: buildWeapon2,
      content_type: buildContentType,
      gear_score: gearScoreValue,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingBuildId
      ? await supabase
          .from("player_builds")
          .update(payload)
          .eq("id", editingBuildId)
      : await supabase.from("player_builds").insert(payload);
    if (error) {
      setBuildError(
        error.message || "Impossible de sauvegarder votre build.",
      );
      setIsSavingBuild(false);
      return;
    }
    setBuildSuccess("Build sauvegardé.");
    setIsSavingBuild(false);
    resetBuildForm();
    const { data } = await supabase
      .from("player_builds")
      .select(
        "id,build_name,role,archetype,main_weapon,off_weapon,content_type,gear_score",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    const nextBuilds =
      (data ?? []).map((build) => ({
        id: build.id,
        name: build.build_name,
        role: build.role,
        archetype: build.archetype,
        mainWeapon: build.main_weapon,
        offWeapon: build.off_weapon,
        contentType:
          build.content_type === "PVP" || build.content_type === "PVE"
            ? build.content_type
            : null,
        gearScore:
          typeof build.gear_score === "number" ? build.gear_score : null,
      })) ?? [];
    setBuilds(nextBuilds);
    if (
      nextBuilds.length === 1 &&
      !didAutoApplyMainBuild.current &&
      !(weapon1 && weapon2 && role)
    ) {
      didAutoApplyMainBuild.current = true;
      handleApplyMainBuild(nextBuilds[0].id, nextBuilds[0]);
    }
  };

  const handleEditBuild = (build: BuildEntry) => {
    setEditingBuildId(build.id);
    setBuildWeapon1(build.mainWeapon);
    setBuildWeapon2(build.offWeapon);
    setBuildRole(build.role);
    setBuildArchetype(build.archetype ?? "");
    setBuildContentType(build.contentType ?? "");
    setBuildGearScore(
      typeof build.gearScore === "number" ? String(build.gearScore) : "",
    );
    setBuildError(null);
    setBuildSuccess(null);
    setIsBuildPanelOpen(true);
  };

  const handleApplyMainBuild = async (
    buildId: string,
    buildOverride?: BuildEntry,
  ) => {
    const selected =
      buildOverride ?? builds.find((build) => build.id === buildId);
    if (!selected) {
      return;
    }
    if (!userId) {
      setProfileError("Veuillez vous connecter pour modifier votre profil.");
      return;
    }
    const supabase = createClient();
    setProfileError(null);
    setProfileSuccess(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        main_weapon: selected.mainWeapon,
        off_weapon: selected.offWeapon,
        role: selected.role,
        archetype: selected.archetype,
        gear_score: selected.gearScore ?? null,
      })
      .eq("user_id", userId);
    if (error) {
      setProfileError(
        error.message || "Impossible d'appliquer ce build au profil.",
      );
      return;
    }
    setWeapon1(selected.mainWeapon);
    setWeapon2(selected.offWeapon);
    setRole(selected.role);
    setArchetype(selected.archetype ?? "");
    setCp(
      typeof selected.gearScore === "number"
        ? String(selected.gearScore)
        : "",
    );
    setProfileSuccess("Classe principale mise à jour.");
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

  const buildManager = (
    <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm uppercase tracking-[0.3em] text-text/50">
            Mes Builds
          </h2>
          <p className="mt-2 text-sm text-text/60">
            Crée plusieurs configurations et choisis la bonne lors des
            inscriptions.
          </p>
        </div>
        {editingBuildId ? (
          <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200">
            Modification
          </span>
        ) : null}
      </div>

      {buildError ? (
        <p className="mt-3 text-sm text-red-300">{buildError}</p>
      ) : null}
      {buildSuccess ? (
        <p className="mt-3 text-sm text-emerald-300">{buildSuccess}</p>
      ) : null}

      <div className="mt-5 grid gap-4">
        <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.25em] text-text/50">
            Nom du build
          </span>
          <div
            aria-live="polite"
            className="font-cinzel text-lg tracking-[0.12em] text-amber-200"
          >
            {getClassNameFromWeapons(buildWeapon1, buildWeapon2) ||
              "Nom de classe"}
          </div>
        </label>

        <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.25em] text-text/50">
            Gear Score
          </span>
          <input
            value={buildGearScore}
            onChange={(event) => setBuildGearScore(event.target.value)}
            type="number"
            placeholder="7000"
            className="bg-transparent text-sm text-text outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <WeaponSelector
            label="Arme 1"
            value={buildWeapon1}
            onChange={setBuildWeapon1}
            highlighted={Boolean(buildWeapon1)}
          />
          <WeaponSelector
            label="Arme 2"
            value={buildWeapon2}
            onChange={setBuildWeapon2}
            highlighted={Boolean(buildWeapon2)}
          />
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Rôle du build
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {roleOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = buildRole === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setBuildRole(option.id);
                    setBuildArchetype("");
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
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Contenu
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["PVE", "PVP"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setBuildContentType(value)}
                className={`rounded-2xl border px-4 py-3 text-xs uppercase tracking-[0.25em] transition ${
                  buildContentType === value
                    ? "border-amber-400/70 bg-amber-400/10 text-amber-100"
                    : "border-white/10 bg-black/40 text-text/70 hover:border-white/20"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-text/50">
            Sous-classe
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(archetypes[buildRole] ?? []).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setBuildArchetype(label)}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                  buildArchetype === label
                    ? "border-primary/60 ring-2 ring-primary/30 text-text"
                    : "border-white/10 bg-black/40 text-text/70 hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
            {!buildRole && (
              <span className="text-xs text-text/40">
                Sélectionnez un rôle pour voir les archetypes.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {editingBuildId ? (
          <button
            type="button"
            onClick={resetBuildForm}
            className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
          >
            Annuler
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSaveBuild}
          disabled={isSavingBuild}
          className="rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingBuild
            ? "Sauvegarde..."
            : editingBuildId
              ? "Mettre à jour"
              : "Sauvegarder le build"}
        </button>
      </div>

    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="rounded-3xl border border-gold/50 bg-surface/70 px-5 py-5 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold/70 sm:tracking-[0.4em] font-cinzel">
              Profil Agent
            </p>
            <h1 className="mt-2 font-display text-2xl tracking-[0.12em] text-text sm:text-3xl sm:tracking-[0.15em]">
              {getClassNameFromWeapons(weapon1, weapon2) || "Identité de Combat"}
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
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-text">
              {roleRank === "admin" ? (
                <Crown className="h-5 w-5 text-amber-300" />
              ) : roleRank === "conseiller" ? (
                <Shield className="h-5 w-5 text-slate-200" />
              ) : null}
              {roleRank === "admin"
                ? "Admin"
                : roleRank === "conseiller"
                  ? "Conseiller"
                  : "Soldat"}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              {participationPoints} points de participation
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              {activityPoints} points d&apos;activité
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-start gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!isProfileValid || isSavingProfile}
                className="rounded-2xl border border-amber-400/60 bg-amber-400/10 px-5 py-2 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProfile ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
            {!isProfileValid ? (
              <p className="mt-2 text-xs text-text/50">
                Renseigne ton pseudo pour sauvegarder.
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <h2 className="text-sm uppercase tracking-[0.3em] text-text/50">
              Points d&apos;activité
            </h2>
            <p className="mt-2 text-sm text-text/70">
              Importez une capture de vos points d&apos;activité pour mise à jour automatique.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
              <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-text/70">
                <span className="text-xs uppercase tracking-[0.25em] text-text/50">
                  Capture d&apos;écran
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setActivityFile(event.target.files?.[0] ?? null)
                  }
                  className="text-xs text-text/70"
                />
              </label>
              <button
                type="button"
                onClick={handleActivityUpload}
                disabled={!activityFile || activityStatus === "loading"}
                className="rounded-2xl border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activityStatus === "loading" ? "Analyse..." : "Analyser"}
              </button>
            </div>
            {activityMessage ? (
              <p
                className={`mt-3 text-xs ${
                  activityStatus === "error" ? "text-red-300" : "text-emerald-200"
                }`}
              >
                {activityMessage}
              </p>
            ) : null}
          </div>
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
            </div>
          </div>

          {isBuildPanelOpen ? (
            <div className="rounded-3xl border border-white/10 bg-surface/70 p-0 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
              <button
                type="button"
                onClick={() => setIsBuildPanelOpen(false)}
                className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left text-sm uppercase tracking-[0.3em] text-text/60"
              >
                <span>Mes Builds</span>
              </button>
              <div className="px-6 pb-6">{buildManager}</div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsBuildPanelOpen(true)}
              className="w-full rounded-3xl border border-white/10 bg-surface/70 px-6 py-5 text-left text-sm uppercase tracking-[0.3em] text-text/60 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur transition hover:text-text"
            >
              Mes Builds
            </button>
          )}

        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 text-center shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.25em] text-text/50">
              Classe principale
            </p>
            <p className="mt-2 text-sm text-text/70">
              {builds.length > 1
                ? "Choisis le build qui sera visible en guilde."
                : "Classe principale automatique tant que tu n'as qu'un seul build."}
            </p>
            {builds.length > 1 ? (
              <button
                type="button"
                onClick={() => setIsMainBuildPickerOpen(true)}
                className="mt-4 w-full rounded-2xl border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-xs uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
              >
                Sélectionner ma classe principale
              </button>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur">
            <div>
              <h3 className="text-xs uppercase tracking-[0.3em] text-text/50">
                Modifier mes builds
              </h3>
              <p className="mt-2 text-sm text-text/60">
                Choisis un build pour le modifier.
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              {builds.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
                  Aucun build disponible pour le moment.
                </div>
              ) : (
                builds.map((build) => (
                  <div
                    key={build.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
                  >
                    <span className="font-cinzel text-base tracking-[0.12em] text-amber-200">
                      {getClassNameFromWeapons(
                        build.mainWeapon,
                        build.offWeapon,
                      ) || build.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEditBuild(build)}
                      className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-300"
                    >
                      Modifier
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {isMainBuildPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text/50">
                  Classe principale
                </p>
                <h2 className="mt-2 text-xl font-semibold text-text">
                  Sélectionner un build principal
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMainBuildPickerOpen(false)}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.25em] text-text/70 transition hover:text-text"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              {builds.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-text/60">
                  Aucun build disponible. Crée un build d&apos;abord.
                </div>
              ) : (
                builds.map((build) => (
                  <button
                    key={build.id}
                    type="button"
                    onClick={() => {
                      handleApplyMainBuild(build.id);
                      setIsMainBuildPickerOpen(false);
                    }}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-left text-sm text-text/80 transition hover:border-amber-400/60"
                  >
                    <span className="font-cinzel text-lg tracking-[0.12em] text-amber-200">
                      {getClassNameFromWeapons(
                        build.mainWeapon,
                        build.offWeapon,
                      ) || build.name}
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-text/50">
                      {build.contentType ?? "Build"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
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
      {toastMessage ? (
        <div className="fixed left-1/2 top-6 z-[60] w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.4)] sm:max-w-md">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}

