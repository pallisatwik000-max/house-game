import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabaseAdmin } from "./supabase-admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "admin";
  status: string;
};

export type Game = {
  id: string;
  admin_id: string;
  name: string;
  slug: string;
  pin_hash: string;
  status: "lobby" | "running" | "paused" | "ended";
  called_numbers: number[];
  started_at: string | null;
  ended_at: string | null;
};

export type Player = {
  id: string;
  game_id: string;
  name: string;
  ticket_count: number;
  is_admin_player: boolean;
  session_token: string;
};

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Supabase client that reads the logged-in user from cookies (server only)
export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(list: CookieToSet[]) {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a read-only context: safe to ignore
          }
        },
      },
    }
  );
}

type UserResult =
  | { profile: Profile; error?: undefined }
  | { error: NextResponse; profile?: undefined };

// Allow only logged-in, APPROVED users with one of the given roles
export async function requireUser(
  roles: ("owner" | "admin")[]
): Promise<UserResult> {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Please log in" }, { status: 401 }),
    };
  }

  const db = supabaseAdmin();
  const { data } = await db
    .from("profiles")
    .select("id,email,full_name,role,status")
    .eq("id", user.id)
    .single();
  const profile = data as Profile | null;

  if (!profile || !roles.includes(profile.role) || profile.status !== "approved") {
    return {
      error: NextResponse.json({ error: "Not allowed" }, { status: 403 }),
    };
  }

  // Online / offline status for the Owner dashboard
  await db
    .from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", profile.id);

  return { profile };
}

type PlayerResult =
  | { player: Player; game: Game; error?: undefined }
  | { error: NextResponse; player?: undefined; game?: undefined };

// Players have no login. They send their secret session token in the
// "x-player-token" header, and the server finds who they are.
export async function requirePlayer(req: Request): Promise<PlayerResult> {
  const token = req.headers.get("x-player-token");
  if (!token) {
    return {
      error: NextResponse.json({ error: "Not joined" }, { status: 401 }),
    };
  }

  const db = supabaseAdmin();
  const { data } = await db
    .from("players")
    .select("*, games(*)")
    .eq("session_token", token)
    .single();

  if (!data) {
    return {
      error: NextResponse.json({ error: "Invalid session" }, { status: 401 }),
    };
  }

  const { games, ...player } = data as Player & { games: Game };
  return { player: player as Player, game: games };
}
