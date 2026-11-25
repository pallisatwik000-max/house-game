"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import ThemeToggle from "@/components/ThemeToggle";

type AdminRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  online: boolean;
  total_games: number;
  running_games: number;
};

type Invite = { email: string };

type Winner = {
  category: string;
  player_name: string;
  ticket_no: number;
};

type GameRow = {
  id: string;
  name: string;
  status: string;
  admin_email: string;
  player_count: number;
  called_count: number;
  latest: number | null;
  started_at: string | null;
  ended_at: string | null;
  winners: Winner[];
};

const LABEL: Record<string, string> = {
  FIRST_5: "FIRST 5",
  FIRST_LINE: "FIRST LINE",
  SECOND_LINE: "SECOND LINE",
  LAST_LINE: "LAST LINE",
  HOUSE_FULL: "HOUSE FULL",
};

export default function OwnerPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [live, setLive] = useState<GameRow[]>([]);
  const [history, setHistory] = useState<GameRow[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, g] = await Promise.all([
      fetch("/api/owner/admins", { cache: "no-store" }),
      fetch("/api/owner/games", { cache: "no-store" }),
    ]);
    if (a.status === 401 || a.status === 403) {
      router.push("/login");
      return;
    }
    const aj = await a.json().catch(() => ({}));
    const gj = await g.json().catch(() => ({}));
    if (a.ok) {
      setAdmins(aj.admins ?? []);
      setInvites(aj.invites ?? []);
    }
    if (g.ok) {
      setLive(gj.live ?? []);
      setHistory(gj.history ?? []);
    }
  }, [router]);

  // Live monitoring: refresh every 3 seconds
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function approveEmail(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter an email");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/owner/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not save");
        return;
      }
      setInfo(`${json.email} can now register as Admin`);
      setEmail("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: string) {
    setError("");
    setInfo("");
    const res = await fetch(`/api/owner/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "Could not update");
    load();
  }

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const statusColor = (st: string) =>
    st === "approved"
      ? "bg-green-500/15 text-green-600"
      : st === "pending"
      ? "bg-amber-500/15 text-amber-600"
      : "bg-red-500/15 text-red-500";

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Owner Dashboard</h1>
        <div className="flex gap-2">
          <ThemeToggle />
          <button className="btn-ghost !px-3 !py-2" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {/* Approve an Admin email */}
      <form onSubmit={approveEmail} className="card mt-5">
        <h2 className="font-bold">Create Admin: approve an email</h2>
        <p className="muted mt-1 text-sm">
          Add the email here first. That person then registers on the login page
          and you approve the account below.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className="input"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="btn-primary shrink-0" disabled={busy}>
            Approve email
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-red-500">{error}</p>}
        {info && <p className="mt-2 text-sm font-semibold text-green-600">{info}</p>}

        {invites.length > 0 && (
          <div className="mt-3">
            <p className="muted text-xs font-semibold uppercase">
              Approved, not registered yet
            </p>
            {invites.map((i) => (
              <p key={i.email} className="text-sm">
                {i.email}
              </p>
            ))}
          </div>
        )}
      </form>

      {/* Admins */}
      <h2 className="mt-6 font-bold">Admins ({admins.length})</h2>
      <div className="mt-2 space-y-2">
        {admins.length === 0 && <p className="muted text-sm">No admins yet.</p>}
        {admins.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">
                  <span
                    className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                      a.online ? "bg-green-500" : "bg-slate-400"
                    }`}
                  />
                  {a.full_name || a.email}
                </p>
                <p className="muted truncate text-xs">{a.email}</p>
                <p className="muted text-xs">
                  {a.online ? "Online" : "Offline"} · {a.total_games} game(s) ·{" "}
                  {a.running_games} running
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusColor(
                  a.status
                )}`}
              >
                {a.status}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {a.status === "pending" && (
                <>
                  <button className="btn-primary !py-1.5" onClick={() => act(a.id, "approve")}>
                    Approve
                  </button>
                  <button className="btn-danger !py-1.5" onClick={() => act(a.id, "reject")}>
                    Reject
                  </button>
                </>
              )}
              {a.status === "approved" && (
                <button className="btn-danger !py-1.5" onClick={() => act(a.id, "suspend")}>
                  Suspend
                </button>
              )}
              {(a.status === "suspended" || a.status === "rejected") && (
                <button className="btn-primary !py-1.5" onClick={() => act(a.id, "reactivate")}>
                  {a.status === "rejected" ? "Approve" : "Reactivate"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Live games */}
      <h2 className="mt-6 font-bold">Live games ({live.length})</h2>
      <div className="mt-2 space-y-2">
        {live.length === 0 && <p className="muted text-sm">No games running right now.</p>}
        {live.map((g) => (
          <div key={g.id} className="card">
            <div className="flex items-center justify-between">
              <p className="font-bold">{g.name}</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  g.status === "running"
                    ? "bg-green-500/15 text-green-600"
                    : "bg-amber-500/15 text-amber-600"
                }`}
              >
                {g.status === "running" ? "Live" : "Paused"}
              </span>
            </div>
            <p className="muted text-xs">Admin: {g.admin_email}</p>
            <p className="mt-1 text-sm">
              {g.player_count} players · {g.called_count} / 90 called · Latest:{" "}
              <b>{g.latest ?? "--"}</b>
            </p>
            {g.winners.length > 0 && (
              <div className="mt-2 text-sm">
                {g.winners.map((w) => (
                  <p key={w.category}>
                    🏆 {LABEL[w.category]}: {w.player_name} (Ticket {w.ticket_no})
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* History */}
      <h2 className="mt-6 font-bold">Game history ({history.length})</h2>
      <div className="mt-2 space-y-2">
        {history.length === 0 && <p className="muted text-sm">No finished games yet.</p>}
        {history.map((g) => (
          <div key={g.id} className="card">
            <p className="font-bold">{g.name}</p>
            <p className="muted text-xs">
              Admin: {g.admin_email} · {g.player_count} players · {g.called_count} numbers
            </p>
            <p className="muted text-xs">
              {g.started_at ? new Date(g.started_at).toLocaleString() : "Not started"}
              {g.ended_at ? ` to ${new Date(g.ended_at).toLocaleString()}` : ""}
            </p>
            {g.winners.length > 0 && (
              <div className="mt-2 text-sm">
                {g.winners.map((w) => (
                  <p key={w.category}>
                    🏆 {LABEL[w.category]}: {w.player_name} (Ticket {w.ticket_no})
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
          }
