"use client";

export type TicketData = {
  id: string;
  ticket_no: number;
  rows: number[][];
  marked: number[];
  claims: { category: string; status: string }[];
};

const BUTTONS: { key: string; label: string }[] = [
  { key: "FIRST_5", label: "FIRST 5" },
  { key: "FIRST_LINE", label: "FIRST LINE" },
  { key: "SECOND_LINE", label: "SECOND LINE" },
  { key: "LAST_LINE", label: "LAST LINE" },
  { key: "HOUSE_FULL", label: "HOUSE FULL" },
];

// One digital ticket: 3 rows x 5 numbers, manual marking, 5 claim buttons.
// Numbers are NEVER marked automatically. The player taps them.
export default function Ticket({
  ticket,
  wonCategories,
  canAct,
  busy,
  onMark,
  onClaim,
}: {
  ticket: TicketData;
  wonCategories: string[];
  canAct: boolean;
  busy: boolean;
  onMark: (ticketId: string, number: number, marked: boolean) => void;
  onClaim: (ticketId: string, category: string) => void;
}) {
  const marked = new Set(ticket.marked);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-extrabold">Ticket {ticket.ticket_no}</h3>
        <span className="muted text-xs">{ticket.marked.length} / 15 marked</span>
      </div>

      <div className="space-y-1.5">
        {ticket.rows.map((row, r) => (
          <div key={r} className="grid grid-cols-5 gap-1.5">
            {row.map((n) => {
              const isMarked = marked.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!canAct || busy}
                  onClick={() => onMark(ticket.id, n, !isMarked)}
                  className={`cell ${isMarked ? "cell-marked" : ""}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2
