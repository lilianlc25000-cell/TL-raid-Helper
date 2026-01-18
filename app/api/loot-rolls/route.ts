import { NextResponse } from "next/server";

type LootRollPayload = {
  user_id: string;
  item_name: string;
  roll_value: number;
};

const rollStore: Array<LootRollPayload & { id: string; created_at: string }> = [];

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as LootRollPayload | null;
  if (!payload?.user_id || !payload?.item_name || typeof payload.roll_value !== "number") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  rollStore.push({
    ...payload,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
