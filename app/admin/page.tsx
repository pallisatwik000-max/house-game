"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import ThemeToggle from "@/components/ThemeToggle";

type GameRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  called_numbers: number[];
  pin: string;
  link: string;
  created_at: string;
};

type Created = { name: string; pin: string; link: string; id: string };

const STATUS_LABEL: Record<string, string> = {
  lobby: "Not started",
  running: "Live",
  paused: "Paused",
  ended: "Ended",
};

export default function AdminHome() {
  const router = useRouter();
  const [games, setGames] = useState<GameRow[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/games", { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      router.push("/login");
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (res.ok) setGames(json.games ?? []);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function createGame(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter a game name");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not create game");
        return;
      }
      setCreated(json);
      setName("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  }

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <ThemeToggle />
          <button className="btn-ghost !px-3 !py-2" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <form onSubmit={createGame} className="card mt-5">
        <h2 className="font-bold">Create new game</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="input"
            placeholder="Game name (ex: Sunday Housie)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <button type="submit" className="btn-primary shrink-0" disabled={busy}>
            {busy ? "..." : "Create"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-red-500">{error}</p>}
      </form>

      {created && (
        <div className="card mt-4 border-brand-500">
          <h2 className="font-bold">Game created: {created.name}</h2>
          <p className="muted mt-1 text-sm">Share this link and PIN with your players.</p>

          <p className="muted mt-3 text-xs font-semibold uppercase">Joining link</p>
          <p className="break-all text-sm">{created.link}</p>
          <button
            className="btn-ghost mt-1 !py-1.5"
            onClick={() => copy(created.link, "link")}
          >
            {copied === "link" ? "Copied ✓" : "Copy link"}
          </button>

          <p className="muted mt-3 text-xs font-semibold uppercase">Game PIN</p>
          <p className="text-3xl font-extrabold tracking-widest">{created.pin}</p>
          <button
            className="btn-ghost mt-1 !py-1.5"
            onClick={() => copy(created.pin, "pin")}
          >
            {copied === "pin" ? "Copied ✓" : "Copy PIN"}
          </button>

          <Link href={`/admin/game/${created.id}`} className="btn-primary mt-4 w-full">
            Open game and add players
          </Link>
        </div>
      )}

      <h2 className="mt-6 font-bold">Your games</h2>
      <div className="mt-2 space-y-2">
        {games.length === 0 && (
          <p className="muted text-sm">No games yet. Create your first game above.</p>
        )}
        {games.map((g) => (
          <Link
            key={g.id}
            href={`/admin/game/${g.id}`}
            className="card flex items-center justify-between"
          >
            <div>
              <p className="font-bold">{g.name}</p>
              <p className="muted text-xs">
                {g.called_numbers.length} / 90 numbers called
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                g.status === "running"
                  ? "bg-green-500/15 text-green-600"
                  : g.status === "paused"
                  ? "bg-amber-500/15 text-amber-600"
                  : "bg-slate-500/15 muted"
              }`}
            >
              {STATUS_LABEL[g.status] ?? g.status}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
          }
