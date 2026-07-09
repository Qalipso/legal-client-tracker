export type ClientStatus = "new" | "in_progress" | "waiting_client" | "closed";

export type Client = {
  id: string;
  name: string;
  phone: string;
  status: ClientStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type HistoryType =
  | "created"
  | "note"
  | "status_change"
  | "attachment"
  | "task";

export type CaseHistoryItem = {
  id: string;
  clientId: string;
  type: HistoryType;
  text: string;
  createdAt: string;
};

export type Task = {
  id: string;
  clientId: string;
  title: string;
  dueDate?: string; // YYYY-MM-DD
  completed: boolean;
  createdAt: string;
};

export type Attachment = {
  id: string;
  clientId: string;
  fileName: string;
  uploadedAt: string;
};

export type AppData = {
  clients: Client[];
  history: CaseHistoryItem[];
  tasks: Task[];
  attachments: Attachment[];
};
