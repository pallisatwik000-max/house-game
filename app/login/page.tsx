"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function login() {
    const sb = supabaseBrowser();
    const { data, error: err } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (err || !data.user) {
      setError("Wrong email or password");
      return;
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      await sb.auth.signOut();
      setError("No Owner or Admin account found for this email");
      return;
    }
    if (profile.status === "pending") {
      await sb.auth.signOut();
      setError("Your account is waiting for Owner approval");
      return;
    }
    if (profile.status === "rejected") {
      await sb.auth.signOut();
      setError("Your account was rejected by the Owner");
      return;
    }
    if (profile.status === "suspended") {
      await sb.auth.signOut();
      setError("Your account is suspended. Contact the Owner");
      return;
    }

    router.push(profile.role === "owner" ? "/owner" : "/admin");
    router.refresh();
  }

  async function register() {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not register");
      return;
    }
    setInfo(json.message ?? "Registered. Wait for Owner approval");
    setMode("login");
    setPassword("");
  }

  async function submit(e?: React.SyntheticEvent) {
    e?.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login();
      else await register();
    } catch {
      setError("Something went wrong. Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="muted text-sm">
          ← Home
        </Link>
        <ThemeToggle />
      </div>

      <div className="card mt-8">
        <h1 className="text-2xl font-extrabold">
          {mode === "login" ? "Owner / Admin Login" : "Admin Registration"}
        </h1>
        <p className="muted mt-1 text-sm">
          {mode === "login"
            ? "Log in to manage games."
            : "Only emails approved by the Owner can register."}
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === "register" && (
            <input
              className="input"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="input"
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 p-2 text-sm font-semibold text-red-500">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-green-500/10 p-2 text-sm font-semibold text-green-600">
              {info}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>

        <button
          type="button"
          className="muted mt-4 w-full text-center text-sm underline"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
            setInfo("");
          }}
        >
          {mode === "login"
            ? "New Admin? Register here"
            : "Already registered? Login"}
        </button>
      </div>
    </main>
  );
            }
