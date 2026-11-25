import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Start / pause / resume / end a game
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  const db = supabaseAdmin();
  const { data: game } = await db
    .from("games")
    .select("id,status")
    .eq("id", params.id)
    .eq("admin_id", auth.profile.id)
    .single();
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const now = new Date().toISOString();
  let update: Record<string, unknown> | null = null;

  if (action === "start") {
    if (game.status !== "lobby") {
      return NextResponse.json({ error: "Game already started" }, { status: 400 });
    }
    const { count } = await db
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id);
    if (!count) {
      return NextResponse.json(
        { error: "Add at least one player before starting" },
        { status: 400 }
      );
    }
    update = { status: "running", started_at: now };
  } else if (action === "pause") {
    if (game.status !== "running") {
      return NextResponse.json({ error: "Game is not running" }, { status: 400 });
    }
    update = { status: "paused" };
  } else if (action === "resume") {
    if (game.status !== "paused") {
      return NextResponse.json({ error: "Game is not paused" }, { status: 400 });
    }
    update = { status: "running" };
  } else if (action === "end") {
    if (game.status === "ended") {
      return NextResponse.json({ error: "Game already ended" }, { status: 400 });
    }
    update = { status: "ended", ended_at: now };
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { error } = await db.from("games").update(update).eq("id", game.id);
  if (error) {
    return NextResponse.json({ error: "Could not update game" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: update.status });
}
