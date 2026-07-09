import type {
  AppData,
  CaseHistoryItem,
  Client,
  ClientPatch,
  ClientStatus,
  HistoryType,
  NewClientInput,
} from "../../types/client";
import type { DataProvider } from "./types";
import { STATUS_LABELS } from "../statuses";

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
    caseType: "Консультация",
    priority: "medium",
    createdAt: "2026-07-06T10:00:00.000Z",
    updatedAt: "2026-07-06T10:00:00.000Z",
  },
  {
    id: "seed-2",
    name: "Михаил Иванов",
    phone: "+7 903 111-22-33",
    status: "in_progress",
    note: "Договор на проверке",
    caseType: "Договор",
    priority: "high",
    createdAt: "2026-07-04T14:30:00.000Z",
    updatedAt: "2026-07-07T09:15:00.000Z",
  },
  {
    id: "seed-3",
    name: "ООО «Альфа»",
    phone: "+7 495 987-65-43",
    status: "waiting_client",
    note: "Ждёт документы от бухгалтерии",
    caseType: "Корпоративное",
    createdAt: "2026-07-01T11:00:00.000Z",
    updatedAt: "2026-07-05T16:40:00.000Z",
  },
  {
    id: "seed-4",
    name: "Сергей Петров",
    phone: "+7 921 555-44-33",
    status: "closed",
    caseType: "Суд",
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
      type: "client_created" as const,
      text: "Клиент добавлен",
      createdAt: c.createdAt,
    })),
    {
      id: "h-seed-2-note",
      clientId: "seed-2",
      type: "note_added",
      text: "Проведена первичная консультация, договор отправлен на проверку",
      createdAt: "2026-07-05T10:00:00.000Z",
    },
    {
      id: "h-seed-2-status",
      clientId: "seed-2",
      type: "status_changed",
      text: "Новый → В работе",
      metadata: { from: "new", to: "in_progress" },
      createdAt: "2026-07-05T10:05:00.000Z",
    },
    {
      id: "h-seed-3-status",
      clientId: "seed-3",
      type: "status_changed",
      text: "В работе → Ожидает клиента",
      metadata: { from: "in_progress", to: "waiting_client" },
      createdAt: "2026-07-05T16:40:00.000Z",
    },
    {
      id: "h-seed-4-status",
      clientId: "seed-4",
      type: "status_changed",
      text: "В работе → Закрыт",
      metadata: { from: "in_progress", to: "closed" },
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

// v2 history types → v3 (ТЗ) event names
const V2_TYPE_MAP: Record<string, HistoryType> = {
  created: "client_created",
  note: "note_added",
  status_change: "status_changed",
  attachment: "attachment_added",
  task: "task_created",
};

function migrate(parsed: unknown): AppData {
  // v1: plain array of clients
  if (Array.isArray(parsed)) {
    return {
      ...emptyData,
      clients: parsed as Client[],
      history: (parsed as Client[]).map((c) => ({
        id: `h-${c.id}-created`,
        clientId: c.id,
        type: "client_created" as const,
        text: "Клиент добавлен",
        createdAt: c.createdAt,
      })),
    };
  }
  const data = parsed as AppData;
  if (!data || !Array.isArray(data.clients)) return emptyData;
  // v2: old history type names
  const history = (data.history ?? []).map((h) => {
    const oldType = h.type as string;
    if (!(oldType in V2_TYPE_MAP)) return h;
    const mapped: HistoryType =
      oldType === "task" && h.text.startsWith("Задача выполнена")
        ? "task_completed"
        : V2_TYPE_MAP[oldType];
    return { ...h, type: mapped };
  });
  return { ...emptyData, ...data, history };
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      save(seedData);
      return seedData;
    }
    return migrate(JSON.parse(raw));
  } catch {
    return emptyData;
  }
}

function save(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full / private mode — data lives in memory for the session
  }
}

function historyItem(
  clientId: string,
  type: HistoryType,
  text: string,
  metadata?: Record<string, unknown>,
): CaseHistoryItem {
  return {
    id: crypto.randomUUID(),
    clientId,
    type,
    text,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

function mutate(fn: (data: AppData) => AppData): Promise<AppData> {
  const next = fn(load());
  save(next);
  return Promise.resolve(next);
}

const visible = (data: AppData): AppData => ({
  ...data,
  clients: data.clients.filter((c) => !c.deletedAt),
});

export const localStorageProvider: DataProvider = {
  name: "localStorage",

  fetchAll: () => Promise.resolve(visible(load())),

  createClient: (input: NewClientInput) =>
    mutate((data) => {
      const now = new Date().toISOString();
      const client: Client = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        phone: input.phone.trim(),
        status: input.status,
        note: input.note?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...data,
        clients: [client, ...data.clients],
        history: [
          historyItem(client.id, "client_created", "Клиент добавлен"),
          ...data.history,
        ],
      };
    }).then(visible),

  updateClient: (id: string, patch: ClientPatch) =>
    mutate((data) => ({
      ...data,
      clients: data.clients.map((c) =>
        c.id === id
          ? { ...c, ...patch, updatedAt: new Date().toISOString() }
          : c,
      ),
      history: [
        historyItem(id, "client_updated", "Данные клиента обновлены"),
        ...data.history,
      ],
    })).then(visible),

  updateClientStatus: (id: string, status: ClientStatus) =>
    mutate((data) => {
      const client = data.clients.find((c) => c.id === id);
      if (!client || client.status === status) return data;
      return {
        ...data,
        clients: data.clients.map((c) =>
          c.id === id
            ? { ...c, status, updatedAt: new Date().toISOString() }
            : c,
        ),
        history: [
          historyItem(
            id,
            "status_changed",
            `${STATUS_LABELS[client.status]} → ${STATUS_LABELS[status]}`,
            { from: client.status, to: status },
          ),
          ...data.history,
        ],
      };
    }).then(visible),

  softDeleteClient: (id: string) =>
    mutate((data) => ({
      ...data,
      clients: data.clients.map((c) =>
        c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c,
      ),
    })).then(visible),

  addNote: (clientId: string, text: string) =>
    mutate((data) => ({
      ...data,
      history: [historyItem(clientId, "note_added", text), ...data.history],
    })).then(visible),

  createTask: (clientId: string, title: string, dueDate?: string) =>
    mutate((data) => ({
      ...data,
      tasks: [
        ...data.tasks,
        {
          id: crypto.randomUUID(),
          clientId,
          title: title.trim(),
          dueDate: dueDate || undefined,
          completed: false,
          createdAt: new Date().toISOString(),
        },
      ],
      history: [
        historyItem(clientId, "task_created", `Задача: ${title}`),
        ...data.history,
      ],
    })).then(visible),

  toggleTask: (taskId: string) =>
    mutate((data) => {
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) return data;
      const completed = !task.completed;
      return {
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed,
                completedAt: completed ? new Date().toISOString() : undefined,
              }
            : t,
        ),
        history: completed
          ? [
              historyItem(
                task.clientId,
                "task_completed",
                `Задача выполнена: ${task.title}`,
              ),
              ...data.history,
            ]
          : data.history,
      };
    }).then(visible),

  addAttachment: (clientId: string, fileName: string) =>
    mutate((data) => ({
      ...data,
      attachments: [
        ...data.attachments,
        {
          id: crypto.randomUUID(),
          clientId,
          fileName,
          uploadedAt: new Date().toISOString(),
        },
      ],
      history: [
        historyItem(clientId, "attachment_added", `Документ: ${fileName}`),
        ...data.history,
      ],
    })).then(visible),
};
