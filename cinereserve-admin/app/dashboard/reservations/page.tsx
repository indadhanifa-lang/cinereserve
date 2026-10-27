"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Eye, Loader2, RefreshCw, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_STATES } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

type ReservedSeat = {
  id: number;
  label: string | null;
  price: string;
  status: string;
};

type PaymentInfo = {
  method: string;
  status: string;
  amount: string;
} | null;

type Reservation = {
  id: number;
  reservation_code: string;
  subtotal: string;
  discount_amount: string;
  total_amount: string;
  status: string;
  reserved_at: string;
  expires_at: string | null;
  customer: { id: number; name: string; email: string } | null;
  movie: { id: number; title: string } | null;
  schedule: { show_date: string; start_time: string; end_time: string } | null;
  screen: { name: string | null } | null;
  branch: { id: number | null; name: string | null } | null;
  seats: ReservedSeat[];
  payment: PaymentInfo;
};

type StatusFilter = "" | "pending" | "confirmed" | "cancelled" | "completed" | "expired";
type DateFilter = "" | "today" | "upcoming";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
];

/** Only the five statuses the backend can hold; unknown values fall back
 * to a neutral badge instead of inventing a new label. */
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400",
  confirmed: "bg-emerald-400/10 text-emerald-400",
  cancelled: "bg-red-400/10 text-red-400",
  completed: "bg-sky-400/10 text-sky-400",
  expired: "bg-muted text-muted-foreground",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-09-30" → "Sep 30, 2026" */
const formatDate = (value: string): string => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
};

