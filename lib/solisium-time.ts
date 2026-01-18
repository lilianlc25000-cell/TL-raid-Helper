"use client";

import { useEffect, useState } from "react";

const SOLISIUM_DAY_START = { hour: 7, minute: 30 };
const SOLISIUM_NIGHT_START = { hour: 19, minute: 30 };
const PARIS_TIME_ZONE = "Europe/Paris";

const getParisNow = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: PARIS_TIME_ZONE }),
  );

export type SolisiumTimeState = {
  isNight: boolean;
  timeRemainingMs: number;
  nextState: "Jour" | "Nuit";
  timeRemaining: string;
};

const formatRemaining = (timeRemainingMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds
      .toString()
      .padStart(2, "0")}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};

export const getSolisiumTimeState = (
  now = getParisNow(),
): SolisiumTimeState => {
  const dayStart = new Date(now);
  dayStart.setHours(
    SOLISIUM_DAY_START.hour,
    SOLISIUM_DAY_START.minute,
    0,
    0,
  );
  const nightStart = new Date(now);
  nightStart.setHours(
    SOLISIUM_NIGHT_START.hour,
    SOLISIUM_NIGHT_START.minute,
    0,
    0,
  );

  let isNight = false;
  let timeRemainingMs = 0;
  let nextState: SolisiumTimeState["nextState"] = "Nuit";

  if (now < dayStart) {
    isNight = true;
    timeRemainingMs = dayStart.getTime() - now.getTime();
    nextState = "Jour";
  } else if (now < nightStart) {
    isNight = false;
    timeRemainingMs = nightStart.getTime() - now.getTime();
    nextState = "Nuit";
  } else {
    isNight = true;
    const nextDayStart = new Date(dayStart);
    nextDayStart.setDate(nextDayStart.getDate() + 1);
    timeRemainingMs = nextDayStart.getTime() - now.getTime();
    nextState = "Jour";
  }

  return {
    isNight,
    timeRemainingMs,
    nextState,
    timeRemaining: formatRemaining(timeRemainingMs),
  };
};

export const formatSolisiumRemaining = formatRemaining;

export const useSolisiumTime = () => {
  const [state, setState] = useState<SolisiumTimeState>(() =>
    getSolisiumTimeState(getParisNow()),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState(getSolisiumTimeState(getParisNow()));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return state;
};

