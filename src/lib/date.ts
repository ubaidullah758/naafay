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

export function toWesternDigits(input: any): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰٠]/g, '0')
    .replace(/[۱١]/g, '1')
    .replace(/[۲٢]/g, '2')
    .replace(/[۳٣]/g, '3')
    .replace(/[۴٤]/g, '4')
    .replace(/[۵٥]/g, '5')
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9');
}

/** Format date into Urdu Hijri + Gregorian: e.g. "17 ربیع الاول 1448ھ بمطابق 31 اگست 2026ء بروز سوموار" */
export function formatUrduFullDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ['اتوار', 'سوموار', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
    const urduMonths = [
      'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
      'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر',
    ];
    const dayOfWeek = dayNames[dateObj.getDay()];
    const gregorianPart = `${d} ${urduMonths[m - 1]} ${y}ء بروز ${dayOfWeek}`;

    let hijriPart = '';
    try {
      const hijriFormatter = new Intl.DateTimeFormat('ur-PK-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      hijriPart = toWesternDigits(hijriFormatter.format(dateObj).replace(/ہجری/, 'ھ'));
    } catch {
      hijriPart = '1448ھ';
    }

    return `${hijriPart} بمطابق ${gregorianPart}`;
  } catch {
    return dateStr;
  }
}

/** Format month into Urdu Hijri + Gregorian: e.g. "مہینہ: نومبر 2026ء بمطابق جمادی الثانی 1448ھ" */
export function formatUrduMonth(monthStr: string): string {
  try {
    const [y, m] = monthStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 15);
    const urduMonths = [
      'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
      'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر',
    ];
    const gregorianPart = `${urduMonths[m - 1]} ${y}ء`;
    let hijriPart = '';
    try {
      const hijriFormatter = new Intl.DateTimeFormat('ur-PK-u-ca-islamic-umalqura', {
        month: 'long',
        year: 'numeric',
      });
      hijriPart = toWesternDigits(hijriFormatter.format(dateObj).replace(/ہجری/, 'ھ'));
    } catch {
      hijriPart = 'جمادی الثانی 1448ھ';
    }
    return `مہینہ: ${gregorianPart} بمطابق ${hijriPart}`;
  } catch {
    return monthStr;
  }
}

export interface DayInfo {
  day: number;
  dateStr: string;
  dayOfWeekUrdu: string;
  dayOfWeekEn: string;
  isSunday: boolean;
  formattedShort: string; // e.g. "01/11 - اتوار"
}

/** Get list of all days in month formatted like official registers (e.g. "01/11 - اتوار") */
export function getMonthDaysList(monthStr: string): DayInfo[] {
  try {
    const [y, m] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const dayNames = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
    const enDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const list: DayInfo[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dObj = new Date(y, m - 1, d);
      const dayIdx = dObj.getDay();
      const dd = pad2(d);
      const mm = pad2(m);
      const dateStr = `${y}-${mm}-${dd}`;
      list.push({
        day: d,
        dateStr,
        dayOfWeekUrdu: dayNames[dayIdx],
        dayOfWeekEn: enDayNames[dayIdx],
        isSunday: dayIdx === 0,
        formattedShort: `${dd}/${mm} - ${dayNames[dayIdx]}`,
      });
    }
    return list;
  } catch {
    return [];
  }
}

