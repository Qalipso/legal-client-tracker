import type {
  AppData,
  CaseHistoryItem,
  Client,
  HistoryType,
  Task,
} from "../types/client";

const STORAGE_KEY = "legal-client-tracker:clients";

const emptyData: AppData = {
  clients: [],
  history: [],
  tasks: [],
  attachments: [],
};

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

const seedData: AppData = {
  clients: seedClients,
  history: [
    ...seedClients.map((c) => ({
      id: `h-${c.id}-created`,
      clientId: c.id,
      type: "created" as const,
      text: "Клиент добавлен",
      createdAt: c.createdAt,
    })),
    {
      id: "h-seed-2-note",
      clientId: "seed-2",
      type: "note",
      text: "Проведена первичная консультация, договор отправлен на проверку",
      createdAt: "2026-07-05T10:00:00.000Z",
    },
    {
      id: "h-seed-2-status",
      clientId: "seed-2",
      type: "status_change",
      text: "Новый → В работе",
      createdAt: "2026-07-05T10:05:00.000Z",
    },
    {
      id: "h-seed-3-status",
      clientId: "seed-3",
      type: "status_change",
      text: "В работе → Ожидает клиента",
      createdAt: "2026-07-05T16:40:00.000Z",
    },
    {
      id: "h-seed-4-status",
      clientId: "seed-4",
      type: "status_change",
      text: "В работе → Закрыт",
      createdAt: "2026-07-02T12:00:00.000Z",
    },
  ],
  tasks: [
    {
      id: "t-seed-1",
      clientId: "seed-1",
      title: "Отправить договор",
      dueDate: "2026-07-10",
      completed: false,
      createdAt: "2026-07-06T10:10:00.000Z",
    },
    {
      id: "t-seed-3",
      clientId: "seed-3",
      title: "Запросить документы повторно",
      dueDate: "2026-07-08",
      completed: false,
      createdAt: "2026-07-05T16:45:00.000Z",
    },
  ],
  attachments: [
    {
      id: "a-seed-2",
      clientId: "seed-2",
      fileName: "contract-draft.docx",
      uploadedAt: "2026-07-05T10:20:00.000Z",
    },
  ],
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // first visit — seed demo data so the board looks alive
      saveData(seedData);
      return seedData;
    }
    const parsed = JSON.parse(raw);
    // v1 stored a plain array of clients — migrate to the AppData shape
    if (Array.isArray(parsed)) {
      const migrated: AppData = {
        ...emptyData,
        clients: parsed,
        history: parsed.map((c: Client) => ({
          id: `h-${c.id}-created`,
          clientId: c.id,
          type: "created" as const,
          text: "Клиент добавлен",
          createdAt: c.createdAt,
        })),
      };
      saveData(migrated);
      return migrated;
    }
    if (parsed && Array.isArray(parsed.clients)) {
      return { ...emptyData, ...parsed };
    }
    return emptyData;
  } catch {
    return emptyData;
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

export function createHistoryItem(
  clientId: string,
  type: HistoryType,
  text: string,
): CaseHistoryItem {
  return {
    id: crypto.randomUUID(),
    clientId,
    type,
    text,
    createdAt: new Date().toISOString(),
  };
}

export function createTask(
  clientId: string,
  title: string,
  dueDate?: string,
): Task {
  return {
    id: crypto.randomUUID(),
    clientId,
    title: title.trim(),
    dueDate: dueDate || undefined,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

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
  const today = new Date();
  const due = new Date(`${task.dueDate}T23:59:59`);
  return due < today;
}

// earliest open task for a client — the "next action" shown on the card
export function nextTask(tasks: Task[], clientId: string): Task | undefined {
  return tasks
    .filter((t) => t.clientId === clientId && !t.completed)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0];
}
