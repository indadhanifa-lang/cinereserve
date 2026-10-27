"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type TodaySchedule = {
  id: number;
  movie: { id: number | null; title: string | null };
  screen: { id: number | null; name: string | null };
  start_time: string;
  end_time: string;
  ticket_price: string;
  status: string;
};

/** Same badge palette the Reservations/Customers pages use. */
const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-400/10 text-emerald-400",
  cancelled: "bg-red-400/10 text-red-400",
  completed: "bg-sky-400/10 text-sky-400",
};

/** "08:00:00" or "08:00" → "8:00 AM" */
const formatTime = (value: string): string => {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = minuteRaw ?? "00";
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${suffix}`;
};

/** 250 or "250.00" → "₱250.00" */
const formatPrice = (value: string | number): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

/** "active" → "Active"; unknown values fall back to a neutral badge. */
const statusLabel = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

export function TodaySchedule() {
  const [schedules, setSchedules] = useState<TodaySchedule[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard/overview")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);
        setSchedules(Array.isArray(data.today_schedules) ? data.today_schedules : []);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        — <span className="text-[11px]">Unavailable</span>
      </p>
    );
  }

  if (schedules === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (schedules.length === 0) {
    return <p className="text-sm text-muted-foreground">No screenings scheduled today.</p>;
  }

  return (
    <ul className="divide-y divide-border/20 text-left">
      {schedules.map((schedule) => (
        <li
          key={schedule.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {schedule.movie?.title ?? "Untitled movie"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {schedule.screen?.name ?? "No screen"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
            </span>
            <span className="font-semibold text-foreground">
              {formatPrice(schedule.ticket_price)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                STATUS_BADGE[schedule.status] ?? "bg-muted text-muted-foreground"
              )}
            >
              {statusLabel(schedule.status)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
