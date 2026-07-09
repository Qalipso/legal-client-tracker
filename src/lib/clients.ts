import type { Client } from "../types/client";

const STORAGE_KEY = "legal-client-tracker:clients";

const seedClients: Client[] = [
  {
    id: "seed-1",
    name: "Анна Смирнова",
    phone: "+7 916 234-56-78",
    status: "new",
    note: "Первичная консультация по трудовому спору",
    createdAt: "2026-07-06T10:00:00.000Z",
    updatedAt: "2026-07-06T10:00:00.000Z",
  },
  {
    id: "seed-2",
    name: "Михаил Иванов",
    phone: "+7 903 111-22-33",
    status: "in_progress",
    note: "Договор на проверке",
    createdAt: "2026-07-04T14:30:00.000Z",
    updatedAt: "2026-07-07T09:15:00.000Z",
  },
  {
    id: "seed-3",
    name: "ООО «Альфа»",
    phone: "+7 495 987-65-43",
    status: "waiting_client",
    note: "Ждёт документы от бухгалтерии",
    createdAt: "2026-07-01T11:00:00.000Z",
    updatedAt: "2026-07-05T16:40:00.000Z",
  },
  {
    id: "seed-4",
    name: "Сергей Петров",
    phone: "+7 921 555-44-33",
    status: "closed",
    createdAt: "2026-06-20T09:00:00.000Z",
    updatedAt: "2026-07-02T12:00:00.000Z",
  },
];

export function loadClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // first visit — seed demo data so the dashboard looks alive
      saveClients(seedClients);
      return seedClients;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClients(clients: Client[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch {
    // storage full / private mode — data lives in memory for the session
  }
}

export function createClient(input: {
  name: string;
  phone: string;
  status: Client["status"];
  note?: string;
}): Client {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    status: input.status,
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