/** "18:00:00" or "18:00" → "6:00 PM" */
const formatTime = (value: string): string => {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = minuteRaw ?? "00";
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${suffix}`;
};

/** "2026-09-27 18:00:00" → "Sep 27, 2026 6:00 PM" */
const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const [datePart, timePart] = value.split(" ");
  if (!datePart) return value;
  return timePart ? `${formatDate(datePart)} ${formatTime(timePart)}` : formatDate(datePart);
};

/** 250 or "250.00" → "₱250.00" */
const formatPrice = (value: string | number): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

/** Today's LOCAL date as YYYY-MM-DD for direct string comparison with
 * show_date. Never new Date(show_date): UTC parsing can shift the day. */
const localTodayString = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const seatLabels = (seats: ReservedSeat[]): string =>
  seats.map((seat) => seat.label ?? "—").join(", ");

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    <span className="break-words text-right text-sm text-foreground">{value}</span>
  </div>
);

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("");
  const [selected, setSelected] = useState<Reservation | null>(null);

  const loadReservations = () => {
    setLoadError(null);
    fetch("/api/admin/reservations")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.message ?? "Unable to load reservations. Try again."
          );
        }
        setReservations(data.reservations ?? []);
      })
      .catch((err: Error) => {
        const message = err.message || "Unable to load reservations. Try again.";
        setLoadError(message);
        toast.error(message);
      });
  };

  useEffect(loadReservations, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  /** Client-side filtering: status + date first, then search over the
   * reservation code, customer name/email, and movie title. */
  const visibleReservations = useMemo(() => {
    const rows = reservations ?? [];
    const query = search.trim().toLowerCase();
    const today = localTodayString();

    return rows.filter((reservation) => {
      if (statusFilter && reservation.status !== statusFilter) return false;

      if (dateFilter) {
        const showDate = reservation.schedule?.show_date;
        if (!showDate) return false;
        if (dateFilter === "today" && showDate !== today) return false;
        if (dateFilter === "upcoming" && !(showDate > today)) return false;
      }

      if (!query) return true;
      return (
        reservation.reservation_code.toLowerCase().includes(query) ||
        (reservation.customer?.name ?? "").toLowerCase().includes(query) ||
        (reservation.customer?.email ?? "").toLowerCase().includes(query) ||
        (reservation.movie?.title ?? "").toLowerCase().includes(query)
      );
    });
  }, [reservations, search, statusFilter, dateFilter]);

  const selectClass =
    "h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const modal = selected ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setSelected(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="admin-modal-scroll max-h-[85vh] w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="reservation-detail-title"
              className="text-base font-semibold text-foreground"
            >
              {selected.reservation_code}
            </h2>
            <span className="text-xs text-muted-foreground">Reservation Details</span>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col divide-y divide-border/20">
          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Reservation
            </p>
            <DetailRow label="Code" value={selected.reservation_code} />
            <DetailRow
              label="Status"
              value={
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                    STATUS_BADGE[selected.status] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {selected.status}
                </span>
              }
            />
            <DetailRow label="Reserved At" value={formatDateTime(selected.reserved_at)} />
            <DetailRow label="Expires At" value={formatDateTime(selected.expires_at)} />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Customer
            </p>
            <DetailRow label="Name" value={selected.customer?.name ?? "—"} />
            <DetailRow label="Email" value={selected.customer?.email ?? "—"} />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Showtime
            </p>
            <DetailRow label="Movie" value={selected.movie?.title ?? "—"} />
            <DetailRow label="Branch" value={selected.branch?.name ?? "—"} />
            <DetailRow label="Screen" value={selected.screen?.name ?? "—"} />
            <DetailRow
              label="Show Date"
              value={selected.schedule ? formatDate(selected.schedule.show_date) : "—"}
            />
            <DetailRow
              label="Show Time"
              value={
                selected.schedule
                  ? `${formatTime(selected.schedule.start_time)} – ${formatTime(selected.schedule.end_time)}`
                  : "—"
              }
            />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Reserved Seats
            </p>
            {selected.seats.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {selected.seats.map((seat) => (
                  <span
                    key={seat.id}
                    className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                  >
                    {seat.label ?? "—"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="py-1 text-sm text-muted-foreground">—</p>
            )}
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Payment Summary
            </p>
            <DetailRow label="Subtotal" value={formatPrice(selected.subtotal)} />
            <DetailRow label="Discount" value={formatPrice(selected.discount_amount)} />
            <DetailRow
              label="Total"
              value={
                <span className="font-semibold">{formatPrice(selected.total_amount)}</span>
              }
            />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Payment
            </p>
            <DetailRow
              label="Method"
              value={selected.payment ? selected.payment.method : "—"}
            />
            <DetailRow
              label="Payment Status"
              value={
                selected.payment ? (
                  <span className="capitalize">{selected.payment.status}</span>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="Amount"
              value={selected.payment ? formatPrice(selected.payment.amount) : "—"}
            />
          </section>
        </div>
      </div>
    </div>
  ) : null;

  if (reservations === null && loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/30 bg-card p-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{loadError}</p>
        <Button type="button" onClick={loadReservations} className="h-10 gap-2 rounded-full px-4">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (reservations === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading reservations…</span>
      </div>
    );
  }

  if (reservations.length === 0) {
    return <EmptyState {...EMPTY_STATES.reservations} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {modal}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search code, customer, or movie…"
            className="h-11 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search reservations"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="reservations-status" className="text-xs">
            Status
          </Label>
          <select
            id="reservations-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={selectClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="reservations-date" className="text-xs">
            Date
          </Label>
          <select
            id="reservations-date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className={selectClass}
          >
            {DATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visibleReservations.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card p-8 text-center text-sm text-muted-foreground">
          No reservations match your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Reservation</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Movie</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">Seats</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {visibleReservations.map((reservation) => (
                <tr key={reservation.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                    {reservation.reservation_code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-foreground">
                      {reservation.customer?.name ?? "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {reservation.customer?.email ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {reservation.movie?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {reservation.schedule
                      ? `${formatDate(reservation.schedule.show_date)} • ${formatTime(reservation.schedule.start_time)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {seatLabels(reservation.seats) || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPrice(reservation.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {reservation.payment ? (
                      <span className="capitalize">
                        {reservation.payment.method} • {reservation.payment.status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                        STATUS_BADGE[reservation.status] ??
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {reservation.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(reservation)}
                      aria-label={`View reservation ${reservation.reservation_code}`}
                      title="View reservation"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-accent"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
