"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EMPTY_STATES } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

type Analytics = {
  from: string;
  to: string;
  total_bookings: number;
  /** weekday: 1 = Monday ... 7 = Sunday; hour: show start, 0-23. */
  heatmap: { weekday: number; hour: number; bookings: number }[];
  forecast: { date: string; expected_bookings: number; expected_revenue: string; booked: number; showings: number }[];
  movies: {
    title: string;
    bookings: number;
    revenue: string;
    showings: number;
    bookings_per_showing: number | null;
    /** % change, last 4 weeks vs the 4 before; null for new titles. */
    trend: number | null;
  }[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const peso = (amount: string | number) =>
  `₱${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** 19 → "7 PM" */
const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const chartConfig = {
  expected_bookings: { label: "Expected", theme: { light: "#c4b5fd", dark: "#5b4a8a" } },
  booked: { label: "Booked so far", theme: { light: "#7c3aed", dark: "#a78bfa" } },
} satisfies ChartConfig;

function Panel({ title, description, action, className, children }: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/30 bg-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Recommendations() {
  const [insights, setInsights] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-analytics/insights", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Unable to get recommendations. Try again.");
      setInsights(data.insights);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel
      title="AI recommendations"
      description="Gemini reads the numbers on this page (no customer details) and suggests what to change this week."
      action={
        <Button onClick={generate} disabled={loading} className="h-9">
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {insights ? "Regenerate" : "Generate"}
        </Button>
      }
    >
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {insights ? (
        <ol className="flex flex-col gap-3 text-sm" aria-live="polite">
          {insights.map((insight, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-muted/50 p-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-foreground">{insight}</span>
            </li>
          ))}
        </ol>
      ) : (
        !error && (
          <p className="text-sm text-muted-foreground">
            {loading ? "Analyzing your bookings…" : "Generate to get showtime, programming and promo suggestions."}
          </p>
        )
      )}
    </Panel>
  );
}

function Forecast({ forecast }: { forecast: Analytics["forecast"] }) {
  const expectedRevenue = forecast.reduce((sum, day) => sum + Number(day.expected_revenue), 0);
  const unscheduled = forecast.filter((day) => day.expected_bookings >= 1 && day.showings === 0);

  return (
    <Panel
      title="Next 7 days"
      description={`Expected from the same weekday over the last 8 weeks · about ${peso(expectedRevenue)} in sales`}
      className="lg:col-span-2"
    >
      <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
        <BarChart accessibilityLayer data={forecast} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(date: string) => dayLabel(date).split(",")[0]} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} allowDecimals={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_label, payload) => {
                  const day = payload?.[0]?.payload as Analytics["forecast"][number] | undefined;
                  return day ? `${dayLabel(day.date)} · ${day.showings} ${day.showings === 1 ? "show" : "shows"}` : "";
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="expected_bookings" fill="var(--color-expected_bookings)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="booked" fill="var(--color-booked)" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ChartContainer>
      {unscheduled.length > 0 && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          No shows scheduled on {unscheduled.map((day) => dayLabel(day.date)).join(", ")}, usually a day with bookings.
        </p>
      )}
    </Panel>
  );
}

function Heatmap({ heatmap }: { heatmap: Analytics["heatmap"] }) {
  const hours = heatmap.map((cell) => cell.hour);
  const range = Array.from({ length: Math.max(...hours) - Math.min(...hours) + 1 }, (_, i) => Math.min(...hours) + i);
  const counts = new Map(heatmap.map((cell) => [`${cell.weekday}-${cell.hour}`, cell.bookings]));
  const max = Math.max(...heatmap.map((cell) => cell.bookings));
  const peak = heatmap.reduce((best, cell) => (cell.bookings > best.bookings ? cell : best));
  const byDay = WEEKDAYS.map((_, i) => heatmap.filter((cell) => cell.weekday === i + 1).reduce((sum, cell) => sum + cell.bookings, 0));
  const slowest = byDay.indexOf(Math.min(...byDay));

  return (
    <Panel title="When people watch" description="Confirmed bookings by show day and start time.">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th />
              {range.map((hour) => (
                <th key={hour} scope="col" className="font-normal whitespace-nowrap text-muted-foreground">
                  {hourLabel(hour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((day, i) => (
              <tr key={day}>
                <th scope="row" className="pr-2 text-left font-normal text-muted-foreground">
                  {day}
                </th>
                {range.map((hour) => {
                  const bookings = counts.get(`${i + 1}-${hour}`) ?? 0;
                  return (
                    <td
                      key={hour}
                      title={`${day} ${hourLabel(hour)}: ${bookings} bookings`}
                      aria-label={`${day} ${hourLabel(hour)}: ${bookings} bookings`}
                      className={cn("h-7 min-w-7 rounded-md", bookings ? "bg-primary" : "bg-muted/60")}
                      style={bookings ? { opacity: 0.25 + 0.75 * (bookings / max) } : undefined}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Busiest slot
          </dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {WEEKDAYS[peak.weekday - 1]} {hourLabel(peak.hour)} · {peak.bookings} bookings
          </dd>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Slowest day
          </dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {WEEKDAYS[slowest]} · {byDay[slowest]} bookings
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

function MoviePerformance({ movies }: { movies: Analytics["movies"] }) {
  return (
    <Panel title="Movie performance" description="Trend compares the last 4 weeks with the 4 before.">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Movie</th>
              <th className="py-2 text-right font-medium">Bookings</th>
              <th className="py-2 text-right font-medium">Per show</th>
              <th className="py-2 text-right font-medium">Revenue</th>
              <th className="py-2 text-right font-medium">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {movies.map((movie) => (
              <tr key={movie.title}>
                <td className="max-w-48 truncate py-2 font-medium text-foreground">{movie.title}</td>
                <td className="py-2 text-right">{movie.bookings}</td>
                <td className="py-2 text-right text-muted-foreground">{movie.bookings_per_showing ?? "—"}</td>
                <td className="py-2 text-right">{peso(movie.revenue)}</td>
                <td
                  className={cn(
                    "py-2 text-right font-medium",
                    movie.trend === null
                      ? "text-muted-foreground"
                      : movie.trend >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {movie.trend === null ? "New" : `${movie.trend > 0 ? "+" : ""}${movie.trend}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function AiAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-analytics")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? "Unable to load analytics. Try again.");
        setAnalytics(data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!analytics) {
    return (
      <div aria-busy="true" className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading analytics…</span>
      </div>
    );
  }

  if (analytics.total_bookings === 0) return <EmptyState {...EMPTY_STATES["ai-analytics"]} />;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">
        Based on {analytics.total_bookings.toLocaleString("en-US")} confirmed bookings for shows from {longDate(analytics.from)} to{" "}
        {longDate(analytics.to)}.
      </p>
      <div className="grid gap-6 lg:grid-cols-3">
        <Forecast forecast={analytics.forecast} />
        <Recommendations />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Heatmap heatmap={analytics.heatmap} />
        <MoviePerformance movies={analytics.movies} />
      </div>
    </div>
  );
}
