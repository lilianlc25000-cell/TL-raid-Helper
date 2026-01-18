import { NextResponse } from "next/server";

type GearWishlistPayload = {
  user_id: string;
  slot_name: string;
  item_name: string;
  item_priority: number;
};

const gearWishlistStore: Array<
  GearWishlistPayload & { id: string; updated_at: string }
> = [];

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | GearWishlistPayload
    | null;
  if (
    !payload?.user_id ||
    !payload?.slot_name ||
    !payload?.item_name ||
    typeof payload.item_priority !== "number"
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  gearWishlistStore.push({
    ...payload,
    id: crypto.randomUUID(),
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
