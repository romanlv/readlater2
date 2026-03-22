import { describe, test, expect } from 'vitest';
import {
  unixMsToIso,
  isoToUnixMs,
  formatRelativeTime,
  formatShortDate,
  mostRecent,
} from './date-format';

describe('unixMsToIso', () => {
  test('converts Unix ms to ISO string', () => {
    const ms = 1700000000000; // 2023-11-14T22:13:20.000Z
    const iso = unixMsToIso(ms);
    expect(iso).toBe('2023-11-14T22:13:20.000Z');
  });

  test('round-trips with isoToUnixMs', () => {
    const ms = 1700000000000;
    expect(isoToUnixMs(unixMsToIso(ms))).toBe(ms);
  });
});

describe('isoToUnixMs', () => {
  test('converts ISO string to Unix ms', () => {
    const iso = '2023-11-14T22:13:20.000Z';
    expect(isoToUnixMs(iso)).toBe(1700000000000);
  });

  test('handles date-only strings', () => {
    const ms = isoToUnixMs('2023-01-01');
    expect(ms).toBeGreaterThan(0);
  });
});

describe('formatRelativeTime', () => {
  const now = 1700000000000;

  test('returns "just now" for recent timestamps', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now');
  });

  test('returns minutes for < 1 hour', () => {
    expect(formatRelativeTime(now - 120_000, now)).toBe('2m ago');
    expect(formatRelativeTime(now - 3_540_000, now)).toBe('59m ago');
  });

  test('returns hours for < 1 day', () => {
    expect(formatRelativeTime(now - 7_200_000, now)).toBe('2h ago');
    expect(formatRelativeTime(now - 82_800_000, now)).toBe('23h ago');
  });

  test('returns days for < 30 days', () => {
    expect(formatRelativeTime(now - 172_800_000, now)).toBe('2d ago');
  });

  test('returns formatted date for > 30 days', () => {
    const oldTimestamp = now - 90 * 86_400_000;
    const result = formatRelativeTime(oldTimestamp, now);
    expect(result).toMatch(/\d/); // contains digits (a date)
  });

  test('returns "just now" for future timestamps', () => {
    expect(formatRelativeTime(now + 60_000, now)).toBe('just now');
  });
});

describe('formatShortDate', () => {
  test('formats as YYYY-MM-DD', () => {
    expect(formatShortDate(1700000000000)).toBe('2023-11-14');
  });
});

describe('mostRecent', () => {
  test('returns the larger of two numbers', () => {
    expect(mostRecent(100, 200)).toBe(200);
    expect(mostRecent(300, 100)).toBe(300);
  });

  test('handles ISO string inputs', () => {
    const a = '2023-11-14T22:13:20.000Z';
    const b = '2023-12-01T00:00:00.000Z';
    expect(mostRecent(a, b)).toBe(new Date(b).getTime());
  });

  test('handles mixed number and string inputs', () => {
    const num = 1700000000000;
    const iso = '2023-12-01T00:00:00.000Z';
    expect(mostRecent(num, iso)).toBe(new Date(iso).getTime());
  });

  test('handles undefined values', () => {
    expect(mostRecent(100, undefined)).toBe(100);
    expect(mostRecent(undefined, 200)).toBe(200);
    expect(mostRecent(undefined, undefined)).toBe(0);
  });
});
