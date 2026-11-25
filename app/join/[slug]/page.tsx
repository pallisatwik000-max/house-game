"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export default function JoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [gameName, setGameName] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Already joined on this phone? Go straight back to the game.
    try {
      if (localStorage.getItem(`hg_token_${slug}`)) {
        router.replace(`/play/${slug}`);
        return;
      }
    } catch {}

    fetch(`/api/join?slug=${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) setError(json.error ?? "Game not found");
        else setGameName(json.name);
      })
      .catch(() => setError("Could not load the game"))
      .finally(() => setLoading(false));
  }, [slug, router]);

  async function join(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !pin.trim()) {
      setError("Enter your name and the game PIN");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, pin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not join");
        return;
      }
      try {
        localStorage.setItem(`hg_token_${slug}`, json.token);
      } catch {}
      router.push(`/play/${slug}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="card mt-8">
        {loading ? (
          <p className="muted">Loading...</p>
        ) : !gameName ? (
          <>
            <h1 className="text-xl font-extrabold">Game not found</h1>
            <p className="muted mt-1 text-sm">{error || "Check the link and try again."}</p>
          </>
        ) : (
          <>
            <p className="muted text-xs font-semibold uppercase">You are joining</p>
            <h1 className="text-2xl font-extrabold">{gameName}</h1>

            <form onSubmit={join} className="mt-4 space-y-3">
              <input
                className="input"
                placeholder="Your name (same as Admin added)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="off"
              />
              <input
                className="input tracking-widest"
                placeholder="Game PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="off"
              />

              {error && (
                <p className="rounded-lg bg-red-500/10 p-2 text-sm font-semibold text-red-500">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "Checking..." : "Join game"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
