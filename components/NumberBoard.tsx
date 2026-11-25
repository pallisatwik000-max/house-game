// 1 to 90 board. Called numbers are filled, the latest one glows.
// Used on both the Admin and Player screens.
export default function NumberBoard({
  called,
  latest,
}: {
  called: number[];
  latest: number | null;
}) {
  const set = new Set(called);
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
        const isLatest = n === latest;
        const isCalled = set.has(n);
        const cls = isLatest
          ? "bg-amber-400 text-black animate-pop"
          : isCalled
          ? "bg-brand-600 text-white"
          : "border muted";
        return (
          <div
            key={n}
            className={`flex aspect-square items-center justify-center rounded-md text-[11px] font-bold sm:text-sm ${cls}`}
            style={isCalled ? undefined : { borderColor: "var(--border)" }}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
}
