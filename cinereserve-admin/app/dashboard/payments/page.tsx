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
import { useUrlSearch } from "@/lib/use-url-search";

type Payment = {
  id: number;
  payment_reference: string | null;
  payment_method: string;
  amount: string;
  status: string;
  paid_at: string | null;
  created_at: string | null;
  reservation: { id: number; reservation_code: string; status: string } | null;
  customer: { id: number; name: string; email: string } | null;
  movie: { id: number; title: string } | null;
  schedule: { show_date: string; start_time: string } | null;
  screen: { name: string | null } | null;
  branch: { id: number | null; name: string | null } | null;
};

type StatusFilter = "" | "pending" | "paid" | "failed" | "refunded";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

/** Only the existing payment statuses; unknown values fall back to a
 * neutral badge instead of inventing a new label. */
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400",
  paid: "bg-emerald-400/10 text-emerald-400",
  failed: "bg-red-400/10 text-red-400",
  refunded: "bg-violet-400/10 text-violet-400",
};

/** Known method labels; anything else passes through untouched so
 * methods outside gcash/card/mock still display correctly. */
const METHOD_LABELS: Record<string, string> = {
  gcash: "GCash",
  card: "Card",
  mock: "Mock",
};

const formatMethod = (method: string): string =>
  METHOD_LABELS[method.toLowerCase()] ?? method;

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

/** "2026-09-27 10:05:00" → "Sep 27, 2026 10:05 AM" */
const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const [datePart, timePart] = value.split(" ");
  if (!datePart) return value;
  return timePart ? `${formatDate(datePart)} ${formatTime(timePart)}` : formatDate(datePart);
};

/** "2026-09-27 10:05:00" → "Sep 27, 2026" */
const formatDay = (value: string | null): string => {
  if (!value) return "—";
  return formatDate(value.split(" ")[0]);
};

/** 250 or "250.00" → "₱250.00" */
const formatPrice = (value: string | number): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    <span className="break-words text-right text-sm text-foreground">{value}</span>
  </div>
);

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useUrlSearch();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [methodFilter, setMethodFilter] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);

  const loadPayments = () => {
    fetch("/api/admin/payments")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.message ?? "Unable to load payments. Try again."
          );
        }
        setPayments(data.payments ?? []);
      })
      .catch((err: Error) => {
        const message = err.message || "Unable to load payments. Try again.";
        setLoadError(message);
        toast.error(message);
      });
  };

  useEffect(loadPayments, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  /** Method options derived from the loaded records so unknown methods
   * appear automatically; "All Methods" always first. */
  const methodOptions = useMemo(() => {
    const methods = new Set<string>();
    for (const payment of payments ?? []) {
      if (payment.payment_method) methods.add(payment.payment_method);
    }
    return Array.from(methods).sort();
  }, [payments]);

  /** Client-side filtering: status + method first, then case-insensitive
   * search over reference, reservation code, customer name/email, and
   * movie title. payment_reference may be null — handled safely. */
  const visiblePayments = useMemo(() => {
    const rows = payments ?? [];
    const query = search.trim().toLowerCase();

    return rows.filter((payment) => {
      if (statusFilter && payment.status !== statusFilter) return false;
      if (methodFilter && payment.payment_method !== methodFilter) return false;
      if (!query) return true;
      return (
        (payment.payment_reference ?? "").toLowerCase().includes(query) ||
        (payment.reservation?.reservation_code ?? "").toLowerCase().includes(query) ||
        (payment.customer?.name ?? "").toLowerCase().includes(query) ||
        (payment.customer?.email ?? "").toLowerCase().includes(query) ||
        (payment.movie?.title ?? "").toLowerCase().includes(query)
      );
    });
  }, [payments, search, statusFilter, methodFilter]);

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
        aria-labelledby="payment-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="admin-modal-scroll max-h-[85vh] w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="payment-detail-title"
              className="break-words text-base font-semibold text-foreground"
            >
              {selected.payment_reference ?? "—"}
            </h2>
            <span className="text-xs text-muted-foreground">Payment Details</span>
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
                Payment
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
            <DetailRow label="Payment Reference" value={selected.payment_reference ?? "—"} />
            <DetailRow label="Payment Method" value={formatMethod(selected.payment_method)} />
            <DetailRow
              label="Payment Status"
              value={<span className="capitalize">{selected.status}</span>}
            />
            <DetailRow label="Amount" value={<span className="font-semibold">{formatPrice(selected.amount)}</span>} />
            <DetailRow label="Paid At" value={formatDateTime(selected.paid_at)} />
            <DetailRow label="Created At" value={formatDateTime(selected.created_at)} />
          </section>

          <section className="py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Reservation
            </p>
            <DetailRow
              label="Reservation Code"
              value={selected.reservation?.reservation_code ?? "—"}
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
              label="Show Time"
              value={selected.schedule ? formatTime(selected.schedule.start_time) : "—"}
            />
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

  if (payments === null && loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/30 bg-card p-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{loadError}</p>
        <Button type="button" onClick={() => {
          setLoadError(null);
          loadPayments();
        }} className="h-10 gap-2 rounded-full px-4">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (payments === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading payments…</span>
      </div>
    );
  }

  if (payments.length === 0) {
    return <EmptyState {...EMPTY_STATES.payments} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {modal}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search reference, reservation, customer, or movie…"
            className="h-11 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search payments"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="payments-status" className="text-xs">
            Status
          </Label>
          <select
            id="payments-status"
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
          <Label htmlFor="payments-method" className="text-xs">
            Method
          </Label>
          <select
            id="payments-method"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All Methods</option>
            {methodOptions.map((method) => (
              <option key={method} value={method}>
                {formatMethod(method)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visiblePayments.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card p-8 text-center text-sm text-muted-foreground">
          No payments match your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Reservation</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Paid At</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {visiblePayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                    {payment.payment_reference ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-foreground">
                      {payment.customer?.name ?? "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {payment.customer?.email ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {payment.reservation?.reservation_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatMethod(payment.payment_method)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPrice(payment.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                        STATUS_BADGE[payment.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDay(payment.paid_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(payment)}
                      aria-label={`View payment ${payment.payment_reference ?? payment.id}`}
                      title="View payment"
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
