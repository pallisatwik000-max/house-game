import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { derivePin, generateSlug, hashPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

// Create a new game
export async function POST(req: Request) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (name.length < 1 || name.length > 60) {
    return NextResponse.json(
      { error: "Game name must be 1 to 60 characters" },
      { status: 400 }
    );
  }

  const slug = generateSlug();
  const pin = derivePin(slug);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("games")
    .insert({
      admin_id: auth.profile.id,
      name,
      slug,
      pin_hash: hashPin(pin, slug),
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not create game" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    id: data.id,
    name,
    slug,
    pin,
    link: `${origin}/join/${slug}`,
  });
}

// List this Admin's games
export async function GET(req: Request) {
  const auth = await requireUser(["admin"]);
  if (auth.error) return auth.error;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("games")
    .select("id,name,slug,status,called_numbers,started_at,ended_at,created_at")
    .eq("admin_id", auth.profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load games" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const games = (data ?? []).map((g) => ({
    ...g,
    pin: derivePin(g.slug),
    link: `${origin}/join/${g.slug}`,
  }));

  return NextResponse.json({ games });
}
