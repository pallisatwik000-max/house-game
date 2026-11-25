import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-24 w-24 animate-pop items-center justify-center rounded-full bg-brand-600 text-4xl font-extrabold text-white shadow-lg">
          90
        </div>
        <h1 className="text-3xl font-extrabold">90 Numbers House Game</h1>
        <p className="muted mt-2">
          Live multiplayer game with tickets, voice chat and instant winner checks.
        </p>

        <div className="card mt-8 w-full text-left">
          <h2 className="font-bold">Playing?</h2>
          <p className="muted mt-1 text-sm">
            Open the game link your Admin shared with you. You will enter your
            name and the game PIN.
          </p>
        </div>

        <div className="card mt-4 w-full text-left">
          <h2 className="font-bold">Admin or Owner?</h2>
          <p className="muted mt-1 text-sm">
            Log in to create games or manage the site.
          </p>
          <Link href="/login" className="btn-primary mt-3 w-full">
            Login / Register
          </Link>
        </div>
      </div>
    </main>
  );
}
