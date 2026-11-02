"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_STATES } from "@/lib/dashboard-nav";
import { cn, daysBetween, pesoTick, shortDate } from "@/lib/utils";

type Report = {
  from: string;
  to: string;
  revenue_by_day: { date: string; revenue: string; bookings: number }[];
  /** Always the last 12 months, oldest first; the last one is the current month. */
  revenue_by_month: { month: string; revenue: string; bookings: number }[];
  bookings_by_status: Record<string, number>;
  top_movies: { title: string; bookings: number; revenue: string }[];
};

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

// Months from the first sale onward (earlier empty months are before the
// branch started selling), plus the best and slowest of them.
function monthlySales(report: Report) {
  const first = report.revenue_by_month.findIndex((month) => month.bookings > 0);
  const months = first === -1 ? [] : report.revenue_by_month.slice(first).map((month) => ({ ...month, revenue: Number(month.revenue) }));
  const ranked = [...months].sort((a, b) => b.revenue - a.revenue);
  return {
    months,
    best: ranked.at(0),
    slowest: ranked.length > 1 ? ranked.at(-1) : undefined,
    current: report.revenue_by_month.at(-1)?.month,
  };
}

const peso = (amount: string | number) =>
  `₱${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// Real .xlsx (not CSV) so Excel keeps column widths, bold headers, and peso/date formats.
async function downloadExcel(report: Report) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Report");
  sheet.columns = [{ width: 34 }, { width: 16 }, { width: 18 }];
  const PESO = '"₱"#,##0.00';
  const DATE = "mmm d, yyyy";

  const revenue = report.revenue_by_day.reduce((sum, day) => sum + Number(day.revenue), 0);
  const paid = report.revenue_by_day.reduce((sum, day) => sum + day.bookings, 0);

  sheet.addRow(["Reports & Analytics"]).font = { bold: true, size: 14 };
  sheet.addRow([`${longDate(report.from)} – ${longDate(report.to)}`]).font = { color: { argb: "FF6B6475" } };

  const table = (title: string, headers: string[], rows: (string | number | Date)[][], formats: string[], total?: (string | number)[]) => {
    sheet.addRow([]);
    sheet.addRow([title]).font = { bold: true, size: 12 };
    const head = sheet.addRow(headers);
    head.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: "FF1B1B1F" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE0FF" } };
      if (col > 1) cell.alignment = { horizontal: "right" };
    });
    if (rows.length === 0) sheet.addRow(["No data in this range"]).font = { italic: true, color: { argb: "FF6B6475" } };
    for (const values of total ? [...rows, total] : rows) {
      const row = sheet.addRow(values);
      formats.forEach((format, i) => {
        if (format) row.getCell(i + 1).numFmt = format;
      });
    }
    if (total) {
      const row = sheet.lastRow!;
      row.font = { bold: true };
      row.eachCell((cell) => (cell.border = { top: { style: "thin" } }));
    }
  };

  table(
    "Summary",
    ["Metric", "", "Value"],
    [
      ["Revenue", "", revenue],
      ["Paid bookings", "", paid],
      ["Avg. per booking", "", paid ? revenue / paid : 0],
      ["Confirmed reservations", "", report.bookings_by_status.confirmed ?? 0],
    ],
    [],
  );
  // Peso format only on the money rows of the summary (Revenue, Avg. per booking).
  sheet.getRow(sheet.rowCount - 3).getCell(3).numFmt = PESO;
  sheet.getRow(sheet.rowCount - 1).getCell(3).numFmt = PESO;

  table(
    "Revenue per day",
    ["Payment date", "Paid bookings", "Revenue"],
    report.revenue_by_day.map((day) => [new Date(`${day.date}T00:00:00Z`), day.bookings, Number(day.revenue)]),
    [DATE, "", PESO],
    ["Total", paid, revenue],
  );
  table(
    "Bookings by status",
    ["Status", "Bookings", ""],
    Object.entries(report.bookings_by_status).map(([status, total]) => [status.charAt(0).toUpperCase() + status.slice(1), total, ""]),
    [],
  );
  table(
    "Top movies",
    ["Movie", "Bookings", "Revenue"],
    report.top_movies.map((movie) => [movie.title, movie.bookings, Number(movie.revenue)]),
    ["", "", PESO],
  );
  const { months, best, slowest, current } = monthlySales(report);
  const mark = (month: string) =>
    `${monthLabel(month)}${month === current ? " (so far)" : ""}${month === best?.month ? " — best" : month === slowest?.month ? " — slowest" : ""}`;
  table(
    "Sales per month (last 12 months)",
    ["Month", "Paid bookings", "Revenue"],
    months.map((month) => [mark(month.month), month.bookings, month.revenue]),
    ["", "", PESO],
  );

  const blob = new Blob([await book.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: `report-${report.from}-to-${report.to}.xlsx` });
  link.click();
  URL.revokeObjectURL(url);
}

// Quick ranges, in the admin's local calendar ("en-CA" formats as YYYY-MM-DD).
const localDay = (date: Date) => date.toLocaleDateString("en-CA");
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDay(date);
};
const PRESETS = [
  { label: "7 days", range: () => ({ from: daysAgo(6), to: daysAgo(0) }) },
  { label: "30 days", range: () => ({ from: daysAgo(29), to: daysAgo(0) }) },
  { label: "90 days", range: () => ({ from: daysAgo(89), to: daysAgo(0) }) },
  { label: "This month", range: () => ({ from: localDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: daysAgo(0) }) },
  { label: "This year", range: () => ({ from: localDay(new Date(new Date().getFullYear(), 0, 1)), to: daysAgo(0) }) },
];

const BAR = "bg-violet-600 dark:bg-violet-400";

function Panel({ title, description, className, children }: { title: string; description?: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border/30 bg-card p-5", className)}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const chartConfig = {
  revenue: { label: "Revenue", theme: { light: "#7c3aed", dark: "#a78bfa" } },
  slowest: { label: "Slowest", theme: { light: "#d97706", dark: "#fbbf24" } },
} satisfies ChartConfig;

const revenueTooltip = (formatLabel: (label: string) => string) => (
  <ChartTooltip
    content={
      <ChartTooltipContent
        labelFormatter={(label) => formatLabel(String(label))}
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
);

function RevenueChart({ report }: { report: Report }) {
  const byDate = new Map(report.revenue_by_day.map((day) => [day.date, day]));
  const data = daysBetween(report.from, report.to).map((date) => ({
    date,
    revenue: Number(byDate.get(date)?.revenue ?? 0),
    bookings: byDate.get(date)?.bookings ?? 0,
  }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={shortDate} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={pesoTick} />
        {revenueTooltip(shortDate)}
        <Line dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

function MonthTile({
  icon: Icon,
  title,
  month,
  current,
  tone,
}: {
  icon: typeof TrendingUp;
  title: string;
  month: { month: string; revenue: number; bookings: number };
  current?: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone}`} />
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {monthLabel(month.month)}
        {month.month === current && <span className="ml-1 text-xs font-normal tracking-normal text-muted-foreground">(so far)</span>}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
        {peso(month.revenue)} · {month.bookings} paid bookings
      </p>
    </div>
  );
}

