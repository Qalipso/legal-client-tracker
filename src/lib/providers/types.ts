import type {
  AppData,
  ClientPatch,
  ClientStatus,
  NewClientInput,
  NotificationSettings,
} from "../../types/client";

// The UI never talks to Supabase or localStorage directly — only to this
// interface. Every mutation also writes its case_history event and returns
// the fresh AppData snapshot the UI should render.
export interface DataProvider {
  readonly name: "supabase" | "localStorage";
  fetchAll(): Promise<AppData>;
  createClient(input: NewClientInput): Promise<AppData>;
  updateClient(id: string, patch: ClientPatch): Promise<AppData>;
  updateClientStatus(id: string, status: ClientStatus): Promise<AppData>;
  softDeleteClient(id: string): Promise<AppData>;
  addNote(clientId: string, text: string): Promise<AppData>;
  createTask(
    clientId: string,
    title: string,
    dueDate?: string,
  ): Promise<AppData>;
  toggleTask(taskId: string): Promise<AppData>;
  addAttachment(clientId: string, fileName: string): Promise<AppData>;
  getSettings(): Promise<NotificationSettings>;
  saveSettings(settings: NotificationSettings): Promise<NotificationSettings>;
}
