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

type Ticket = {
  id: number;
  ticket_code: string;
  status: string;
  checked_in_at: string | null;
  created_at: string | null;
  reservation: {
    id: number;
    reservation_code: string;
    status: string;
    total_amount: string;
  } | null;
  customer: { id: number; name: string; email: string } | null;
  movie: { id: number; title: string } | null;
  schedule: { show_date: string; start_time: string; end_time: string } | null;
  screen: { name: string | null } | null;
  branch: { id: number | null; name: string | null } | null;
  seats: { label: string }[];
};

type StatusFilter = "" | "valid" | "used" | "cancelled" | "expired";
type DateFilter = "" | "today" | "upcoming";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "valid", label: "Valid" },
  { value: "used", label: "Used" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
];

/** Only the existing ticket statuses; unknown values fall back to a
 * neutral badge instead of inventing a new label. */
const STATUS_BADGE: Record<string, string> = {
  valid: "bg-emerald-400/10 text-emerald-400",
  used: "bg-sky-400/10 text-sky-400",
  cancelled: "bg-red-400/10 text-red-400",
  expired: "bg-muted text-muted-foreground",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-10-05" → "Oct 5, 2026" */
const formatDate = (value: string): string => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
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

/** "2026-09-27 10:10:00" → "Sep 27, 2026 10:10 AM" */
const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const [datePart, timePart] = value.split(" ");
  if (!datePart) return value;
  return timePart
    ? `${formatDate(datePart)} ${formatTime(timePart)}`
    : formatDate(datePart);
};

/** Today's LOCAL date as YYYY-MM-DD for direct string comparison with
 * show_date. Never new Date(show_date): UTC parsing can shift the day. */
const localTodayString = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    <span className="break-words text-right text-sm text-foreground">{value}</span>
  </div>
);

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("");
  const [selected, setSelected] = useState<Ticket | null>(null);

  const loadTickets = () => {
    setLoadError(null);
    fetch("/api/admin/tickets")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message ?? "Unable to load tickets. Try again.");
        }
        setTickets(data.tickets ?? []);
      })
      .catch((err: Error) => {
        const message = err.message || "Unable to load tickets. Try again.";
        setLoadError(message);
        toast.error(message);
      });
  };

  useEffect(loadTickets, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  /** Status + date filters first, then case-insensitive search over ticket
   * code, reservation code, customer name/email, movie title, and seat
   * labels. Date filter compares the raw YYYY-MM-DD show_date string
   * against a locally generated today string — no Date parsing. */
  const visibleTickets = useMemo(() => {
    const rows = tickets ?? [];
    const query = search.trim().toLowerCase();
    const today = dateFilter ? localTodayString() : "";

    return rows.filter((ticket) => {
      if (statusFilter && ticket.status !== statusFilter) return false;
      if (dateFilter) {
        const showDate = ticket.schedule?.show_date ?? "";
        if (dateFilter === "today" && showDate !== today) return false;
        if (dateFilter === "upcoming" && !(showDate > today)) return false;
      }
      if (!query) return true;
      return (
        ticket.ticket_code.toLowerCase().includes(query) ||
        (ticket.reservation?.reservation_code ?? "").toLowerCase().includes(query) ||
        (ticket.customer?.name ?? "").toLowerCase().includes(query) ||
        (ticket.customer?.email ?? "").toLowerCase().includes(query) ||
        (ticket.movie?.title ?? "").toLowerCase().includes(query) ||
        ticket.seats.some((seat) => seat.label.toLowerCase().includes(query))
      );
    });
  }, [tickets, search, statusFilter, dateFilter]);

  const selectClass =
    "h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const seatLabels = (ticket: Ticket): string =>
    ticket.seats.map((seat) => seat.label).join(", ");

  const modal = selected ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setSelected(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="admin-modal-scroll max-h-[85vh] w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="ticket-detail-title"
              className="break-words font-mono text-base font-semibold text-foreground"
            >
              {selected.ticket_code}
            </h2>
            <span className="text-xs text-muted-foreground">Ticket Details</span>
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
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Ticket
              </p>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                  STATUS_BADGE[selected.status] ?? "bg-muted text-muted-foreground"
                )}
              >
                {selected.status}
              </span>
            </div>
            <DetailRow label="Ticket Code" value={<span className="font-mono">{selected.ticket_code}</span>} />
            <DetailRow
              label="Ticket Status"
              value={<span className="capitalize">{selected.status}</span>}
            />
            <DetailRow label="Created At" value={formatDateTime(selected.created_at)} />
            <DetailRow label="Checked In At" value={formatDateTime(selected.checked_in_at)} />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Reservation
            </p>
            <DetailRow
              label="Reservation Code"
              value={<span className="font-mono">{selected.reservation?.reservation_code ?? "—"}</span>}
            />
            <DetailRow
              label="Reservation Status"
              value={
                selected.reservation ? (
                  <span className="capitalize">{selected.reservation.status}</span>
                ) : (
                  "—"
                )
              }
            />
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
              label="Start Time"
              value={selected.schedule ? formatTime(selected.schedule.start_time) : "—"}
            />
            <DetailRow
              label="End Time"
              value={selected.schedule ? formatTime(selected.schedule.end_time) : "—"}
            />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Seats
            </p>
            {selected.seats.length > 0 ? (
              <div className="flex flex-wrap gap-2 py-1">
                {selected.seats.map((seat) => (
                  <span
                    key={seat.label}
                    className="inline-flex rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-foreground"
                  >
                    {seat.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="py-1.5 text-sm text-muted-foreground">—</p>
            )}
          </section>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => setSelected(null)}
            className="h-9 rounded-full px-4 text-sm"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  if (tickets === null && loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/30 bg-card p-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{loadError}</p>
        <Button type="button" onClick={loadTickets} className="h-10 gap-2 rounded-full px-4">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (tickets === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading tickets…</span>
      </div>
    );
  }

  if (tickets.length === 0) {
    return <EmptyState {...EMPTY_STATES.tickets} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {modal}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search ticket, reservation, customer, movie, or seat…"
            className="h-11 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tickets"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="tickets-status" className="text-xs">
            Status
          </Label>
          <select
            id="tickets-status"
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
          <Label htmlFor="tickets-date" className="text-xs">
            Date
          </Label>
          <select
            id="tickets-date"
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

      {visibleTickets.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card p-8 text-center text-sm text-muted-foreground">
          No tickets match your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Ticket</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Movie</th>
                <th className="px-4 py-3 font-medium">Showtime</th>
                <th className="px-4 py-3 font-medium">Seats</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Checked In</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {visibleTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                    {ticket.ticket_code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-foreground">
                      {ticket.customer?.name ?? "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {ticket.customer?.email ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ticket.movie?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ticket.schedule
                      ? `${formatDate(ticket.schedule.show_date)} • ${formatTime(ticket.schedule.start_time)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ticket.seats.length > 0 ? seatLabels(ticket) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                        STATUS_BADGE[ticket.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(ticket.checked_in_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(ticket)}
                      aria-label={`View ticket ${ticket.ticket_code}`}
                      title="View ticket"
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
