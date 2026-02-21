const DAY_IN_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const WEEKDAY_TOKEN_TO_NAME: Record<string, keyof typeof WEEKDAY_TO_INDEX> = {
  sun: 'sunday',
  sunday: 'sunday',
  mon: 'monday',
  monday: 'monday',
  tue: 'tuesday',
  tues: 'tuesday',
  tuesday: 'tuesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  thursday: 'thursday',
  fri: 'friday',
  friday: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
};

const WEEKDAY_PATTERN =
  '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function toZonedDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: keyof typeof WEEKDAY_TO_INDEX } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const weekdayRaw = parts.find((part) => part.type === 'weekday')?.value.toLowerCase();

  if (!weekdayRaw || !(weekdayRaw in WEEKDAY_TO_INDEX)) {
    throw new Error(`Unable to parse weekday for timezone: ${timeZone}`);
  }

  return {
    year,
    month,
    day,
    weekday: weekdayRaw as keyof typeof WEEKDAY_TO_INDEX,
  };
}

function formatIsoFromAnchor(anchorUtcMs: number, dayOffset: number): string {
  const date = new Date(anchorUtcMs + dayOffset * DAY_IN_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveRelativeDateOffset(text: string): number | null {
  if (/\bday after tomorrow\b/.test(text)) return 2;
  if (/\btomorrow\b/.test(text)) return 1;
  if (/\b(today|tonight)\b/.test(text)) return 0;
  return null;
}

function extractWeekdayDirective(
  text: string,
): { weekday: keyof typeof WEEKDAY_TO_INDEX; modifier: 'next' | 'coming' | 'this' | null } | null {
  const modifiedMatch = text.match(
    new RegExp(`\\b(next|coming|this)\\s+${WEEKDAY_PATTERN}\\b`, 'i'),
  );
  if (modifiedMatch) {
    const modifier = modifiedMatch[1].toLowerCase() as 'next' | 'coming' | 'this';
    const token = modifiedMatch[2].toLowerCase();
    const weekday = WEEKDAY_TOKEN_TO_NAME[token];
    if (weekday) return { weekday, modifier };
  }

  const plainMatch = text.match(new RegExp(`\\b${WEEKDAY_PATTERN}\\b`, 'i'));
  if (!plainMatch) return null;

  const token = plainMatch[1].toLowerCase();
  const weekday = WEEKDAY_TOKEN_TO_NAME[token];
  if (!weekday) return null;

  return { weekday, modifier: null };
}

function parseCountToken(token: string | undefined): number | null {
  if (!token) return null;
  const normalizedToken = token.toLowerCase();
  if (/^\d+$/.test(normalizedToken)) return Number(normalizedToken);
  return NUMBER_WORDS[normalizedToken] ?? null;
}

function extractWeekOffset(text: string): number | null {
  const numberedWeeksPattern =
    /\b(?:in\s+|next\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+weeks?\b/i;
  const numberedMatch = text.match(numberedWeeksPattern);
  if (numberedMatch) {
    return parseCountToken(numberedMatch[1]);
  }

  if (/\bnext\s+week\b/i.test(text)) return 1;
  if (/\bthis\s+week\b/i.test(text)) return 0;
  return null;
}

export function resolveNaturalDate(
  text: string | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): string | null {
  if (!text) return null;
  const normalizedText = text.toLowerCase();

  const explicitIsoMatch = normalizedText.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicitIsoMatch) {
    return explicitIsoMatch[1];
  }

  let zonedDate: { year: number; month: number; day: number; weekday: keyof typeof WEEKDAY_TO_INDEX };
  try {
    zonedDate = toZonedDateParts(now, timeZone);
  } catch {
    zonedDate = toZonedDateParts(now, 'UTC');
  }
  const anchorUtcMs = Date.UTC(zonedDate.year, zonedDate.month - 1, zonedDate.day);

  const relativeOffset = resolveRelativeDateOffset(normalizedText);
  if (relativeOffset !== null) {
    return formatIsoFromAnchor(anchorUtcMs, relativeOffset);
  }

  const weekdayDirective = extractWeekdayDirective(normalizedText);
  const weekOffset = extractWeekOffset(normalizedText);

  if (weekOffset !== null && !weekdayDirective) {
    return formatIsoFromAnchor(anchorUtcMs, weekOffset * 7);
  }

  if (!weekdayDirective) return null;

  const currentWeekdayIndex = WEEKDAY_TO_INDEX[zonedDate.weekday];
  const targetWeekdayIndex = WEEKDAY_TO_INDEX[weekdayDirective.weekday];
  let dayOffset = (targetWeekdayIndex - currentWeekdayIndex + 7) % 7;

  if (weekOffset !== null) {
    dayOffset += weekOffset * 7;
    return formatIsoFromAnchor(anchorUtcMs, dayOffset);
  }

  if (weekdayDirective.modifier === 'next' || weekdayDirective.modifier === 'coming') {
    if (dayOffset === 0) dayOffset = 7;
  }

  return formatIsoFromAnchor(anchorUtcMs, dayOffset);
}
