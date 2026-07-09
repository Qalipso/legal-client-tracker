import type { Task } from "../types/client";

export function formatDate(iso: string): string {
  // date-only strings must be parsed as local time, not UTC midnight,
  // otherwise the displayed day shifts in western timezones
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00`)
    : new Date(iso);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isOverdue(task: Task): boolean {
  if (task.completed || !task.dueDate) return false;
  const due = new Date(`${task.dueDate}T23:59:59`);
  return due < new Date();
}

// earliest open task for a client — the "next action" shown on the card
export function nextTask(tasks: Task[], clientId: string): Task | undefined {
  return tasks
    .filter((t) => t.clientId === clientId && !t.completed)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0];
}
