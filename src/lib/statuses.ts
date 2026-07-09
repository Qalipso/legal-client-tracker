import type { ClientStatus } from "../types/client";

export const STATUS_LABELS: Record<ClientStatus, string> = {
  new: "Новый",
  in_progress: "В работе",
  waiting_client: "Ожидает клиента",
  closed: "Закрыт",
};

export const STATUS_ORDER: ClientStatus[] = [
  "new",
  "in_progress",
  "waiting_client",
  "closed",
];

// per-status visual identity: badge, dot, board column and card accent
export const STATUS_STYLES: Record<
  ClientStatus,
  {
    icon: string;
    badge: string;
    dot: string;
    card: string;
    column: string;
    columnHeader: string;
    cardAccent: string;
  }
> = {
  new: {
    icon: "✦",
    badge:
      "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/30",
    dot: "bg-blue-500 dark:bg-blue-400",
    card: "border-blue-200 dark:border-blue-800",
    column:
      "bg-blue-50/80 border-blue-200 dark:bg-blue-500/5 dark:border-blue-900",
    columnHeader: "text-blue-800 dark:text-blue-300",
    cardAccent: "border-l-blue-400 dark:border-l-blue-500",
  },
  in_progress: {
    icon: "⚙",
    badge:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
    dot: "bg-amber-500 dark:bg-amber-400",
    card: "border-amber-200 dark:border-amber-800",
    column:
      "bg-amber-50/80 border-amber-200 dark:bg-amber-500/5 dark:border-amber-900",
    columnHeader: "text-amber-800 dark:text-amber-300",
    cardAccent: "border-l-amber-400 dark:border-l-amber-500",
  },
  waiting_client: {
    icon: "⏳",
    badge:
      "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/30",
    dot: "bg-violet-500 dark:bg-violet-400",
    card: "border-violet-200 dark:border-violet-800",
    column:
      "bg-violet-50/80 border-violet-200 dark:bg-violet-500/5 dark:border-violet-900",
    columnHeader: "text-violet-800 dark:text-violet-300",
    cardAccent: "border-l-violet-400 dark:border-l-violet-500",
  },
  closed: {
    icon: "✓",
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    card: "border-emerald-200 dark:border-emerald-800",
    column:
      "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-900",
    columnHeader: "text-emerald-800 dark:text-emerald-300",
    cardAccent: "border-l-emerald-400 dark:border-l-emerald-500",
  },
};
