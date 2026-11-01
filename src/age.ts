/** Month-precision check. The birthday month itself does not count, because the day is unknown. */
export function isAtLeast13(year: number, month: number, now: Date): boolean {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  let age = currentYear - year;
  if (currentMonth <= month) age -= 1;
  return age >= 13;
}

export function parseBirth(
  monthRaw: string,
  yearRaw: string,
  now: Date,
): { ok: true; month: number; year: number } | { ok: false } {
  if (!/^\d{1,2}$/.test(monthRaw) || !/^\d{4}$/.test(yearRaw)) return { ok: false };
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const currentYear = now.getUTCFullYear();
  if (month < 1 || month > 12 || year < 1900 || year > currentYear) return { ok: false };
  return { ok: true, month, year };
}
