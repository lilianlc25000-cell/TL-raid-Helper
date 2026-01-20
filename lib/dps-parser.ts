type DPSRankEntry = {
  rank: number;
  playerName: string;
  dps: number;
  totalDamage: number;
  duration: number;
};

type PlayerDamageStats = {
  totalDamage: number;
  firstTimestamp: number;
  lastTimestamp: number;
};

const parseLogTimestamp = (value: string): number | null => {
  const match = value.trim().match(
    /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2}):(\d{1,3})$/,
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second, millis] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millis),
  );
};

export const parseDPSLog = (csvContent: string): DPSRankEntry[] => {
  const statsByPlayer = new Map<string, PlayerDamageStats>();
  const lines = csvContent.split(/\r?\n/).map((line) => line.trim());
  for (const line of lines) {
    if (!line || line.startsWith("CombatLogVersion")) {
      continue;
    }
    const parts = line.split(",");
    if (parts.length < 9) {
      continue;
    }
    const eventType = parts[1]?.trim();
    if (eventType !== "DamageDone") {
      continue;
    }
    const playerName = parts[8]?.trim();
    if (!playerName) {
      continue;
    }
    const damageValue = Number.parseInt(parts[4]?.trim() ?? "", 10);
    if (Number.isNaN(damageValue)) {
      continue;
    }
    const timestampValue = parseLogTimestamp(parts[0] ?? "");
    if (timestampValue === null) {
      continue;
    }
    const current = statsByPlayer.get(playerName) ?? {
      totalDamage: 0,
      firstTimestamp: timestampValue,
      lastTimestamp: timestampValue,
    };
    current.totalDamage += damageValue;
    current.firstTimestamp = Math.min(current.firstTimestamp, timestampValue);
    current.lastTimestamp = Math.max(current.lastTimestamp, timestampValue);
    statsByPlayer.set(playerName, current);
  }

  const results: DPSRankEntry[] = Array.from(statsByPlayer.entries()).map(
    ([playerName, stats]) => {
      const durationMs = Math.max(0, stats.lastTimestamp - stats.firstTimestamp);
      const durationSeconds = durationMs / 1000;
      const safeDuration = durationSeconds > 0 ? durationSeconds : 1;
      const dps = Math.round(stats.totalDamage / safeDuration);
      return {
        rank: 0,
        playerName,
        dps,
        totalDamage: stats.totalDamage,
        duration: Math.round(durationSeconds),
      };
    },
  );

  results.sort((a, b) => b.dps - a.dps);
  return results.map((entry, index) => ({ ...entry, rank: index + 1 }));
};
