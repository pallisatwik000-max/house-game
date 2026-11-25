"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NumberBoard from "@/components/NumberBoard";
import ThemeToggle from "@/components/ThemeToggle";
import Ticket, { TicketData } from "@/components/Ticket";

type Winner = {
  category: string;
  player_name: string;
  ticket_no: number;
  created_at: string;
};

type PlayState = {
  player: { name: string; ticket_count: number; is_admin_player: boolean };
  game: { id: string; name: string; status: "lobby" | "running" | "paused" | "ended" };
  called: number[];
  latest: number | null;
  tickets: TicketData[];
  winners: Winner[];
};

type ClaimResult = {
  valid: boolean;
  message: string;
  category: string;
  ticket_no: number;
};

const LABEL: Record<string, string> = {
  FIRST_5: "FIRST 5",
  FIRST_LINE: "FIRST LINE",
  SECOND_LINE: "SECOND LINE",
  LAST_LINE: "LAST LINE",
  HOUSE_FULL: "HOUSE FULL",
};

export default function PlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const tokenKey = `hg_token_${slug}`;

  const [s, setS] = useState<PlayState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = useCallback(() => {
    try {
      return localStorage.getItem(tokenKey) ?? "";
    } catch {
      return "";
    }
  }, [tokenKey]);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace(`/join/${slug}`);
      return;
    }
    const res = await fetch("/api/player/state", {
      headers: { "x-player-token": token },
      cache: "no-store",
    });
    if (res.status === 401) {
      try {
        localStorage.removeItem(tokenKey);
      } catch {}
      router.replace(`/join/${slug}`);
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (res.ok) setS(json);
  }, [getToken, router, slug, tokenKey]);

  // Refresh every 2 seconds. A page refresh never loses your tickets or marks.
  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  function flash(r: ClaimResult) {
    setResult(r);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult(null), 6000);
  }

  async function mark(ticketId: string, number: number, marked: boolean) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/player/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-player-token": getToken() },
        body: JSON.stringify({ ticket_id: ticketId, number, marked }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "Could not mark");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function claim(ticketId: string, category: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/player/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-player-token": getToken() },
        body: JSON.stringify({ ticket_id: ticketId, category }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "Could not send claim");
      else flash(json);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!s) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <p className="muted">Loading your game...</p>
      </main>
    );
  }

  const status = s.game.status;
  const canAct = status === "running" || status === "paused";
  const wonCategories = s.winners.map((w) => w.category);

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold">{s.game.name}</h1>
          <p className="muted text-xs">Playing as {s.player.name}</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Claim result banner */}
      {result && (
        <div
          className={`mt-3 animate-pop rounded-2xl p-4 text-center font-extrabold text-white ${
            result.valid ? "bg-green-600" : "bg-red-600"
          }`}
        >
          <p className="text-xl">{result.message}</p>
          <p className="mt-1 text-sm font-semibold">
            {LABEL[result.category]} · Ticket {result.ticket_no}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 p-2 text-sm font-semibold text-red-500">
          {error}
        </p>
      )}

      {/* Status */}
      {status === "lobby" && (
        <div className="card mt-4 text-center">
          <p className="font-bold">Waiting for the Admin to start the game...</p>
          <p className="muted mt-1 text-sm">Your tickets are ready below.</p>
        </div>
      )}
      {status === "paused" && (
        <div className="card mt-4 text-center font-bold text-amber-600">
          Game paused by Admin
        </div>
      )}
      {status === "ended" && (
        <div className="card mt-4 text-center font-bold">Game ended. Thanks for playing!</div>
      )}

      {/* Latest number */}
      {status !== "lobby" && (
        <div className="card mt-4 text-center">
          <p className="muted text-xs font-semibold uppercase">Latest number</p>
          <div
            key={s.latest ?? "none"}
            className="mx-auto mt-2 flex h-28 w-28 animate-pop items-center justify-center rounded-full bg-amber-400 text-5xl font-extrabold text-black"
          >
            {s.latest ?? "--"}
          </div>
          <p className="muted mt-2 text-sm">{s.called.length} / 90 called</p>
          {s.called.length > 1 && (
            <p className="muted mt-1 break-words text-xs">
              Previous: {[...s.called].reverse().slice(1, 11).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Winners */}
      {s.winners.length > 0 && (
        <div className="card mt-4">
          <h2 className="font-bold">Winners</h2>
          <div className="mt-2 space-y-1">
            {s.winners.map((w) => (
              <p key={w.category} className="text-sm">
                🏆 <b>{LABEL[w.category]}</b>: {w.player_name} (Ticket {w.ticket_no})
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tickets */}
      <h2 className="mt-5 font-bold">Your tickets</h2>
      <p className="muted text-xs">
        Tap a number to mark it after it is called. Tap again to unmark.
      </p>
      <div className="mt-2 space-y-3">
        {s.tickets.map((t) => (
          <Ticket
            key={t.id}
            ticket={t}
            wonCategories={wonCategories}
            canAct={canAct}
            busy={busy}
            onMark={mark}
            onClaim={claim}
          />
        ))}
      </div>

      {/* Called numbers board */}
      {status !== "lobby" && (
        <div className="card mt-4">
          <h2 className="mb-2 font-bold">Called numbers</h2>
          <NumberBoard called={s.called} latest={s.latest} />
        </div>
      )}
    </main>
  );
      }
