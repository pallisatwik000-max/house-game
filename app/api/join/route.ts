import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

// Join page uses this to show the game name from the link
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!slug) return NextResponse.json({ error: "Missing game link" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: game } = await db
    .from("games")
    .select("name,status")
    .eq("slug", slug)
    .single();
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  return NextResponse.json({ name: game.name, status: game.status });
}

// Join with name + PIN. Only players added by the Admin can join.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug ?? "");
  const name = String(body.name ?? "").trim();
  const pin = String(body.pin ?? "").trim();

  if (!slug || !name || !pin) {
    return NextResponse.json(
      { error: "Enter your name and the game PIN" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const { data: game } = await db
    .from("games")
    .select("id,name,slug,pin_hash,status")
    .eq("slug", slug)
    .single();
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  if (!verifyPin(pin, game.slug, game.pin_hash)) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  if (game.status === "ended") {
    return NextResponse.json({ error: "This game has ended" }, { status: 400 });
  }

  const { data: players } = await db
    .from("players")
    .select("id,name,ticket_count,session_token")
    .eq("game_id", game.id);

  const player = (players ?? []).find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (!player) {
    return NextResponse.json(
      { error: "You are not on the player list. Ask the Admin to add you" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    token: player.session_token,
    player: { name: player.name, ticket_count: player.ticket_count },
    game: { name: game.name },
  });
}
