import { supabaseAdmin } from "./supabase-admin";
import { ticketFor } from "./game";

type Db = ReturnType<typeof supabaseAdmin>;

// Add `count` tickets for a player at the end of the game's ticket list.
export async function appendTickets(
  db: Db,
  gameId: string,
  playerId: string,
  count: number
) {
  const { data } = await db
    .from("tickets")
    .select("ticket_no")
    .eq("game_id", gameId)
    .order("ticket_no", { ascending: false })
    .limit(1);

  let next = (data?.[0]?.ticket_no ?? 0) + 1;
  const rows: {
    game_id: string;
    player_id: string;
    ticket_no: number;
    set_no: number;
    rows: number[][];
  }[] = [];

  for (let i = 0; i < count; i++) {
    const t = ticketFor(gameId, next);
    rows.push({
      game_id: gameId,
      player_id: playerId,
      ticket_no: next,
      set_no: t.setNo,
      rows: t.rows,
    });
    next++;
  }

  const { error } = await db.from("tickets").insert(rows);
  return error;
}

// Lobby only: rebuild every ticket so numbering stays 1,2,3... with no gaps.
// This keeps "first 6 tickets cover 1 to 90 exactly once" true.
export async function rebuildTickets(db: Db, gameId: string) {
  const { data: players } = await db
    .from("players")
    .select("id,ticket_count")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  await db.from("tickets").delete().eq("game_id", gameId);

  let next = 1;
  const rows: {
    game_id: string;
    player_id: string;
    ticket_no: number;
    set_no: number;
    rows: number[][];
  }[] = [];

  for (const p of players ?? []) {
    for (let i = 0; i < p.ticket_count; i++) {
      const t = ticketFor(gameId, next);
      rows.push({
        game_id: gameId,
        player_id: p.id,
        ticket_no: next,
        set_no: t.setNo,
        rows: t.rows,
      });
      next++;
    }
  }

  if (rows.length === 0) return null;
  const { error } = await db.from("tickets").insert(rows);
  return error;
}
