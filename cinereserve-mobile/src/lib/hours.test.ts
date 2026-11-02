import { describe, expect, it } from 'vitest';
import { closesAt, formatClock, formatRuntime, groupHours, startTimes } from './hours';

describe('groupHours', () => {
  it('collapses consecutive days with the same hours, including past midnight', () => {
    const late = { open: '10:30', close: '02:00' };
    expect(
      groupHours({ mon: late, tue: late, wed: late, thu: late, fri: late, sat: late, sun: { open: '10:30', close: '00:00' } })
    ).toEqual([
      { days: 'Monday–Saturday', time: '10:30 AM – 2:00 AM' },
      { days: 'Sunday', time: '10:30 AM – 12:00 AM' },
    ]);
  });

  it('shows missing days as closed', () => {
    expect(groupHours({ fri: { open: '18:00', close: '23:00' } })).toEqual([
      { days: 'Monday–Thursday', time: 'Closed' },
      { days: 'Friday', time: '6:00 PM – 11:00 PM' },
      { days: 'Saturday–Sunday', time: 'Closed' },
    ]);
  });

  it('formats noon and midnight', () => {
    expect(formatClock('12:00')).toBe('12:00 PM');
    expect(formatClock('00:00:00')).toBe('12:00 AM');
  });
});

describe('formatRuntime', () => {
  it('splits minutes into hours and minutes', () => {
    expect(formatRuntime(145)).toBe('2h 25m');
    expect(formatRuntime(120)).toBe('2h');
    expect(formatRuntime(45)).toBe('45m');
  });
});

describe('startTimes', () => {
  // 2026-11-06 is a Friday; Thursday's window runs past midnight.
  const late = { open: '22:00', close: '02:00' };

  it('keeps the whole booking inside the window, including after midnight', () => {
    expect(startTimes({ thu: late, fri: late }, '2026-11-06', 120)).toEqual(['00:00', '22:00', '22:30', '23:00', '23:30']);
  });

  it('returns nothing on a closed day with no overnight carry', () => {
    expect(startTimes({ mon: late }, '2026-11-06', 60)).toEqual([]);
  });
});

describe('closesAt', () => {
  const late = { open: '22:00', close: '02:00' };

  it("counts early hours toward the previous day's window", () => {
    expect(closesAt({ thu: late }, new Date(2026, 10, 6, 1, 30))).toBe('Closes 2:00 AM');
  });

  it('is null outside every window', () => {
    expect(closesAt({ thu: late, fri: late }, new Date(2026, 10, 6, 12, 0))).toBeNull();
    expect(closesAt({ thu: late }, new Date(2026, 10, 6, 2, 0))).toBeNull();
  });
});
