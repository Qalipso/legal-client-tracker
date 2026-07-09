export type ClientStatus = "new" | "in_progress" | "waiting_client" | "closed";

export type ClientPriority = "low" | "medium" | "high";

export type Client = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  telegram?: string;
  status: ClientStatus;
  note?: string;
  caseType?: string;
  responsibleLawyer?: string;
  priority?: ClientPriority;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

// editable profile fields (everything except status/dates — those have
// their own flows so that history events stay accurate)
export type ClientPatch = Partial<
  Pick<
    Client,
    | "name"
    | "phone"
    | "email"
    | "telegram"
    | "note"
    | "caseType"
    | "responsibleLawyer"
    | "priority"
  >
>;

export type HistoryType =
  | "client_created"
  | "client_updated"
  | "note_added"
  | "status_changed"
  | "task_created"
  | "task_completed"
  | "attachment_added";

export type CaseHistoryItem = {
  id: string;
  clientId: string;
  type: HistoryType;
  text: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type Task = {
  id: string;
  clientId: string;
  title: string;
  dueDate?: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  clientId: string;
  fileName: string;
  fileUrl?: string;
  storagePath?: string;
  uploadedAt: string;
};

export type AppData = {
  clients: Client[];
  history: CaseHistoryItem[];
  tasks: Task[];
  attachments: Attachment[];
};

export type NotificationSettings = {
  telegramChatId?: string;
  notifyOnNewClient: boolean;
};

export type NewClientInput = {
  name: string;
  phone: string;
  status: ClientStatus;
  note?: string;
};
