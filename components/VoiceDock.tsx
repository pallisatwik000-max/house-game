"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useVoice, Role } from "@/lib/useVoice";

type Target = { gameId: string; name: string; role: Role };

const LINK_TEXT: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  reconnecting: "Reconnecting...",
};

// Floating voice chat button. It appears by itself on the Admin game
// screen and on the Player game screen, so those pages stay unchanged.
export default function VoiceDock() {
  const pathname = usePathname() || "";
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);

  const v = useVoice(target?.gameId ?? null);

  useEffect(() => {
    let cancelled = false;
    const adminMatch = pathname.match(/^\/admin\/game\/([^/]+)/);
    const playMatch = pathname.match(/^\/play\/([^/]+)/);

    if (adminMatch) {
      setTarget({ gameId: adminMatch[1], name: "Admin", role: "admin" });
      return;
    }

    if (playMatch) {
      const slug = playMatch[1];
      let token = "";
      try {
        token = localStorage.getItem(`hg_token_${slug}`) ?? "";
      } catch {}
      if (!token) {
        setTarget(null);
        return;
      }
      fetch("/api/player/state", {
        headers: { "x-player-token": token },
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!cancelled && j) {
            setTarget({ gameId: j.game.id, name: j.player.name, role: "player" });
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    setTarget(null);
  }, [pathname]);

  if (!target) return null;

  const active = v.status === "on" || v.status === "connecting";
  const isAdmin = target.role === "admin";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {open && (
        <div className="card max-h-[70vh] w-72 overflow-y-auto shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold">Voice chat</h3>
            <button className="muted text-sm" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          {v.error && (
            <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs font-semibold text-red-500">
              {v.error}
            </p>
          )}

          {!active && (
            <>
              <p className="muted mt-2 text-sm">
                Talk with everyone in this game. Your browser will ask for
                microphone permission.
              </p>
              <button
                className="btn-primary mt-3 w-full"
                disabled={v.status === "asking"}
                onClick={() => v.join(target.name, target.role)}
              >
                {v.status === "asking" ? "Waiting for permission..." : "🎙 Join voice chat"}
              </button>
            </>
          )}

          {active && (
            <>
              <p className="muted mt-2 text-xs">
                {v.status === "on" ? "Connected to voice room" : "Connecting to voice room..."}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  className={`btn-ghost !px-2 !py-2 text-xs ${
                    v.micOn ? "" : "!border-red-500 text-red-500"
                  }`}
                  onClick={v.toggleMic}
                >
                  {v.micOn ? "🎙 Mic on" : "🔇 Muted"}
                </button>
                <button
                  className={`btn-ghost !px-2 !py-2 text-xs ${
                    v.speakerOn ? "" : "!border-red-500 text-red-500"
                  }`}
                  onClick={v.toggleSpeaker}
                >
                  {v.speakerOn ? "🔊 Speaker" : "🔈 Off"}
                </button>
                <button className="btn-danger !px-2 !py-2 text-xs" onClick={v.leave}>
                  Leave
                </button>
              </div>

              <p className="muted mt-4 text-xs font-semibold uppercase">
                In voice ({v.people.length})
              </p>
              <div className="mt-1 space-y-2">
                {v.people.map((p) => {
                  const me = p.id === v.myId;
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border p-2"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold">
                          {p.micOn ? "🎙" : "🔇"} {p.name}
                          {p.role === "admin" ? " (Admin)" : ""}
                          {me ? " (You)" : ""}
                        </p>
                        <span className="muted shrink-0 text-[11px]">
                          {me ? "You" : LINK_TEXT[v.links[p.id]] ?? "Connecting..."}
                        </span>
                      </div>
                      {isAdmin && !me && (
                        <div className="mt-2 flex gap-2">
                          <button
                            className="btn-ghost !px-2 !py-1 text-xs"
                            onClick={() => v.moderate(p.id, "mute")}
                          >
                            Mute
                          </button>
                          <button
                            className="btn-danger !px-2 !py-1 text-xs"
                            onClick={() => v.moderate(p.id, "kick")}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <button
        className="btn-primary !rounded-full !px-5 !py-3 shadow-lg"
        onClick={() => setOpen((o) => !o)}
      >
        🎙 Voice{active ? ` · ${v.people.length}` : ""}
      </button>
    </div>
  );
                    }
