"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NumberBoard from "@/components/NumberBoard";
import ThemeToggle from "@/components/ThemeToggle";

type PlayerRow = {
  id: string;
  name: string;
  ticket_count: number;
  is_admin_player: boolean;
  ticket_nos: number[];
};

type ClaimRow = {
  id: string;
  category: string;
  status: string;
  player_name: string;
  ticket_no: number;
  created_at: string;
};

type State = {
  game: {
    id: string;
    name: string;
    status: "lobby" | "running" | "paused" | "ended";
    pin: string;
    link: string;
  };
  called: number[];
  latest: number | null;
  players: PlayerRow[];
  claims: ClaimRow[];
};

const LABEL: Record<string, string> = {
  FIRST_5: "FIRST 5",
  FIRST_LINE: "FIRST LINE",
  SECOND_LINE: "SECOND LINE",
  LAST_LINE: "LAST LINE",
  HOUSE_FULL: "HOUSE FULL",
};

export default function AdminGame() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [s, setS] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const [pName, setPName] = useState("");
  const [pTickets, setPTickets] = useState(1);
  const [pSelf, setPSelf] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/games/${id}/state`, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      router.push("/login");
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (res.ok) setS(json);
    else if (res.status === 404) setError("Game not found");
  }, [id, router]);

  // Refresh every 2.5 seconds, so a page refresh never loses the game
  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  async function call(path: string, method: string, body?: unknown) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const control = (action: string) =>
    call(`/api/admin/games/${id}/control`, "POST", { action });

  async function endGame() {
    if (!window.confirm("End this game? This cannot be undone.")) return;
    await control("end");
  }

  async function nextNumber() {
    await call(`/api/admin/games/${id}/next`, "POST");
  }

  async function addPlayer(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!pName.trim()) {
      setError("Enter the player name");
      return;
    }
    const ok = await call(`/api/admin/games/${id}/players`, "POST", {
      name: pName,
      ticket_count: pTickets,
      is_admin_player: pSelf,
    });
    if (ok) {
      setPName("");
      setPTickets(1);
      setPSelf(false);
    }
  }

  async function editPlayer(p: PlayerRow) {
    const name = window.prompt("Player name", p.name);
    if (name === null) return;
    const patch: { name?: string; ticket_count?: number } = {};
    if (name.trim() && name.trim() !== p.name) patch.name = name.trim();

    if (s?.game.status === "lobby") {
      const t = window.prompt("Number of tickets (1 to 6)", String(p.ticket_count));
      if (t === null) return;
      const n = Number(t);
      if (n !== p.ticket_count) patch.ticket_count = n;
    }
    if (Object.keys(patch).length === 0) return;
    await call(`/api/admin/games/${id}/players/${p.id}`, "PATCH", patch);
  }

  async function removePlayer(p: PlayerRow) {
    if (!window.confirm(`Remove ${p.name}?`)) return;
    await call(`/api/admin/games/${id}/players/${p.id}`, "DELETE");
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  }

  if (!s) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <p className="muted">{error || "Loading..."}</p>
      </main>
    );
  }

  const status = s.game.status;
  const lobby = status === "lobby";
  const ended = status === "ended";
  const recent = [...s.called].reverse();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="muted text-sm">
          ← All games
        </Link>
        <ThemeToggle />
      </div>

      <h1 className="mt-3 text-2xl font-extrabold">{s.game.name}</h1>
      <p className="muted text-sm">
        Status:{" "}
        <b>
          {lobby ? "Not started" : status === "running" ? "Live" : status === "paused" ? "Paused" : "Ended"}
        </b>
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 p-2 text-sm font-semibold text-red-500">
          {error}
        </p>
      )}

      {/* Link and PIN */}
      <div className="card mt-4">
        <p className="muted text-xs font-semibold uppercase">Joining link</p>
        <p className="break-all text-sm">{s.game.link}</p>
        <button className="btn-ghost mt-1 !py-1.5" onClick={() => copy(s.game.link, "link")}>
          {copied === "link" ? "Copied ✓" : "Copy link"}
        </button>
        <p className="muted mt-3 text-xs font-semibold uppercase">Game PIN</p>
        <p className="text-3xl font-extrabold tracking-widest">{s.game.pin}</p>
        <button className="btn-ghost mt-1 !py-1.5" onClick={() => copy(s.game.pin, "pin")}>
          {copied === "pin" ? "Copied ✓" : "Copy PIN"}
        </button>
      </div>

      {/* Game controls */}
      <div className="card mt-4">
        <div className="flex flex-wrap gap-2">
          {lobby && (
            <button className="btn-primary" disabled={busy} onClick={() => control("start")}>
              ▶ Start game
            </button>
          )}
          {status === "running" && (
            <button className="btn-ghost" disabled={busy} onClick={() => control("pause")}>
              ⏸ Pause
            </button>
          )}
          {status === "paused" && (
            <button className="btn-primary" disabled={busy} onClick={() => control("resume")}>
              ▶ Resume
            </button>
          )}
          {!ended && !lobby && (
            <button className="btn-danger" disabled={busy} onClick={endGame}>
              ■ End game
            </button>
          )}
        </div>
      </div>

      {/* Latest number and NEXT NUMBER */}
      {!lobby && (
        <div className="card mt-4 text-center">
          <p className="muted text-xs font-semibold uppercase">Latest number</p>
          <div
            key={s.latest ?? "none"}
            className="mx-auto mt-2 flex h-28 w-28 animate-pop items-center justify-center rounded-full bg-amber-400 text-5xl font-extrabold text-black"
          >
            {s.latest ?? "--"}
          </div>
          <p className="muted mt-2 text-sm">{s.called.length} / 90 called</p>
          <button
            className="btn-primary mt-3 w-full !py-4 text-lg"
            disabled={busy || status !== "running" || s.called.length >= 90}
            onClick={nextNumber}
          >
            NEXT NUMBER
          </button>
        </div>
      )}

      {/* Claims */}
      <div className="card mt-4">
        <h2 className="font-bold">Winning claims</h2>
        {s.claims.length === 0 && <p className="muted mt-1 text-sm">No claims yet.</p>}
        <div className="mt-2 space-y-2">
          {s.claims.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border p-3 ${
                c.status === "valid" ? "border-green-500 bg-green-500/10" : ""
              }`}
              style={c.status === "valid" ? undefined : { borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <b>{LABEL[c.category] ?? c.category}</b>
                <span
                  className={`text-xs font-bold ${
                    c.status === "valid" ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {c.status === "valid" ? "VERIFIED WINNER" : "NOT VALID"}
                </span>
              </div>
              <p className="muted text-sm">
                {c.player_name} · Ticket {c.ticket_no} ·{" "}
                {new Date(c.created_at).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Number history */}
      {!lobby && (
        <div className="card mt-4">
          <h2 className="font-bold">Number history</h2>
          <div className="mt-2">
            <NumberBoard called={s.called} latest={s.latest} />
          </div>
          {recent.length > 0 && (
            <p className="muted mt-3 break-words text-sm">
              Order called (latest first): {recent.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Players */}
      <div className="card mt-4">
        <h2 className="font-bold">Players ({s.players.length})</h2>

        {!ended && (
          <form onSubmit={addPlayer} className="mt-3 space-y-2">
            <input
              className="input"
              placeholder="Player name"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              maxLength={40}
            />
            <div className="flex items-center gap-2">
              <label className="muted text-sm">Tickets</label>
              <select
                className="input !w-24"
                value={pTickets}
                onChange={(e) => setPTickets(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary ml-auto" disabled={busy}>
                Add player
              </button>
            </div>
            <label className="muted flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pSelf}
                onChange={(e) => setPSelf(e.target.checked)}
              />
              This is me (Admin playing too)
            </label>
          </form>
        )}

        <div className="mt-3 space-y-2">
          {s.players.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <b>
                  {p.name}
                  {p.is_admin_player ? " (Admin)" : ""}
                </b>
                <span className="muted text-sm">{p.ticket_count} ticket(s)</span>
              </div>
              <p className="muted text-xs">Ticket no: {p.ticket_nos.join(", ")}</p>
              {!ended && (
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost !py-1.5" onClick={() => editPlayer(p)}>
                    Edit
                  </button>
                  {lobby && (
                    <button className="btn-danger !py-1.5" onClick={() => removePlayer(p)}>
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="muted mt-3 text-xs">
          Admin playing too? Add yourself with the box ticked, then open the joining
          link on your own device and join with your name and the PIN.
        </p>
      </div>
    </main>
  );
                           }
