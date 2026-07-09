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
  /** @deprecated freeform v0.2 field, kept for old rows — use matterType */
  caseType?: string;
  responsibleLawyer?: string;
  priority?: ClientPriority;
  // matter fields (v0.4) — dictionary-backed, see ReferenceData
  matterTitle?: string;
  matterType?: string; // code from matter_types
  matterSubject?: string;
  stage?: string; // code from matter_stages
  counterparty?: string;
  keyDeadline?: string; // YYYY-MM-DD
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
    | "matterTitle"
    | "matterType"
    | "matterSubject"
    | "stage"
    | "counterparty"
    | "keyDeadline"
  >
>;

// a dictionary entry: matter type, stage, document type/status, deadline type
export type ReferenceItem = { code: string; label: string };

export type ReferenceData = {
  matterTypes: ReferenceItem[];
  matterStages: ReferenceItem[];
  documentTypes: ReferenceItem[];
  documentStatuses: ReferenceItem[];
  deadlineTypes: ReferenceItem[];
};

export type MatterDeadline = {
  id: string;
  clientId: string;
  deadlineType?: string; // code from deadline_types
  title: string;
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
  note?: string;
  createdAt: string;
};

export type MatterRisk = {
  id: string;
  clientId: string;
  text: string;
  isResolved: boolean;
  createdAt: string;
  resolvedAt?: string;
};

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
  documentType?: string; // code from document_types
  documentStatus?: string; // code from document_statuses
  uploadedAt: string;
};

export type AppData = {
  clients: Client[];
  history: CaseHistoryItem[];
  tasks: Task[];
  attachments: Attachment[];
  deadlines: MatterDeadline[];
  risks: MatterRisk[];
};

export type UserRole = "admin" | "lawyer" | "assistant";

export type Profile = {
  id: string;
  email: string;
  fullName?: string;
  companyName?: string;
  avatarUrl?: string;
  role: UserRole;
};

export type AccountSettings = {
  telegramEnabled: boolean;
  notifyOnClientCreated: boolean;
  notifyOnTaskOverdue: boolean;
  notifyOnStatusChanged: boolean;
};

export type NotificationRecipient = {
  id: string;
  name: string;
  channel: "telegram";
  destination: string; // telegram chat_id
  isActive: boolean;
};

export type NotificationEvent = {
  id: string;
  eventType: string;
  recipientId?: string;
  channel?: string;
  status: "sent" | "error" | "skipped";
  error?: string;
  createdAt: string;
  sentAt?: string;
};

// base fields from the quick-add form + everything importable from CSV
export type NewClientInput = {
  name: string;
  phone: string;
  status: ClientStatus;
  note?: string;
  email?: string;
  telegram?: string;
  responsibleLawyer?: string;
  priority?: ClientPriority;
  matterTitle?: string;
  matterType?: string;
  matterSubject?: string;
  stage?: string;
  counterparty?: string;
  keyDeadline?: string;
};
