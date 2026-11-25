import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rebuildTickets } from "@/lib/tickets";

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

// Edit a player's name (any time) or ticket count (before the game starts)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; playerId: string } }
) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const db = supabaseAdmin();
  const game = await ownGame(db, params.id, auth.profile.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const { data: player } = await db
    .from("players")
    .select("id,name,ticket_count")
    .eq("id", params.playerId)
    .eq("game_id", game.id)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const update: { name?: string; ticket_count?: number } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 1 || name.length > 40) {
      return NextResponse.json(
        { error: "Player name must be 1 to 40 characters" },
        { status: 400 }
      );
    }
    const { data: others } = await db
      .from("players")
      .select("id,name")
      .eq("game_id", game.id);
    if (
      (others ?? []).some(
        (p) => p.id !== player.id && p.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      return NextResponse.json(
        { error: "A player with this name already exists" },
        { status: 409 }
      );
    }
    update.name = name;
  }

  let ticketsChanged = false;
  if (body.ticket_count !== undefined) {
    const count = Number(body.ticket_count);
    if (!Number.isInteger(count) || count < 1 || count > 6) {
      return NextResponse.json(
        { error: "Tickets must be between 1 and 6" },
        { status: 400 }
      );
    }
    if (count !== player.ticket_count) {
      if (game.status !== "lobby") {
        return NextResponse.json(
          { error: "Tickets can only be changed before the game starts" },
          { status: 400 }
        );
      }
      update.ticket_count = count;
      ticketsChanged = true;
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await db.from("players").update(update).eq("id", player.id);
    if (error) {
      return NextResponse.json({ error: "Could not update player" }, { status: 500 });
    }
  }

  if (ticketsChanged) {
    const tErr = await rebuildTickets(db, game.id);
    if (tErr) {
      return NextResponse.json({ error: "Could not rebuild tickets" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

// Remove a player (only before the game starts)
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; playerId: string } }
) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const db = supabaseAdmin();
  const game = await ownGame(db, params.id, auth.profile.id);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  if (game.status !== "lobby") {
    return NextResponse.json(
      { error: "Players can only be removed before the game starts" },
      { status: 400 }
    );
  }

  const { error } = await db
    .from("players")
    .delete()
    .eq("id", params.playerId)
    .eq("game_id", game.id);
  if (error) {
    return NextResponse.json({ error: "Could not remove player" }, { status: 500 });
  }

  const tErr = await rebuildTickets(db, game.id);
  if (tErr) {
    return NextResponse.json({ error: "Could not rebuild tickets" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
    }
