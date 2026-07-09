import { describe, expect, it } from "vitest";
import { toIcs } from "./ics";

describe("toIcs", () => {
  it("produces a valid VCALENDAR wrapper with one VEVENT per item", () => {
    const ics = toIcs(
      [{ id: "t1", dueDate: "2026-08-01", title: "Позвонить клиенту" }],
      "Legal Client Tracker",
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260801");
    expect(ics).toContain("SUMMARY:Позвонить клиенту");
  });

  it("escapes commas, semicolons and newlines per RFC 5545", () => {
    const ics = toIcs(
      [
        {
          id: "t2",
          dueDate: "2026-08-02",
          title: "Иванов, дело №1; срочно",
          description: "строка1\nстрока2",
        },
      ],
      "Cal",
    );
    expect(ics).toContain("SUMMARY:Иванов\\, дело №1\\; срочно");
    expect(ics).toContain("DESCRIPTION:строка1\\nстрока2");
  });

  it("returns just the calendar wrapper for an empty list", () => {
    const ics = toIcs([], "Empty");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
