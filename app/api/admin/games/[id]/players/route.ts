import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { appendTickets } from "@/lib/tickets";

export const dynamic = "force-dynamic";

type Db = ReturnType<typeof supabaseAdmin>;

async function ownGame(db: Db, gameId: string, adminId: string) {
  const { data } = await db
    .from("games")
    .select("id,status")
    .eq("id", gameId)
    .eq("admin_id", adminId)
    .single();
  return data as { id: string; status: string } | null;
}

// List players of a game (with their ticket numbers)
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const db = supabaseAdmin();
  const game = await ownGame(db, params.id, auth.profile.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const { data: players } = await db
    .from("players")
    .select("id,name,ticket_count,is_admin_player,created_at")
    .eq("game_id", game.id)
    .order("created_at", { ascending: true });

  const { data: tickets } = await db
    .from("tickets")
    .select("player_id,ticket_no")
    .eq("game_id", game.id)
    .order("ticket_no", { ascending: true });

  const list = (players ?? []).map((p) => ({
    ...p,
    ticket_nos: (tickets ?? [])
      .filter((t) => t.player_id === p.id)
      .map((t) => t.ticket_no),
  }));

  return NextResponse.json({ players: list });
}

// Add a player and give them 1 to 6 tickets
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const count = Number(body.ticket_count);
  const isAdminPlayer = body.is_admin_player === true;

  if (name.length < 1 || name.length > 40) {
    return NextResponse.json(
      { error: "Player name must be 1 to 40 characters" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(count) || count < 1 || count > 6) {
    return NextResponse.json(
      { error: "Tickets must be between 1 and 6" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const game = await ownGame(db, params.id, auth.profile.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status === "ended") {
    return NextResponse.json({ error: "Game has ended" }, { status: 400 });
  }

  // Names must be unique in a game, because players join by name + PIN
  const { data: existing } = await db
    .from("players")
    .select("name")
    .eq("game_id", game.id);
  if ((existing ?? []).some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { error: "A player with this name already exists" },
      { status: 409 }
    );
  }

  const { data: player, error } = await db
    .from("players")
    .insert({
      game_id: game.id,
      name,
      ticket_count: count,
      is_admin_player: isAdminPlayer,
    })
    .select("id,name,ticket_count,is_admin_player")
    .single();

  if (error || !player) {
    return NextResponse.json({ error: "Could not add player" }, { status: 500 });
  }

  const tErr = await appendTickets(db, game.id, player.id, count);
  if (tErr) {
    await db.from("players").delete().eq("id", player.id);
    return NextResponse.json({ error: "Could not create tickets" }, { status: 500 });
  }

  return NextResponse.json({ player });
}
