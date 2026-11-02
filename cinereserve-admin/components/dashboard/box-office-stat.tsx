"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { LOADING } from "@/components/dashboard/loading-value";
import { CountUp, pesoCount } from "@/components/dashboard/count-up";

type BoxOffice = {
  today_box_office: string;
  today_paid_transactions: number;
};

export function BoxOfficeStat() {
  const [boxOffice, setBoxOffice] = useState<BoxOffice | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard/overview")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);
        setBoxOffice({
          today_box_office: data.today_box_office,
          today_paid_transactions: data.today_paid_transactions,
        });
      })
      .catch(() => setFailed(true));
  }, []);

  const value = failed
    ? "—"
    : boxOffice
      ? <CountUp value={Number(boxOffice.today_box_office)} format={pesoCount} />
      : LOADING;
  const hint = failed
    ? "Unavailable"
    : boxOffice
      ? `${boxOffice.today_paid_transactions} paid transaction${
          boxOffice.today_paid_transactions === 1 ? "" : "s"
        }`
      : "Loading…";
  const footValue = failed
    ? "—"
    : boxOffice
      ? <CountUp value={boxOffice.today_paid_transactions} />
      : LOADING;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/30 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">Today&apos;s Box Office</span>
        <Wallet className="h-5 w-5 text-primary" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2.5 text-[11px] text-muted-foreground">
        <span>Payments today</span>
        <span className="font-semibold text-foreground">{footValue}</span>
      </div>
    </div>
  );
}
