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

// badge + card accent styles per status
export const STATUS_STYLES: Record<
  ClientStatus,
  { badge: string; dot: string; card: string }
> = {
  new: {
    badge: "bg-blue-50 text-blue-700 ring-blue-600/20",
    dot: "bg-blue-500",
    card: "border-blue-200",
  },
  in_progress: {
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dot: "bg-amber-500",
    card: "border-amber-200",
  },
  waiting_client: {
    badge: "bg-violet-50 text-violet-700 ring-violet-600/20",
    dot: "bg-violet-500",
    card: "border-violet-200",
  },
  closed: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
    card: "border-emerald-200",
  },
};
