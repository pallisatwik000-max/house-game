import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Owner: all games on the site, live and history.
// The Owner dashboard calls this every few seconds to monitor live games.
export async function GET() {
  const auth = await requireUser(["owner"]);
  if (auth.error) return auth.error;

  const db = supabaseAdmin();

  const { data: games } = await db
    .from("games")
    .select("id,name,status,called_numbers,started_at,ended_at,created_at,admin_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const gameIds = (games ?? []).map((g) => g.id);
  if (gameIds.length === 0) {
    return NextResponse.json({ games: [] });
  }

  const { data: admins } = await db
    .from("profiles")
    .select("id,email,full_name")
    .eq("role", "admin");

  const { data: players } = await db
    .from("players")
    .select("id,name,game_id")
    .in("game_id", gameIds);

  const { data: claims } = await db
    .from("claims")
    .select("game_id,category,player_id,ticket_id,created_at")
    .in("game_id", gameIds)
    .eq("status", "valid");

  const ticketIds = (claims ?? []).map((c) => c.ticket_id);
  const { data: tickets } = ticketIds.length
    ? await db.from("tickets").select("id,ticket_no").in("id", ticketIds)
    : { data: [] as { id: string; ticket_no: number }[] };

  const adminOf = new Map((admins ?? []).map((a) => [a.id, a]));
  const nameOf = new Map((players ?? []).map((p) => [p.id, p.name]));
  const noOf = new Map((tickets ?? []).map((t) => [t.id, t.ticket_no]));

  const list = (games ?? []).map((g) => {
    const called = (g.called_numbers ?? []) as number[];
    const admin = adminOf.get(g.admin_id);
    return {
      id: g.id,
      name: g.name,
      status: g.status,
      admin_email: admin?.email ?? "Unknown",
      admin_name: admin?.full_name ?? null,
      player_count: (players ?? []).filter((p) => p.game_id === g.id).length,
      called_count: called.length,
      latest: called.length ? called[called.length - 1] : null,
      started_at: g.started_at,
      ended_at: g.ended_at,
      created_at: g.created_at,
      winners: (claims ?? [])
        .filter((c) => c.game_id === g.id)
        .map((c) => ({
          category: c.category,
          player_name: nameOf.get(c.player_id) ?? "Unknown",
          ticket_no: noOf.get(c.ticket_id) ?? 0,
          created_at: c.created_at,
        })),
    };
  });

  return NextResponse.json({
    games: list,
    live: list.filter((g) => g.status === "running" || g.status === "paused"),
    history: list.filter((g) => g.status === "ended"),
  });
}
