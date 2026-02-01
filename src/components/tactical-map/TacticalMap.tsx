"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import L, { CRS } from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@/lib/supabase/client";
import {
  Flag,
  Skull,
  Shield,
  Sword,
  MousePointer2,
  Eraser,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

type TacticalMarker = {
  id: string;
  x: number;
  y: number;
  type: string;
  label: string | null;
  created_at: string;
};

const IMAGE_SIZE = 1000;

const imageBounds: [LatLngTuple, LatLngTuple] = [
  [0, 0],
  [IMAGE_SIZE, IMAGE_SIZE],
];

const TOOL_TYPES = ["sword", "shield", "skull", "flag", "pointer", "eraser"] as const;
type ToolType = (typeof TOOL_TYPES)[number];

const AddMarkerOnClick = ({
  onCreate,
  disabled,
  tool,
}: {
  onCreate: (position: LatLngTuple) => void;
  disabled: boolean;
  tool: ToolType;
}) => {
  useMapEvents({
    click(event) {
      if (disabled || tool === "eraser") {
        return;
      }
      onCreate([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
};

type TacticalMapProps = {
  isReadOnly: boolean;
};

export default function TacticalMap({ isReadOnly }: TacticalMapProps) {
  const [markers, setMarkers] = useState<TacticalMarker[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolType>("sword");
  const [selectedNumber, setSelectedNumber] = useState<string | null>("1");
  const supabase = useMemo(() => createClient(), []);
  const iconCache = useMemo(() => {
    const svg = {
      sword: renderToStaticMarkup(<Sword size={16} strokeWidth={2.5} />),
      shield: renderToStaticMarkup(<Shield size={16} strokeWidth={2.5} />),
      skull: renderToStaticMarkup(<Skull size={16} strokeWidth={2.5} />),
      flag: renderToStaticMarkup(<Flag size={16} strokeWidth={2.5} />),
      pointer: renderToStaticMarkup(<MousePointer2 size={16} strokeWidth={2.5} />),
    };

    const build = (type: ToolType, label: string | null) =>
      L.divIcon({
        className: "bg-transparent",
        html: `<div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-white text-white shadow-lg ${getToolClass(type)}">${svg[type]}${
          label
            ? `<span class="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black shadow-md">${label}</span>`
            : ""
        }</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

    const cache = new Map<string, L.DivIcon>();
    return {
      get(type: ToolType, label: string | null) {
        const key = `${type}:${label ?? ""}`;
        const existing = cache.get(key);
        if (existing) {
          return existing;
        }
        const icon = build(type, label);
        cache.set(key, icon);
        return icon;
      },
    };
  }, []);

  const getMarkerIcon = (type: string, label: string | null) => {
    if (type === "shield") return iconCache.get("shield", label);
    if (type === "skull") return iconCache.get("skull", label);
    if (type === "flag") return iconCache.get("flag", label);
    if (type === "pointer") return iconCache.get("pointer", label);
    return iconCache.get("sword", label);
  };

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let isMounted = true;
    const loadMarkers = async () => {
      const { data, error } = await supabase
        .from("tactical_markers")
        .select("id,x,y,type,label,created_at")
        .order("created_at", { ascending: true });
      if (!isMounted) {
        return;
      }
      if (error) {
        return;
      }
      setMarkers(data ?? []);
    };

    loadMarkers();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    const channel = supabase
      .channel("rt:tactical_markers")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tactical_markers" },
        (payload) => {
          const incoming = payload.new as TacticalMarker;
          setMarkers((prev) => {
            if (prev.some((marker) => marker.id === incoming.id)) {
              return prev;
            }
            return [...prev, incoming];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tactical_markers" },
        (payload) => {
          const removed = payload.old as TacticalMarker;
          setMarkers((prev) =>
            prev.filter((marker) => marker.id !== removed.id),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleCreateMarker = async (position: LatLngTuple) => {
    if (!supabase) {
      return;
    }
    if (isReadOnly || selectedTool === "eraser") {
      return;
    }
    const [y, x] = position;
    const { error } = await supabase.from("tactical_markers").insert({
      x,
      y,
      type: selectedTool,
      label: selectedNumber,
    });
    if (error) {
      return;
    }
  };

  const handleUpdateMarker = useCallback(
    async (markerId: string, position: LatLngTuple) => {
      if (!supabase || isReadOnly) {
        return;
      }
      const [y, x] = position;
      const { error } = await supabase
        .from("tactical_markers")
        .update({ x, y })
        .eq("id", markerId);
      if (error) {
        return;
      }
    },
    [supabase, isReadOnly],
  );

  const handleDeleteMarker = async (markerId: string) => {
    if (!supabase || isReadOnly) {
      return;
    }
    const { error } = await supabase
      .from("tactical_markers")
      .delete()
      .eq("id", markerId);
    if (error) {
      return;
    }
  };

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-3xl border border-white/10">
      <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/70 p-3 shadow-lg">
        <div className="flex flex-col gap-2">
          {TOOL_TYPES.map((tool) => {
            const isActive = selectedTool === tool;
            const disabled = isReadOnly;
            const buttonClass = [
              "flex h-10 w-10 items-center justify-center rounded-xl text-white transition",
              isActive ? "bg-white/20" : "bg-white/5 hover:bg-white/10",
              disabled ? "cursor-not-allowed opacity-50" : "",
            ].join(" ");
            return (
              <button
                key={tool}
                type="button"
                onClick={() => {
                  if (disabled) {
                    return;
                  }
                  setSelectedTool(tool);
                }}
                className={buttonClass}
                aria-pressed={isActive}
                aria-label={`outil ${tool}`}
              >
                {renderToolIcon(tool)}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6"].map((number) => {
            const isActive = selectedNumber === number;
            const disabled = isReadOnly;
            const buttonClass = [
              "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition",
              isActive ? "bg-white text-black" : "bg-white/10 text-white",
              disabled ? "cursor-not-allowed opacity-50" : "hover:bg-white/20",
            ].join(" ");
            return (
              <button
                key={number}
                type="button"
                onClick={() => {
                  if (disabled) {
                    return;
                  }
                  setSelectedNumber(number);
                }}
                className={buttonClass}
                aria-pressed={isActive}
                aria-label={`groupe ${number}`}
              >
                {number}
              </button>
            );
          })}
        </div>
      </div>
      <MapContainer
        crs={CRS.Simple}
        bounds={imageBounds}
        minZoom={0}
        maxZoom={5}
        className="h-full w-full"
      >
        <TileLayer url="/maps/tl/{z}/{x}/{y}.png" noWrap tms={false} />
        {!isReadOnly ? (
          <AddMarkerOnClick
            onCreate={handleCreateMarker}
            disabled={isReadOnly}
            tool={selectedTool}
          />
        ) : null}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.y, marker.x]}
            icon={getMarkerIcon(marker.type, marker.label)}
            draggable={!isReadOnly}
            eventHandlers={{
              click: () => {
                if (selectedTool === "eraser" && !isReadOnly) {
                  void handleDeleteMarker(marker.id);
                }
              },
              dragend: (event) => {
                const nextPosition = event.target.getLatLng();
                void handleUpdateMarker(marker.id, [
                  nextPosition.lat,
                  nextPosition.lng,
                ]);
              },
            }}
          >
            <Popup>
              <div className="space-y-2 text-sm text-zinc-200">
                <div className="font-semibold text-white">
                  {marker.type}{" "}
                  {marker.label ? `- Groupe ${marker.label}` : ""}
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteMarker(marker.id)}
                  className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-200 transition hover:border-red-400"
                  disabled={isReadOnly}
                >
                  Supprimer
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function getToolClass(type: ToolType) {
  if (type === "shield") return "bg-blue-600";
  if (type === "skull") return "bg-rose-600";
  if (type === "flag") return "bg-amber-500";
  if (type === "pointer") return "bg-emerald-500";
  return "bg-red-600";
}

function renderToolIcon(tool: ToolType) {
  const props = { size: 18, strokeWidth: 2.5 };
  if (tool === "shield") return <Shield {...props} />;
  if (tool === "skull") return <Skull {...props} />;
  if (tool === "flag") return <Flag {...props} />;
  if (tool === "pointer") return <MousePointer2 {...props} />;
  if (tool === "eraser") return <Eraser {...props} />;
  return <Sword {...props} />;
}
