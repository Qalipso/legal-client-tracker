import type {
  AppData,
  CaseHistoryItem,
  Client,
  ClientPatch,
  ClientStatus,
  HistoryType,
  MatterDeadline,
  MatterRisk,
  NewClientInput,
  NotificationEvent,
  NotificationRecipient,
  Profile,
} from "../../types/client";
import type { DataProvider } from "./types";
import { STATUS_LABELS } from "../statuses";
import { DEMO_REFERENCE_DATA } from "../matterReference";

const STORAGE_KEY = "legal-client-tracker:clients";
const SETTINGS_KEY = "legal-client-tracker:settings";

const emptyData: AppData = {
  clients: [],
  history: [],
  tasks: [],
  attachments: [],
  deadlines: [],
  risks: [],
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
      documentType: "contract",
      documentStatus: "under_review",
      uploadedAt: "2026-07-05T10:20:00.000Z",
    },
  ],
  deadlines: [
    {
      id: "d-seed-3",
      clientId: "seed-3",
      deadlineType: "claim_response",
      title: "Ответ на претензию",
      dueDate: "2026-07-08",
      completed: false,
      createdAt: "2026-07-05T16:45:00.000Z",
    },
  ],
  risks: [
    {
      id: "r-seed-2",
      clientId: "seed-2",
      text: "Контрагент может оспорить пункт о неустойке",
      isResolved: false,
      createdAt: "2026-07-05T10:05:00.000Z",
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
  // v3 → v4: matter model adds deadlines/risks arrays, missing on old saves
  return {
    ...emptyData,
    ...data,
    history,
    deadlines: data.deadlines ?? [],
    risks: data.risks ?? [],
  };
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

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode — value lives for the session only
  }
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
        email: input.email?.trim() || undefined,
        telegram: input.telegram?.trim() || undefined,
        responsibleLawyer: input.responsibleLawyer?.trim() || undefined,
        priority: input.priority,
        matterTitle: input.matterTitle?.trim() || undefined,
        matterType: input.matterType,
        matterSubject: input.matterSubject?.trim() || undefined,
        stage: input.stage,
        counterparty: input.counterparty?.trim() || undefined,
        keyDeadline: input.keyDeadline,
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

  // demo-mode account: everything lives in localStorage, no auth
  getProfile: () =>
    Promise.resolve({
      id: "demo",
      email: "demo@local",
      role: "lawyer",
      ...readJson<Partial<Profile>>(`${SETTINGS_KEY}:profile`, {}),
    } as Profile),

  async updateProfile(patch) {
    const current = readJson<Partial<Profile>>(`${SETTINGS_KEY}:profile`, {});
    writeJson(`${SETTINGS_KEY}:profile`, { ...current, ...patch });
    return this.getProfile();
  },

  async uploadAvatar(file: File) {
    // demo-mode: no real storage, just a data URL kept in localStorage
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const current = readJson<Partial<Profile>>(`${SETTINGS_KEY}:profile`, {});
    writeJson(`${SETTINGS_KEY}:profile`, { ...current, avatarUrl: dataUrl });
    return this.getProfile();
  },

  getAccountSettings: () =>
    Promise.resolve(
      readJson(`${SETTINGS_KEY}:account`, {
        telegramEnabled: true,
        emailEnabled: false,
        notifyOnClientCreated: true,
        notifyOnTaskOverdue: true,
        notifyOnStatusChanged: false,
      }),
    ),

  updateAccountSettings: (settings) => {
    writeJson(`${SETTINGS_KEY}:account`, settings);
    return Promise.resolve(settings);
  },

  listRecipients: () =>
    Promise.resolve(
      readJson<NotificationRecipient[]>(`${SETTINGS_KEY}:recipients`, []),
    ),

  addRecipient(input) {
    const list = readJson<NotificationRecipient[]>(
      `${SETTINGS_KEY}:recipients`,
      [],
    );
    list.push({
      id: crypto.randomUUID(),
      name: input.name.trim(),
      channel: input.channel ?? "telegram",
      destination: input.destination.trim(),
      isActive: true,
    });
    writeJson(`${SETTINGS_KEY}:recipients`, list);
    return Promise.resolve(list);
  },

  updateRecipient(id, patch) {
    const list = readJson<NotificationRecipient[]>(
      `${SETTINGS_KEY}:recipients`,
      [],
    ).map((r) =>
      r.id === id ? { ...r, ...(patch.isActive !== undefined && { isActive: patch.isActive }) } : r,
    );
    writeJson(`${SETTINGS_KEY}:recipients`, list);
    return Promise.resolve(list);
  },

  deleteRecipient(id) {
    const list = readJson<NotificationRecipient[]>(
      `${SETTINGS_KEY}:recipients`,
      [],
    ).filter((r) => r.id !== id);
    writeJson(`${SETTINGS_KEY}:recipients`, list);
    return Promise.resolve(list);
  },

  listNotificationEvents: (limit = 20) =>
    Promise.resolve(
      readJson<NotificationEvent[]>(`${SETTINGS_KEY}:events`, []).slice(
        0,
        limit,
      ),
    ),

  createTelegramConnectToken() {
    // No live webhook to consume a token in demo-mode — nothing to connect
    // to. Callers should hide the "Подключить Telegram" button when
    // provider.name !== "supabase" rather than call this.
    return Promise.reject(
      new Error("Telegram connect недоступен в demo-режиме"),
    );
  },

  async addAttachment(
    clientId: string,
    file: File,
    documentType?: string,
    documentStatus?: string,
  ) {
    // demo-mode: small files get a real data URL (openable/downloadable);
    // larger ones just keep the name, to avoid blowing localStorage's quota
    const DEMO_MAX_BYTES = 2 * 1024 * 1024;
    const dataUrl =
      file.size <= DEMO_MAX_BYTES
        ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }).catch(() => undefined)
        : undefined;

    return mutate((data) => ({
      ...data,
      attachments: [
        ...data.attachments,
        {
          id: crypto.randomUUID(),
          clientId,
          fileName: file.name,
          fileUrl: dataUrl,
          documentType,
          documentStatus,
          uploadedAt: new Date().toISOString(),
        },
      ],
      history: [
        historyItem(clientId, "attachment_added", `Документ: ${file.name}`),
        ...data.history,
      ],
    })).then(visible);
  },

  getAttachmentUrl: (attachment) => Promise.resolve(attachment.fileUrl ?? null),

  getReferenceData: () => Promise.resolve(DEMO_REFERENCE_DATA),

  createDeadline: (
    clientId: string,
    title: string,
    dueDate: string,
    deadlineType?: string,
  ) =>
    mutate((data) => {
      const deadline: MatterDeadline = {
        id: crypto.randomUUID(),
        clientId,
        deadlineType,
        title: title.trim(),
        dueDate,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      return {
        ...data,
        deadlines: [...data.deadlines, deadline],
        history: [
          historyItem(clientId, "task_created", `Срок: ${title} — ${dueDate}`),
          ...data.history,
        ],
      };
    }).then(visible),

  toggleDeadline: (deadlineId: string) =>
    mutate((data) => {
      const deadline = data.deadlines.find((d) => d.id === deadlineId);
      if (!deadline) return data;
      const completed = !deadline.completed;
      return {
        ...data,
        deadlines: data.deadlines.map((d) =>
          d.id === deadlineId
            ? {
                ...d,
                completed,
                completedAt: completed ? new Date().toISOString() : undefined,
              }
            : d,
        ),
        history: completed
          ? [
              historyItem(
                deadline.clientId,
                "task_completed",
                `Срок выполнен: ${deadline.title}`,
              ),
              ...data.history,
            ]
          : data.history,
      };
    }).then(visible),

  addRisk: (clientId: string, text: string) =>
    mutate((data) => {
      const risk: MatterRisk = {
        id: crypto.randomUUID(),
        clientId,
        text: text.trim(),
        isResolved: false,
        createdAt: new Date().toISOString(),
      };
      return {
        ...data,
        risks: [risk, ...data.risks],
        history: [
          historyItem(clientId, "note_added", `Риск: ${text}`),
          ...data.history,
        ],
      };
    }).then(visible),

  resolveRisk: (riskId: string) =>
    mutate((data) => ({
      ...data,
      risks: data.risks.map((r) =>
        r.id === riskId
          ? {
              ...r,
              isResolved: !r.isResolved,
              resolvedAt: !r.isResolved ? new Date().toISOString() : undefined,
            }
          : r,
      ),
    })).then(visible),
};
