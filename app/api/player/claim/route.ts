import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CATEGORIES, Category, checkClaim } from "@/lib/game";

export const dynamic = "force-dynamic";

// Player presses FIRST 5 / FIRST LINE / SECOND LINE / LAST LINE / HOUSE FULL.
// The server decides. The client's opinion is never trusted.
export async function POST(req: Request) {
  const auth = await requirePlayer(req);
  if (auth.error) return auth.error;
  const { player, game } = auth;

  const body = await req.json().catch(() => ({}));
  const ticketId = String(body.ticket_id ?? "");
  const category = String(body.category ?? "") as Category;

  if (!ticketId || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: fresh } = await db
    .from("games")
    .select("status,called_numbers")
    .eq("id", game.id)
    .single();
  if (!fresh) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (fresh.status === "lobby") {
    return NextResponse.json({ error: "Game has not started" }, { status: 400 });
  }
  if (fresh.status === "ended") {
    return NextResponse.json({ error: "Game has ended" }, { status: 400 });
  }

  const { data: ticket } = await db
    .from("tickets")
    .select("id,ticket_no,rows")
    .eq("id", ticketId)
    .eq("player_id", player.id)
    .single();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  // This option was already tried (right or wrong) on this ticket
  const { data: tried } = await db
    .from("claims")
    .select("id")
    .eq("ticket_id", ticket.id)
    .eq("category", category)
    .limit(1);
  if (tried && tried.length > 0) {
    return NextResponse.json(
      { error: "You already used this option on this ticket" },
      { status: 409 }
    );
  }

  // Someone else already won this category
  const { data: won } = await db
    .from("claims")
    .select("id")
    .eq("game_id", game.id)
    .eq("category", category)
    .eq("status", "valid")
    .limit(1);
  if (won && won.length > 0) {
    return NextResponse.json(
      { error: "This prize has already been won", already_won: true },
      { status: 409 }
    );
  }

  const called = (fresh.called_numbers ?? []) as number[];

  const { data: markRows } = await db
    .from("marks")
    .select("number")
    .eq("ticket_id", ticket.id);
  const marked = (markRows ?? []).map((m) => m.number as number);

  const result = checkClaim(category, ticket.rows as number[][], marked, called);

  const { error } = await db.from("claims").insert({
    game_id: game.id,
    ticket_id: ticket.id,
    player_id: player.id,
    category,
    status: result.valid ? "valid" : "invalid",
    numbers_called_at_claim: called.length,
  });

  if (error) {
    // 23505 = unique violation: another claim got in first
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This prize has already been won", already_won: true },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not save claim" }, { status: 500 });
  }

  if (result.valid) {
    return NextResponse.json({
      valid: true,
      message: "SYSTEM CHECK CLEAR",
      category,
      ticket_no: ticket.ticket_no,
    });
  }

  return NextResponse.json({
    valid: false,
    message: "CLAIM NOT VALID",
    category,
    ticket_no: ticket.ticket_no,
  });
}
