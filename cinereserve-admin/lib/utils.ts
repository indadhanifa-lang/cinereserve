export { cn } from "cn"

/** 145 → "2h 25m" */
export const formatRuntime = (minutes: number) =>
  [Math.floor(minutes / 60) && `${Math.floor(minutes / 60)}h`, minutes % 60 && `${minutes % 60}m`]
    .filter(Boolean)
    .join(" ") || "0m"

// Every date in the range, so days without sales still show as gaps.
export function daysBetween(from: string, to: string) {
  const days: string[] = []
  const end = new Date(`${to}T00:00:00Z`)
  for (const day = new Date(`${from}T00:00:00Z`); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    days.push(day.toISOString().slice(0, 10))
  }
  return days
}

/** "2026-11-03" → "Nov 3" */
export const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

/** 12500 → "₱13K" */
export const pesoTick = (value: number) => `₱${value.toLocaleString("en-US", { notation: "compact" })}`
