import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { pickNextNumber } from "@/lib/game";

export const dynamic = "force-dynamic";

// NEXT NUMBER: secure random pick from the numbers not yet called
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const db = supabaseAdmin();
  const { data: game } = await db
    .from("games")
    .select("id,status,called_numbers")
    .eq("id", params.id)
    .eq("admin_id", auth.profile.id)
    .single();
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  if (game.status === "lobby") {
    return NextResponse.json({ error: "Start the game first" }, { status: 400 });
  }
  if (game.status === "paused") {
    return NextResponse.json({ error: "Game is paused. Resume first" }, { status: 400 });
  }
  if (game.status === "ended") {
    return NextResponse.json({ error: "Game has ended" }, { status: 400 });
  }

  const called = (game.called_numbers ?? []) as number[];
  const n = pickNextNumber(called);
  if (n === null) {
    return NextResponse.json(
      { error: "All 90 numbers have been called", done: true },
      { status: 400 }
    );
  }

  const next = [...called, n];

  // Only save if nobody else changed the list in the meantime
  // (stops a double tap from calling two numbers at once)
  const { data: saved, error } = await db
    .from("games")
    .update({ called_numbers: next })
    .eq("id", game.id)
    .eq("status", "running")
    .eq("called_numbers", `{${called.join(",")}}`)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not save number" }, { status: 500 });
  }
  if (!saved || saved.length === 0) {
    return NextResponse.json(
      { error: "Please tap again" },
      { status: 409 }
    );
  }

  return NextResponse.json({ number: n, count: next.length });
}
