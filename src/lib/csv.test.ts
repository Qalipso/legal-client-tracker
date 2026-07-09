import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("round-trips simple rows", () => {
    const rows = [
      { name: "Анна Смирнова", phone: "+7 916 234-56-78", note: "первичка" },
      { name: "ООО «Альфа»", phone: "+7 495 000-00-00", note: "" },
    ];
    const csv = toCsv(rows, ["name", "phone", "note"]);
    const parsed = parseCsv(csv);
    expect(parsed).toEqual(rows);
  });

  it("escapes commas, quotes and newlines", () => {
    const rows = [{ name: 'Иванов, "ИП"', note: "строка1\nстрока2" }];
    const csv = toCsv(rows, ["name", "note"]);
    const parsed = parseCsv(csv);
    expect(parsed).toEqual(rows);
  });

  it("ignores blank lines and trims header/values", () => {
    const csv = "name, phone\n Анна , 123 \n\n";
    const parsed = parseCsv(csv);
    expect(parsed).toEqual([{ name: "Анна", phone: "123" }]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
