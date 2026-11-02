export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OperatingHours = Partial<Record<Day, { open: string; close: string }>>;

const DAYS: [Day, string][] = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
];

/** "22:30" or "22:30:00" → "10:30 PM"; "00:00" → "12:00 AM". */
export function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Consecutive days with the same hours collapse into one line:
 * "Monday–Saturday: 10:30 AM – 2:00 AM". A close earlier than the open
 * means the cinema closes after midnight.
 */
export function groupHours(hours: OperatingHours): { days: string; time: string }[] {
  const lines: { first: string; last: string; time: string }[] = [];

  for (const [key, label] of DAYS) {
    const day = hours[key];
    const time = day ? `${formatClock(day.open)} – ${formatClock(day.close)}` : "Closed";
    const previous = lines[lines.length - 1];
    if (previous && previous.time === time) previous.last = label;
    else lines.push({ first: label, last: label, time });
  }

  return lines.map(({ first, last, time }) => ({
    days: first === last ? first : `${first}–${last}`,
    time,
  }));
}
