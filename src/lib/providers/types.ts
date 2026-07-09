import type {
  AccountSettings,
  AppData,
  ClientPatch,
  ClientStatus,
  NewClientInput,
  NotificationEvent,
  NotificationRecipient,
  Profile,
  ReferenceData,
} from "../../types/client";

// The UI never talks to Supabase or localStorage directly — only to this
// interface. Every data mutation also writes its case_history event and
// returns the fresh AppData snapshot the UI should render.
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
  addAttachment(
    clientId: string,
    fileName: string,
    documentType?: string,
    documentStatus?: string,
  ): Promise<AppData>;

  // matter model (v0.4): key deadlines + open risks per client
  getReferenceData(): Promise<ReferenceData>;
  createDeadline(
    clientId: string,
    title: string,
    dueDate: string,
    deadlineType?: string,
  ): Promise<AppData>;
  toggleDeadline(deadlineId: string): Promise<AppData>;
  addRisk(clientId: string, text: string): Promise<AppData>;
  resolveRisk(riskId: string): Promise<AppData>;

  // account: profile, notification settings, recipients, delivery log
  getProfile(): Promise<Profile>;
  updateProfile(patch: {
    fullName?: string;
    companyName?: string;
  }): Promise<Profile>;
  getAccountSettings(): Promise<AccountSettings>;
  updateAccountSettings(settings: AccountSettings): Promise<AccountSettings>;
  listRecipients(): Promise<NotificationRecipient[]>;
  addRecipient(input: {
    name: string;
    destination: string;
  }): Promise<NotificationRecipient[]>;
  updateRecipient(
    id: string,
    patch: { isActive?: boolean },
  ): Promise<NotificationRecipient[]>;
  deleteRecipient(id: string): Promise<NotificationRecipient[]>;
  listNotificationEvents(limit?: number): Promise<NotificationEvent[]>;
}
