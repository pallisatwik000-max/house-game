"use client";

import { useEffect, useState } from "react";

// Dark / light switch. Remembers the choice on this phone.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-ghost !px-3 !py-2"
      aria-label="Switch theme"
    >
      {dark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}
