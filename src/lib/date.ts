/**
 * Local (not UTC) date helpers.
 *
 * `new Date().toISOString().slice(0, 10)` returns the *UTC* date. In Pakistan
 * (UTC+5) that is still "yesterday" until 05:00 local time, so attendance /
 * lesson / admission dates were silently landing on the wrong day for early
 * morning users. These helpers always return the date on the user's clock.
 */

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** `YYYY-MM-DD` for the user's local date. */
export function toLocalDate(input: Date = new Date()): string {
  return `${input.getFullYear()}-${pad2(input.getMonth() + 1)}-${pad2(input.getDate())}`;
}

/** `YYYY-MM` for the user's local month. */
export function toLocalMonth(input: Date = new Date()): string {
  return `${input.getFullYear()}-${pad2(input.getMonth() + 1)}`;
}

/** Today's local date as `YYYY-MM-DD`. */
export function todayLocal(): string {
  return toLocalDate();
}

/** Current local month as `YYYY-MM`. */
export function currentMonthLocal(): string {
  return toLocalMonth();
}

/** Local date `days` from `from` (negative allowed) as `YYYY-MM-DD`. */
export function addDaysLocal(days: number, from: Date = new Date()): string {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return toLocalDate(next);
}
