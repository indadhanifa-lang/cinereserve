"use client";

import { useEffect, useState } from "react";
import { Armchair } from "lucide-react";

type Occupancy = {
  rate: number;
  occupied: number;
  capacity: number;
  active_seats: number;
};

export function OccupancyStat() {
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard/occupancy")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);
        setOccupancy(data.occupancy);
      })
      .catch(() => setFailed(true));
  }, []);

  const value = failed ? "0%" : occupancy ? `${occupancy.rate}%` : "…";
  const hint = failed
    ? "Unavailable"
    : occupancy
      ? occupancy.occupied === 0
        ? "No active seats"
        : `${occupancy.occupied} seats reserved`
      : "Loading…";
  const footValue = failed ? "—" : occupancy ? `${occupancy.capacity} Seats` : "…";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/30 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">Hall Occupancy Rate</span>
        <Armchair className="h-5 w-5 text-primary" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2.5 text-[11px] text-muted-foreground">
        <span>Capacity total</span>
        <span className="font-semibold text-foreground">{footValue}</span>
      </div>
    </div>
  );
}
