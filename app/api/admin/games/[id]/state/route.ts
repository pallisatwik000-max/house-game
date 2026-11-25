import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { derivePin } from "@/lib/pin";

export const dynamic = "force-dynamic";

// Everything the Admin screen needs, in one call.
// Works after a page refresh, so the game is never lost.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const db = supabaseAdmin();
  const { data: game } = await db
    .from("games")
    .select("id,name,slug,status,called_numbers,started_at,ended_at")
    .eq("id", params.id)
    .eq("admin_id", auth.profile.id)
    .single();
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const { data: players } = await db
    .from("players")
    .select("id,name,ticket_count,is_admin_player,created_at")
    .eq("game_id", game.id)
    .order("created_at", { ascending: true });

  const { data: tickets } = await db
    .from("tickets")
    .select("id,player_id,ticket_no")
    .eq("game_id", game.id)
    .order("ticket_no", { ascending: true });

  const { data: claimRows } = await db
    .from("claims")
    .select("id,category,status,numbers_called_at_claim,created_at,player_id,ticket_id")
    .eq("game_id", game.id)
    .order("created_at", { ascending: false });

  const playerName = new Map((players ?? []).map((p) => [p.id, p.name]));
  const ticketNo = new Map((tickets ?? []).map((t) => [t.id, t.ticket_no]));

  const claims = (claimRows ?? []).map((c) => ({
    id: c.id,
    category: c.category,
    status: c.status,
    player_name: playerName.get(c.player_id) ?? "Unknown",
    ticket_no: ticketNo.get(c.ticket_id) ?? 0,
    created_at: c.created_at,
  }));

  const list = (players ?? []).map((p) => ({
    ...p,
    ticket_nos: (tickets ?? [])
      .filter((t) => t.player_id === p.id)
      .map((t) => t.ticket_no),
  }));

  const called = (game.called_numbers ?? []) as number[];
  const origin = new URL(req.url).origin;

  return NextResponse.json({
    game: {
      id: game.id,
      name: game.name,
      slug: game.slug,
      status: game.status,
      started_at: game.started_at,
      ended_at: game.ended_at,
      pin: derivePin(game.slug),
      link: `${origin}/join/${game.slug}`,
    },
    called,
    latest: called.length ? called[called.length - 1] : null,
    players: list,
    claims,
    winners: claims.filter((c) => c.status === "valid"),
  });
}
