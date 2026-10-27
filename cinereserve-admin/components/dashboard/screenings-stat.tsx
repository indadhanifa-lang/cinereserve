"use client";

import { useEffect, useState } from "react";
import { Tv } from "lucide-react";

type Screenings = {
  active_screenings: number;
  standby_screens: number;
  total_halls: number;
};

export function ScreeningsStat() {
  const [screenings, setScreenings] = useState<Screenings | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard/occupancy")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);
        setScreenings({
          active_screenings: data.active_screenings,
          standby_screens: data.standby_screens,
          total_halls: data.total_halls,
        });
      })
      .catch(() => setFailed(true));
  }, []);

  const value = failed
    ? "—"
    : screenings
      ? String(screenings.active_screenings)
      : "…";
  const hint = failed
    ? "Unavailable"
    : screenings
      ? screenings.active_screenings === 0
        ? "No screenings in progress"
        : "Screening now"
      : "Loading…";
  const standby = failed
    ? "—"
    : screenings
      ? `${screenings.standby_screens} screen${screenings.standby_screens === 1 ? "" : "s"} standby`
      : "…";
  const footValue = failed
    ? "—"
    : screenings
      ? `${screenings.total_halls} Hall${screenings.total_halls === 1 ? "" : "s"}`
      : "…";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/30 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">Active Screenings</span>
        <Tv className="h-5 w-5 text-primary" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{standby}</p>
      <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2.5 text-[11px] text-muted-foreground">
        <span>Auditoriums ready</span>
        <span className="font-semibold text-foreground">{footValue}</span>
      </div>
    </div>
  );
}
