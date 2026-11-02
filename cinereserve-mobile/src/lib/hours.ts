export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type OperatingHours = Partial<Record<Day, { open: string; close: string }>>;

const DAYS: [Day, string][] = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

/** "22:30" or "22:30:00" → "10:30 PM"; "00:00" → "12:00 AM". */
export function formatClock(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
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
    const time = day ? `${formatClock(day.open)} – ${formatClock(day.close)}` : 'Closed';
    const previous = lines[lines.length - 1];
    if (previous && previous.time === time) previous.last = label;
    else lines.push({ first: label, last: label, time });
  }

  return lines.map(({ first, last, time }) => ({
    days: first === last ? first : `${first}–${last}`,
    time,
  }));
}

/** 145 → "2h 25m"; 90 → "1h 30m"; 45 → "45m". */
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m';
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Open windows touching `weekday` (0 = Sunday), in minutes from that day's
 * midnight. Early hours after midnight belong to the previous day's window.
 */
function windowsFor(hours: OperatingHours, weekday: number) {
  const keys: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return [
    { day: hours[keys[(weekday + 6) % 7]], offset: -1440 },
    { day: hours[keys[weekday]], offset: 0 },
  ].flatMap(({ day, offset }) => {
    if (!day) return [];
    const open = toMinutes(day.open);
    let close = toMinutes(day.close);
    if (close <= open) close += 1440;
    return [{ open: open + offset, close: close + offset, closeLabel: formatClock(day.close) }];
  });
}

/** "Closes 2:00 AM" while open at `now`, otherwise null. */
export function closesAt(hours: OperatingHours, now = new Date()): string | null {
  const t = now.getHours() * 60 + now.getMinutes();
  const open = windowsFor(hours, now.getDay()).find(({ open, close }) => t >= open && t < close);
  return open ? `Closes ${open.closeLabel}` : null;
}

/**
 * Start times ("HH:MM", every `step` minutes) on `date` (YYYY-MM-DD) where
 * a `runtime`-minute booking fits the opening hours. Like the API, early
 * hours after midnight belong to the previous day's window.
 */
export function startTimes(hours: OperatingHours, date: string, runtime: number, step = 30): string[] {
  const windows = windowsFor(hours, new Date(`${date}T00:00:00Z`).getUTCDay());

  const times: string[] = [];
  for (let t = 0; t < 1440; t += step) {
    if (windows.some(({ open, close }) => t >= open && t + runtime <= close)) {
      times.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
    }
  }
  return times;
}
