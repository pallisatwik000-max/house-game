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
