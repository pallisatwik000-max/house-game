import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Admin registration. Works ONLY for emails the Owner approved first.
// The new account starts as "pending" until the Owner approves it.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim().slice(0, 60);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: invite } = await db
    .from("admin_invites")
    .select("email")
    .eq("email", email)
    .single();
  if (!invite) {
    return NextResponse.json(
      { error: "This email is not approved. Ask the Owner to approve it first" },
      { status: 403 }
    );
  }

  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "This email is already registered. Please log in" },
      { status: 409 }
    );
  }

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: "Could not create account. This email may already be in use" },
      { status: 409 }
    );
  }

  const { error: profileErr } = await db.from("profiles").insert({
    id: created.user.id,
    email,
    full_name: fullName || null,
    role: "admin",
    status: "pending",
  });
  if (profileErr) {
    await db.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Registered. Wait for the Owner to approve your account, then log in",
  });
}
