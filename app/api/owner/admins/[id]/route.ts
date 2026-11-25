import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
  reactivate: "approved",
};

// Owner: approve / reject / suspend / reactivate an Admin account
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser(["owner"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const status = ACTIONS[String(body.action ?? "")];
  if (!status) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Only Admin accounts can be changed here, never an Owner
  const { data: target } = await db
    .from("profiles")
    .select("id,role")
    .eq("id", params.id)
    .single();
  if (!target || target.role !== "admin") {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  const { error } = await db
    .from("profiles")
    .update({ status })
    .eq("id", target.id);
  if (error) {
    return NextResponse.json({ error: "Could not update admin" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
