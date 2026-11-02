"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn, daysBetween, pesoTick, shortDate } from "@/lib/utils";

type Report = {
  from: string;
  to: string;
  revenue_by_day: { date: string; revenue: string; bookings: number }[];
  bookings_by_status: Record<string, number>;
};

const RANGES = [7, 30] as const;

const chartConfig = {
  revenue: { label: "Revenue", theme: { light: "#7c3aed", dark: "#a78bfa" } },
  confirmed: { label: "Confirmed", theme: { light: "#7c3aed", dark: "#a78bfa" } },
  pending: { label: "Pending", theme: { light: "#d97706", dark: "#fbbf24" } },
  cancelled: { label: "Cancelled", theme: { light: "#e11d48", dark: "#fb7185" } },
  expired: { label: "Expired", theme: { light: "#71717a", dark: "#71717a" } },
} satisfies ChartConfig;

const peso = (amount: string | number) =>
  `₱${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Panel({ title, description, action, className, children }: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/30 bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Daily revenue (7 or 30 days) and the last 30 days' bookings by status. */
export function OverviewCharts() {
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);

  useEffect(() => {
    // No range given, so the API answers with the last 30 Manila days.
    fetch("/api/admin/reports")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);
        setReport(data);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!report) {
    return (
      <div className="flex h-80 items-center justify-center gap-2 rounded-2xl border border-border/30 bg-card text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading charts…</span>
      </div>
    );
  }

  const byDate = new Map(report.revenue_by_day.map((day) => [day.date, day]));
  const revenue = daysBetween(report.from, report.to)
    .slice(-days)
    .map((date) => ({
      date,
      revenue: Number(byDate.get(date)?.revenue ?? 0),
      bookings: byDate.get(date)?.bookings ?? 0,
    }));
  const rangeTotal = revenue.reduce((sum, day) => sum + day.revenue, 0);

  const statuses = Object.entries(report.bookings_by_status)
    .filter(([, total]) => total > 0)
    .map(([status, total]) => ({ status, total, fill: `var(--color-${status in chartConfig ? status : "expired"})` }));
  const bookings = statuses.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        title="Revenue"
        description={`${peso(rangeTotal)} in the last ${days} days`}
        className="lg:col-span-2"
        action={
          <div role="group" aria-label="Revenue range" className="flex gap-1 rounded-lg bg-muted/60 p-1">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={range === days}
                onClick={() => setDays(range)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  range === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range}d
              </button>
            ))}
          </div>
        }
      >
        <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
          <AreaChart accessibilityLayer data={revenue} margin={{ left: 4, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="overview-revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDate} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={pesoTick} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => shortDate(String(label))}
                  formatter={(value, _name, item) => (
                    <div className="flex w-full flex-col gap-0.5">
                      <span className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-mono font-medium text-foreground">{peso(Number(value))}</span>
                      </span>
                      <span className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Paid bookings</span>
                        <span className="font-mono font-medium text-foreground">{item.payload.bookings}</span>
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="revenue"
              type="monotone"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              fill="url(#overview-revenue-fill)"
            />
          </AreaChart>
        </ChartContainer>
      </Panel>

      <Panel title="Bookings by status" description="Last 30 days">
        {bookings === 0 ? (
          <p className="flex h-60 items-center justify-center text-sm text-muted-foreground">No bookings in the last 30 days.</p>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-auto h-60 w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
              <Pie data={statuses} dataKey="total" nameKey="status" innerRadius={52} strokeWidth={4} stroke="var(--card)">
                <Label
                  content={({ viewBox }) =>
                    viewBox && "cx" in viewBox && "cy" in viewBox ? (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                          {bookings.toLocaleString("en-US")}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                          bookings
                        </tspan>
                      </text>
                    ) : null
                  }
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </Panel>
    </div>
  );
}
