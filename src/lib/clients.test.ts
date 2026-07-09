import { describe, expect, it } from "vitest";
import { formatDate, isOverdue, nextTask } from "./clients";
import type { Task } from "../types/client";

describe("formatDate", () => {
  it("formats a date-only string without a UTC day shift", () => {
    // regression: date-only strings used to be parsed as UTC midnight,
    // which rendered as the previous day in western timezones
    expect(formatDate("2026-07-10")).toBe("10.07.2026");
  });

  it("formats a full ISO timestamp", () => {
    expect(formatDate("2026-07-10T23:00:00.000Z")).toMatch(/07\.2026$/);
  });
});

describe("isOverdue", () => {
  const base: Task = {
    id: "t1",
    clientId: "c1",
    title: "test",
    completed: false,
    createdAt: "2020-01-01T00:00:00.000Z",
  };

  it("is false when there is no due date", () => {
    expect(isOverdue(base)).toBe(false);
  });

  it("is false when the task is already completed", () => {
    expect(isOverdue({ ...base, dueDate: "2000-01-01", completed: true })).toBe(
      false,
    );
  });

  it("is true for a due date in the past", () => {
    expect(isOverdue({ ...base, dueDate: "2000-01-01" })).toBe(true);
  });

  it("is false for a due date far in the future", () => {
    expect(isOverdue({ ...base, dueDate: "2099-01-01" })).toBe(false);
  });
});

describe("nextTask", () => {
  it("picks the earliest open task for the client, ignoring other clients and completed tasks", () => {
    const tasks: Task[] = [
      { id: "1", clientId: "a", title: "later", dueDate: "2026-08-01", completed: false, createdAt: "" },
      { id: "2", clientId: "a", title: "sooner", dueDate: "2026-07-01", completed: false, createdAt: "" },
      { id: "3", clientId: "a", title: "done", dueDate: "2026-01-01", completed: true, createdAt: "" },
      { id: "4", clientId: "b", title: "other client", dueDate: "2026-01-01", completed: false, createdAt: "" },
    ];
    expect(nextTask(tasks, "a")?.id).toBe("2");
  });

  it("returns undefined when the client has no open tasks", () => {
    expect(nextTask([], "a")).toBeUndefined();
  });
});
