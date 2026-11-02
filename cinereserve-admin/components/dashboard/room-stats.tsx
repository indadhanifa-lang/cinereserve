"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarClock, DoorOpen } from "lucide-react";
import { formatClock } from "@/lib/hours";
import { LOADING } from "@/components/dashboard/loading-value";

type RoomStats = {
  rooms_in_use: number;
  total_halls: number;
  bookings_today: number;
  rooms_booked_today: number;
  next_booking_start: string | null;
};

/** Mini cinema overview figures; same endpoint the other stat cards read. */
function useRoomStats() {
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard/occupancy")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);
        setStats(data);
      })
      .catch(() => setFailed(true));
  }, []);

  return { stats, failed };
}

function Card({
  label,
  icon: Icon,
  value,
  hint,
  footLabel,
  footValue,
}: {
  label: string;
  icon: typeof DoorOpen;
  value: ReactNode;
  hint: string;
  footLabel: string;
  footValue: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/30 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{label}</span>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2.5 text-[11px] text-muted-foreground">
        <span>{footLabel}</span>
        <span className="font-semibold text-foreground">{footValue}</span>
      </div>
    </div>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Rooms with a movie playing right now, out of all active rooms. */
export function RoomsInUseStat() {
  const { stats, failed } = useRoomStats();
  const free = stats ? Math.max(0, stats.total_halls - stats.rooms_in_use) : 0;

  return (
    <Card
      label="Rooms in Use"
      icon={DoorOpen}
      value={failed ? "—" : stats ? `${stats.rooms_in_use} / ${stats.total_halls}` : LOADING}
      hint={failed ? "Unavailable" : stats ? (stats.rooms_in_use ? "Playing now" : "All rooms free") : "Loading…"}
      footLabel="Free right now"
      footValue={failed ? "—" : stats ? plural(free, "room") : LOADING}
    />
  );
}

/** Bookings set to play today and when the next one starts. */
export function BookedTodayStat() {
  const { stats, failed } = useRoomStats();

  return (
    <Card
      label="Booked for Today"
      icon={CalendarClock}
      value={failed ? "—" : stats ? String(stats.bookings_today) : LOADING}
      hint={failed ? "Unavailable" : stats ? `in ${plural(stats.rooms_booked_today, "room")}` : "Loading…"}
      footLabel="Next start"
      footValue={
        failed ? "—" : stats ? (stats.next_booking_start ? formatClock(stats.next_booking_start) : "None left today") : LOADING
      }
    />
  );
}
