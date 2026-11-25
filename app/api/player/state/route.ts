import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Everything the Player screen needs. Works after refresh.
export async function GET(req: Request) {
  const auth = await requirePlayer(req);
  if (auth.error) return auth.error;
  const { player, game } = auth;

  const db = supabaseAdmin();

  // Only this player's own tickets
  const { data: tickets } = await db
    .from("tickets")
    .select("id,ticket_no,rows")
    .eq("player_id", player.id)
    .order("ticket_no", { ascending: true });

  const ticketIds = (tickets ?? []).map((t) => t.id);

  const { data: marks } = ticketIds.length
    ? await db.from("marks").select("ticket_id,number").in("ticket_id", ticketIds)
    : { data: [] as { ticket_id: string; number: number }[] };

  // This player's claim attempts (used to disable buttons)
  const { data: myClaims } = await db
    .from("claims")
    .select("ticket_id,category,status")
    .eq("player_id", player.id);

  // Public winners list
  const { data: validClaims } = await db
    .from("claims")
    .select("category,player_id,ticket_id,created_at")
    .eq("game_id", game.id)
    .eq("status", "valid");

  const { data: gamePlayers } = await db
    .from("players")
    .select("id,name")
    .eq("game_id", game.id);
  const { data: gameTickets } = await db
    .from("tickets")
    .select("id,ticket_no")
    .eq("game_id", game.id);

  const nameOf = new Map((gamePlayers ?? []).map((p) => [p.id, p.name]));
  const noOf = new Map((gameTickets ?? []).map((t) => [t.id, t.ticket_no]));

  const winners = (validClaims ?? []).map((c) => ({
    category: c.category,
    player_name: nameOf.get(c.player_id) ?? "Unknown",
    ticket_no: noOf.get(c.ticket_id) ?? 0,
    created_at: c.created_at,
  }));

  const called = (game.called_numbers ?? []) as number[];

  return NextResponse.json({
    player: {
      name: player.name,
      ticket_count: player.ticket_count,
      is_admin_player: player.is_admin_player,
    },
    game: { id: game.id, name: game.name, status: game.status },
    called,
    latest: called.length ? called[called.length - 1] : null,
    tickets: (tickets ?? []).map((t) => ({
      id: t.id,
      ticket_no: t.ticket_no,
      rows: t.rows,
      marked: (marks ?? [])
        .filter((m) => m.ticket_id === t.id)
        .map((m) => m.number),
      claims: (myClaims ?? [])
        .filter((c) => c.ticket_id === t.id)
        .map((c) => ({ category: c.category, status: c.status })),
    })),
    winners,
  });
}
