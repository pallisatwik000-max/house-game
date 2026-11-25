import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

// Owner: list all admins (with online status) and invited emails
export async function GET() {
  const auth = await requireUser(["owner"]);
  if (auth.error) return auth.error;

  const db = supabaseAdmin();

  const { data: admins } = await db
    .from("profiles")
    .select("id,email,full_name,status,last_seen,created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: false });

  const { data: invites } = await db
    .from("admin_invites")
    .select("email,created_at");

  const { data: games } = await db
    .from("games")
    .select("admin_id,status");

  const now = Date.now();
  const list = (admins ?? []).map((a) => {
    const mine = (games ?? []).filter((g) => g.admin_id === a.id);
    return {
      ...a,
      online: a.last_seen
        ? now - new Date(a.last_seen).getTime() < ONLINE_WINDOW_MS
        : false,
      total_games: mine.length,
      running_games: mine.filter(
        (g) => g.status === "running" || g.status === "paused"
      ).length,
    };
  });

  // Invited but have not signed up yet
  const signedUp = new Set((admins ?? []).map((a) => a.email.toLowerCase()));
  const pendingInvites = (invites ?? []).filter(
    (i) => !signedUp.has(i.email.toLowerCase())
  );

  return NextResponse.json({ admins: list, invites: pendingInvites });
}

// Owner: approve an email address so that person can register as Admin
export async function POST(req: Request) {
  const auth = await requireUser(["owner"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from("admin_invites")
    .upsert({ email, created_by: auth.profile.id }, { onConflict: "email" });

  if (error) {
    return NextResponse.json({ error: "Could not save email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email });
}
