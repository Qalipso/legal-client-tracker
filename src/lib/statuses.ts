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
    badge: "bg-blue-50 text-blue-700 ring-blue-600/20",
    dot: "bg-blue-500",
    card: "border-blue-200",
    column: "bg-blue-50/80 border-blue-200",
    columnHeader: "text-blue-800",
    cardAccent: "border-l-blue-400",
  },
  in_progress: {
    icon: "⚙",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dot: "bg-amber-500",
    card: "border-amber-200",
    column: "bg-amber-50/80 border-amber-200",
    columnHeader: "text-amber-800",
    cardAccent: "border-l-amber-400",
  },
  waiting_client: {
    icon: "⏳",
    badge: "bg-violet-50 text-violet-700 ring-violet-600/20",
    dot: "bg-violet-500",
    card: "border-violet-200",
    column: "bg-violet-50/80 border-violet-200",
    columnHeader: "text-violet-800",
    cardAccent: "border-l-violet-400",
  },
  closed: {
    icon: "✓",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
    card: "border-emerald-200",
    column: "bg-emerald-50/80 border-emerald-200",
    columnHeader: "text-emerald-800",
    cardAccent: "border-l-emerald-400",
  },
};
