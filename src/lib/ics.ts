// Minimal iCalendar (RFC 5545) generator — no dependency.
// Produces a .ics file lawyers can import into Google Calendar / Outlook /
// Apple Calendar (File → Import, or "Other calendars → From URL" for a
// hosted feed — this module only builds the static export version).

type CalendarItem = {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  description?: string;
};

function escapeText(text: string): string {
  return text.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

function toIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function foldLine(line: string): string {
  // RFC 5545 §3.1: lines SHOULD be folded at 75 octets
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

export function toIcs(items: CalendarItem[], calendarName: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const events = items.map((item) => {
    const date = toIcsDate(item.dueDate);
    return [
      "BEGIN:VEVENT",
      foldLine(`UID:${item.id}@legal-client-tracker`),
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${date}`,
      `DTEND;VALUE=DATE:${date}`,
      foldLine(`SUMMARY:${escapeText(item.title)}`),
      ...(item.description
        ? [foldLine(`DESCRIPTION:${escapeText(item.description)}`)]
        : []),
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Legal Client Tracker//RU",
    "CALSCALE:GREGORIAN",
    foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`),
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
