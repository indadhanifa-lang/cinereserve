"use client";

import { useEffect, useState } from "react";
import { OverviewCharts } from "@/components/dashboard/overview-charts";
import { LOADING } from "@/components/dashboard/loading-value";
import { CountUp, pesoCount } from "@/components/dashboard/count-up";
import { cn, ENTER, enterDelay } from "@/lib/utils";

type Transaction = {
  id: number;
  payment_reference: string;
  payment_method: string;
  amount: string;
  paid_at: string | null;
  reservation_code: string;
  booking_type: "seat" | "room";
  customer_name: string;
};

type Totals = {
  total_bookings: number;
  total_revenue: string;
  pending_reservations: number;
  confirmed_reservations: number;
  upcoming_schedules: number;
  recent_transactions: Transaction[];
};

const peso = (amount: string | number) =>
  `₱${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** All-time business figures and the latest paid transactions. */
export function BusinessTotals() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard/overview")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);
        setTotals(data);
      })
      .catch(() => setFailed(true));
  }, []);

  const show = (value: number | undefined, format?: (n: number) => string) =>
    failed ? "—" : value === undefined ? LOADING : <CountUp value={value} format={format} />;

  const cards = [
    { label: "Total bookings", value: show(totals?.total_bookings) },
    { label: "Total revenue", value: show(totals ? Number(totals.total_revenue) : undefined, pesoCount) },
    { label: "Pending reservations", value: show(totals?.pending_reservations) },
    { label: "Confirmed reservations", value: show(totals?.confirmed_reservations) },
    { label: "Upcoming schedules", value: show(totals?.upcoming_schedules) },
  ];

  return (
    <div className="mb-6 flex w-full flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card, index) => (
          <div
            key={card.label}
            style={enterDelay(320 + index * 60)}
            className={cn(
              ENTER,
              "rounded-xl border border-border/30 bg-card p-4 shadow-sm transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            )}
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div style={enterDelay(620)} className={ENTER}>
        <OverviewCharts />
      </div>

      <div style={enterDelay(720)} className={cn(ENTER, "overflow-x-auto rounded-2xl border border-border/30 bg-card")}>
        <div className="border-b border-border/30 px-4 py-3 text-sm font-semibold">Recent transactions</div>
        {totals && totals.recent_transactions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No paid bookings yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Reference</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Booking</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {(totals?.recent_transactions ?? []).map((tx) => (
                <tr key={tx.id} className="animate-in transition-colors duration-300 fade-in-0 hover:bg-accent/40 motion-reduce:animate-none">
                  <td className="px-4 py-2 font-medium">{tx.payment_reference}</td>
                  <td className="px-4 py-2 text-muted-foreground">{tx.customer_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {tx.reservation_code} · {tx.booking_type === "room" ? "Whole room" : "Seats"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground uppercase">{tx.payment_method}</td>
                  <td className="px-4 py-2">{peso(tx.amount)}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {tx.paid_at ? new Date(tx.paid_at.replace(" ", "T") + "Z").toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