function MonthlySales({ report }: { report: Report }) {
  const { months, best, slowest, current } = monthlySales(report);
  if (!best) return null;

  return (
    <Panel title="Sales per month" description="Last 12 months, independent of the date range above.">
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full lg:col-span-2">
          <BarChart accessibilityLayer data={months} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(month: string) => monthLabel(month).split(" ")[0]}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={pesoTick} />
            {revenueTooltip(monthLabel)}
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {months.map((month) => (
                <Cell
                  key={month.month}
                  fill={month.month === slowest?.month ? "var(--color-slowest)" : "var(--color-revenue)"}
                  fillOpacity={month.month === best.month || month.month === slowest?.month ? 1 : 0.4}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <MonthTile icon={TrendingUp} title="Best month" month={best} current={current} tone="text-violet-600 dark:text-violet-400" />
          {slowest ? (
            <MonthTile icon={TrendingDown} title="Slowest month" month={slowest} current={current} tone="text-amber-600 dark:text-amber-400" />
          ) : (
            <p className="rounded-xl border border-dashed border-border/40 p-4 text-sm text-muted-foreground">
              The slowest month shows once there are two months of sales.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function BarList({ rows, ranked = false }: { rows: { label: string; value: number; display: string }[]; ranked?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing in this range.</p>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ol className="flex flex-col gap-3.5 text-sm">
      {rows.map((row, i) => (
        <li key={row.label} className="flex items-start gap-3">
          {ranked && <span className="w-4 pt-px text-xs font-medium text-muted-foreground tabular-nums">{i + 1}</span>}
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex justify-between gap-4">
              <span className="truncate font-medium text-foreground">{row.label}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{row.display}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className={`h-full rounded-full ${BAR}`} style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReportSkeleton() {
  return (
    <div aria-busy="true" className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Loading reports…</span>
    </div>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useState({ from: "", to: "" });
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(Object.entries(range).filter(([, value]) => value));
    fetch(`/api/admin/reports?${query}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? "Unable to load reports. Try again.");
        setReport(data);
        setError(null);
        // Fill the inputs with the server's default range on first load.
        setRange((current) => (current.from ? current : { from: data.from, to: data.to }));
      })
      .catch((err: Error) => setError(err.message));
  }, [range]);

  const totalRevenue = report?.revenue_by_day.reduce((sum, day) => sum + Number(day.revenue), 0) ?? 0;
  const paidBookings = report?.revenue_by_day.reduce((sum, day) => sum + day.bookings, 0) ?? 0;
  const statuses = Object.entries(report?.bookings_by_status ?? {});
  const stats = [
    { label: "Paid bookings", value: paidBookings.toLocaleString("en-US") },
    { label: "Avg. per booking", value: peso(paidBookings ? totalRevenue / paidBookings : 0) },
    { label: "Confirmed", value: (report?.bookings_by_status.confirmed ?? 0).toLocaleString("en-US") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border/30 bg-card p-3">
        <div role="group" aria-label="Quick ranges" className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
          {PRESETS.map((preset) => {
            const next = preset.range();
            const active = next.from === range.from && next.to === range.to;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(next)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:translate-y-px",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-3">
          {(["from", "to"] as const).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <Label htmlFor={`report-${key}`} className="text-xs text-muted-foreground capitalize">
                {key}
              </Label>
              <Input
                id={`report-${key}`}
                type="date"
                className="h-9 w-40"
                value={range[key]}
                onChange={(e) => setRange((current) => ({ ...current, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Button variant="outline" className="ml-auto h-9" disabled={!report} onClick={() => report && downloadExcel(report)}>
          <Download />
          Export Excel
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!report ? (
        !error && <ReportSkeleton />
      ) : report.revenue_by_day.length === 0 && statuses.length === 0 ? (
        <EmptyState {...EMPTY_STATES.reports} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-border/30 bg-card p-5 lg:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Revenue · {longDate(report.from)} – {longDate(report.to)}
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground tabular-nums">{peso(totalRevenue)}</p>
              </div>
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-foreground tabular-nums">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-6">
              <RevenueChart report={report} />
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">View as table</summary>
              <table className="mt-2 w-full text-left tabular-nums">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Payment date</th>
                    <th className="py-2 text-right font-medium">Paid bookings</th>
                    <th className="py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {report.revenue_by_day.map((day) => (
                    <tr key={day.date}>
                      <td className="py-2">{longDate(day.date)}</td>
                      <td className="py-2 text-right text-muted-foreground">{day.bookings}</td>
                      <td className="py-2 text-right">{peso(day.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <div className="flex flex-col gap-6">
            <Panel title="Top movies" description="By revenue from confirmed bookings.">
              <BarList
                ranked
                rows={report.top_movies.map((movie) => ({
                  label: movie.title,
                  value: Number(movie.revenue),
                  display: peso(movie.revenue),
                }))}
              />
            </Panel>
            <Panel title="Bookings by status">
              <BarList
                rows={statuses.map(([status, total]) => ({
                  label: status.charAt(0).toUpperCase() + status.slice(1),
                  value: total,
                  display: String(total),
                }))}
              />
            </Panel>
          </div>
        </div>
      )}

      {report && <MonthlySales report={report} />}
    </div>
  );
}
