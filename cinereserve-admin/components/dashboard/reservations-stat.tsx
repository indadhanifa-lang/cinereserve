"use client";

import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";

type Reservations = {
  confirmed_reservations_today: number;
  pending_reservations_today: number;
};

export function ReservationsStat() {
  const [reservations, setReservations] = useState<Reservations | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard/overview")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);
        setReservations({
          confirmed_reservations_today: data.confirmed_reservations_today,
          pending_reservations_today: data.pending_reservations_today,
        });
      })
      .catch(() => setFailed(true));
  }, []);

  const value = failed
    ? "—"
    : reservations
      ? String(reservations.confirmed_reservations_today)
      : "…";
  const hint = failed ? "Unavailable" : reservations ? "Confirmed today" : "Loading…";
  const footValue = failed
    ? "—"
    : reservations
      ? String(reservations.pending_reservations_today)
      : "…";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/30 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">Reservations Issued</span>
        <Ticket className="h-5 w-5 text-primary" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2.5 text-[11px] text-muted-foreground">
        <span>Pending reservations</span>
        <span className="font-semibold text-foreground">{footValue}</span>
      </div>
    </div>
  );
}
