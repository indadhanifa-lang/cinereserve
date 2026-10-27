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

type CustomerReservation = {
  id: number;
  reservation_code: string;
  movie: string | null;
  show_date: string | null;
  start_time: string | null;
  screen: string | null;
  total_amount: string;
  status: string;
};

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  reservation_count: number;
  last_reservation_at: string | null;
  reservations: CustomerReservation[];
};

type StatusFilter = "" | "active" | "inactive";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/** Account status only — no invented tiers. */
const ACCOUNT_BADGE: Record<string, string> = {
  active: "bg-emerald-400/10 text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
};

/** Reservation statuses reuse the Reservations page palette; unknown
 * values fall back to a neutral badge instead of a new label. */
const RESERVATION_BADGE: Record<string, string> = {
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

/** "2026-09-27 18:00:00" → "Sep 27, 2026" */
const formatDay = (value: string | null): string => {
  if (!value) return "—";
  return formatDate(value.split(" ")[0]);
};

/** 250 or "250.00" → "₱250.00" */
const formatPrice = (value: string | number): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

/** "Hanifa Indad" → "HI"; "Stephen Plaza" → "SP" */
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
};

/** Avatar or generated initials. avatar_url stays a relative /storage
 * path resolved by the existing rewrite; a broken image falls back to
 * initials so nothing ever renders as a broken thumbnail. */
function CustomerAvatar({
  customer,
  className,
}: {
  customer: Pick<Customer, "name" | "avatar_url">;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (customer.avatar_url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customer.avatar_url}
        alt=""
        onError={() => setFailed(true)}
        className={cn(className, "shrink-0 rounded-full object-cover")}
      />
    );
  }

  return (
    <div
      className={cn(
        className,
        "flex shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-secondary-foreground"
      )}
    >
      {getInitials(customer.name)}
    </div>
  );
}

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    <span className="break-words text-right text-sm text-foreground">{value}</span>
  </div>
);

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [selected, setSelected] = useState<Customer | null>(null);

  const loadCustomers = () => {
    setLoadError(null);
    fetch("/api/admin/customers")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.message ?? "Unable to load customers. Try again."
          );
        }
        setCustomers(data.customers ?? []);
      })
      .catch((err: Error) => {
        const message = err.message || "Unable to load customers. Try again.";
        setLoadError(message);
        toast.error(message);
      });
  };

  useEffect(loadCustomers, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  /** Client-side filtering: status first, then case-insensitive search
   * over customer name, email, and phone. */
  const visibleCustomers = useMemo(() => {
    const rows = customers ?? [];
    const query = search.trim().toLowerCase();

    return rows.filter((customer) => {
      if (statusFilter && customer.status !== statusFilter) return false;
      if (!query) return true;
      return (
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        (customer.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [customers, search, statusFilter]);

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
        aria-labelledby="customer-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="admin-modal-scroll max-h-[85vh] w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CustomerAvatar customer={selected} className="h-10 w-10" />
            <div className="min-w-0">
              <h2
                id="customer-detail-title"
                className="truncate text-base font-semibold text-foreground"
              >
                {selected.name}
              </h2>
              <span className="text-xs text-muted-foreground">Customer Details</span>
            </div>
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
              Customer
            </p>
            <DetailRow label="Name" value={selected.name} />
            <DetailRow label="Email" value={selected.email} />
            <DetailRow label="Phone" value={selected.phone ?? "—"} />
            <DetailRow
              label="Account Status"
              value={
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                    ACCOUNT_BADGE[selected.status] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {selected.status}
                </span>
              }
            />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Branch Activity
            </p>
            <DetailRow
              label="Reservations at this branch"
              value={`${selected.reservation_count} Reservation${selected.reservation_count === 1 ? "" : "s"}`}
            />
            <DetailRow label="Last Reservation" value={formatDay(selected.last_reservation_at)} />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Reservation History
            </p>
            {selected.reservations.length > 0 ? (
              <div className="flex flex-col gap-3 pt-1">
                {selected.reservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="rounded-xl border border-border/30 bg-background/40 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {reservation.reservation_code}
                      </span>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                          RESERVATION_BADGE[reservation.status] ??
                            "bg-muted text-muted-foreground"
                        )}
                      >
                        {reservation.status}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {reservation.movie ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reservation.screen ?? "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">
                          {reservation.show_date ? formatDate(reservation.show_date) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reservation.start_time ? formatTime(reservation.start_time) : "—"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatPrice(reservation.total_amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-1 text-sm text-muted-foreground">—</p>
            )}
          </section>
        </div>
      </div>
    </div>
  ) : null;

  if (customers === null && loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/30 bg-card p-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{loadError}</p>
        <Button type="button" onClick={loadCustomers} className="h-10 gap-2 rounded-full px-4">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (customers === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading customers…</span>
      </div>
    );
  }

  if (customers.length === 0) {
    return <EmptyState {...EMPTY_STATES.customers} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {modal}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search name, email, or phone…"
            className="h-11 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search customers"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="customers-status" className="text-xs">
            Status
          </Label>
          <select
            id="customers-status"
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
      </div>

      {visibleCustomers.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card p-8 text-center text-sm text-muted-foreground">
          No customers match your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Reservations</th>
                <th className="px-4 py-3 font-medium">Last Booking</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {visibleCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CustomerAvatar customer={customer} className="h-9 w-9 text-xs" />
                      <span className="font-semibold text-foreground">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-muted-foreground">{customer.email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {customer.phone ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {customer.reservation_count} Reservation
                    {customer.reservation_count === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDay(customer.last_reservation_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                        ACCOUNT_BADGE[customer.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(customer)}
                      aria-label={`View customer ${customer.name}`}
                      title="View customer"
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
