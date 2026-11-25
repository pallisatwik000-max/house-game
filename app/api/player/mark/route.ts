import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Player taps a number on their ticket.
// The server checks the number is really on the ticket AND was really called.
export async function POST(req: Request) {
  const auth = await requirePlayer(req);
  if (auth.error) return auth.error;
  const { player, game } = auth;

  const body = await req.json().catch(() => ({}));
  const ticketId = String(body.ticket_id ?? "");
  const number = Number(body.number);
  const marked = body.marked !== false; // default: mark. Send false to unmark.

  if (!ticketId || !Number.isInteger(number) || number < 1 || number > 90) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (game.status === "ended") {
    return NextResponse.json({ error: "Game has ended" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Re-read the latest called numbers (never trust the cached copy)
  const { data: fresh } = await db
    .from("games")
    .select("called_numbers,status")
    .eq("id", game.id)
    .single();
  if (!fresh || fresh.status === "ended") {
    return NextResponse.json({ error: "Game has ended" }, { status: 400 });
  }

  const { data: ticket } = await db
    .from("tickets")
    .select("id,rows")
    .eq("id", ticketId)
    .eq("player_id", player.id)
    .single();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const onTicket = (ticket.rows as number[][]).flat().includes(number);
  if (!onTicket) {
    return NextResponse.json(
      { error: "That number is not on this ticket" },
      { status: 400 }
    );
  }

  if (marked) {
    const wasCalled = ((fresh.called_numbers ?? []) as number[]).includes(number);
    if (!wasCalled) {
      return NextResponse.json(
        { error: "This number has not been called yet" },
        { status: 400 }
      );
    }
    const { error } = await db
      .from("marks")
      .upsert({ ticket_id: ticket.id, number }, { onConflict: "ticket_id,number" });
    if (error) {
      return NextResponse.json({ error: "Could not save mark" }, { status: 500 });
    }
  } else {
    await db.from("marks").delete().eq("ticket_id", ticket.id).eq("number", number);
  }

  return NextResponse.json({ ok: true });
  }
