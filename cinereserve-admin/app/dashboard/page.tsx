"use client";

import Link from "next/link";
import { useState } from "react";
import { Film, Plus, PlusCircle, SlidersHorizontal } from "lucide-react";
import { OccupancyStat } from "@/components/dashboard/occupancy-stat";
import { ScreeningsStat } from "@/components/dashboard/screenings-stat";
import { BoxOfficeStat } from "@/components/dashboard/box-office-stat";
import { ReservationsStat } from "@/components/dashboard/reservations-stat";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { cn } from "@/lib/utils";
import { DASHBOARD_STATS, DASHBOARD_SUBVIEWS, HREF_BY_ID } from "@/lib/dashboard-nav";

const BOX_OFFICE_LABEL = "Today's Box Office";
const SCREENINGS_LABEL = "Active Screenings";
const OCCUPANCY_LABEL = "Hall Occupancy Rate";
const RESERVATIONS_LABEL = "Reservations Issued";

function StatCard({ stat }: { stat: (typeof DASHBOARD_STATS)[number] }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/30 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{stat.label}</span>
        <stat.icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-foreground">{stat.value}</span>
        <span className="text-[11px] text-muted-foreground">{stat.hint}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2.5 text-[11px] text-muted-foreground">
        <span>{stat.footLabel}</span>
        <span className="font-semibold text-foreground">{stat.footValue}</span>
      </div>
    </div>
  );
}

function renderStat(stat: (typeof DASHBOARD_STATS)[number]) {
  if (stat.label === BOX_OFFICE_LABEL) return <BoxOfficeStat key={stat.label} />;
  if (stat.label === SCREENINGS_LABEL) return <ScreeningsStat key={stat.label} />;
  if (stat.label === OCCUPANCY_LABEL) return <OccupancyStat key={stat.label} />;
  if (stat.label === RESERVATIONS_LABEL) return <ReservationsStat key={stat.label} />;
  return <StatCard key={stat.label} stat={stat} />;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-border/30 bg-card/70 p-1.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {DASHBOARD_SUBVIEWS.map((view, i) => (
            <button
              key={view.label}
              type="button"
              onClick={() => setActiveTab(i)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors sm:px-3.5",
                i === activeTab
                  ? "bg-[#353439] font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <view.icon
                className={cn("h-[18px] w-[18px]", i === activeTab && "text-primary")}
              />
              <span>{view.label}</span>
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-2 pr-2 md:flex">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border/30 bg-muted px-3 py-1.5 text-sm text-muted-foreground opacity-60"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filter</span>
          </button>
          <Link
            href={HREF_BY_ID.schedules}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>New Schedule</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="mb-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARD_STATS.map(renderStat)}
        </div>

        {activeTab === 0 ? (
          <div className="relative w-full overflow-hidden rounded-2xl border border-border/30 bg-card p-6 text-center shadow-xl sm:p-10 lg:p-14">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/30 to-primary/10 shadow-[0_0_24px_rgba(124,58,237,0.3)] ring-1 ring-primary/30">
              <Film className="h-10 w-10 text-primary" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">Today&apos;s Schedule</h2>
            <div className="mx-auto max-w-3xl">
              <TodaySchedule />
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={HREF_BY_ID.schedules}
                className="inline-flex transform items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0"
              >
                <PlusCircle className="h-5 w-5" />
                <span>New Schedule</span>
              </Link>
              <Link
                href={HREF_BY_ID.movies}
                className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-muted px-5 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent"
              >
                <Film className="h-[18px] w-[18px]" />
                <span>Manage Catalog</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-2xl border border-border/30 bg-card p-6 text-center shadow-xl sm:p-10 lg:p-14">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
            <p className="relative text-sm text-muted-foreground">No alerts available.</p>
          </div>
        )}
      </div>
    </>
  );
}
