import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountSettings,
  AppData,
  Attachment,
  CaseHistoryItem,
  Client,
  ClientPatch,
  ClientStatus,
  HistoryType,
  NewClientInput,
  NotificationEvent,
  NotificationRecipient,
  Profile,
  Task,
} from "../../types/client";
import type { DataProvider } from "./types";
import { STATUS_LABELS } from "../statuses";

type Row = Record<string, any>;

const mapClient = (r: Row): Client => ({
  id: r.id,
  name: r.name,
  phone: r.phone ?? "",
  email: r.email ?? undefined,
  telegram: r.telegram ?? undefined,
  status: r.status,
  note: r.comment ?? undefined,
  caseType: r.case_type ?? undefined,
  responsibleLawyer: r.responsible_lawyer ?? undefined,
  priority: r.priority ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at ?? undefined,
});

const mapHistory = (r: Row): CaseHistoryItem => ({
  id: r.id,
  clientId: r.client_id,
  type: r.type,
  text: r.text ?? r.title ?? "",
  metadata: r.metadata ?? undefined,
  createdAt: r.created_at,
});

const mapTask = (r: Row): Task => ({
  id: r.id,
  clientId: r.client_id,
  title: r.title,
  dueDate: r.due_date ?? undefined,
  completed: r.completed,
  completedAt: r.completed_at ?? undefined,
  createdAt: r.created_at,
});

const mapAttachment = (r: Row): Attachment => ({
  id: r.id,
  clientId: r.client_id,
  fileName: r.file_name,
  fileUrl: r.file_url ?? undefined,
  storagePath: r.storage_path ?? undefined,
  uploadedAt: r.created_at,
});

const mapRecipient = (r: Row): NotificationRecipient => ({
  id: r.id,
  name: r.name,
  channel: r.channel,
  destination: r.destination,
  isActive: r.is_active,
});

const mapEvent = (r: Row): NotificationEvent => ({
  id: r.id,
  eventType: r.event_type,
  recipientId: r.recipient_id ?? undefined,
  channel: r.channel ?? undefined,
  status: r.status,
  error: r.error ?? undefined,
  createdAt: r.created_at,
  sentAt: r.sent_at ?? undefined,
});

export function createSupabaseProvider(sb: SupabaseClient): DataProvider {

  async function fetchAll(): Promise<AppData> {
    const [clients, history, tasks, attachments] = await Promise.all([
      sb
        .from("clients")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      sb.from("case_history").select("*").order("created_at", {
        ascending: false,
      }),
      sb.from("tasks").select("*").order("created_at"),
      sb.from("attachments").select("*").order("created_at"),
    ]);
    const firstError =
      clients.error ?? history.error ?? tasks.error ?? attachments.error;
    if (firstError) throw firstError;
    return {
      clients: (clients.data ?? []).map(mapClient),
      history: (history.data ?? []).map(mapHistory),
      tasks: (tasks.data ?? []).map(mapTask),
      attachments: (attachments.data ?? []).map(mapAttachment),
    };
  }

  async function logEvent(
    clientId: string,
    type: HistoryType,
    text: string,
    metadata?: Record<string, unknown>,
  ) {
    const { error } = await sb.from("case_history").insert({
      client_id: clientId,
      type,
      text,
      metadata: metadata ?? null,
    });
    if (error) throw error;
  }

  return {
    name: "supabase",
    fetchAll,

    async createClient(input: NewClientInput) {
      const { data, error } = await sb
        .from("clients")
        .insert({
          name: input.name.trim(),
          phone: input.phone.trim(),
          status: input.status,
          comment: input.note?.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await logEvent(data.id, "client_created", "Клиент добавлен");
      return fetchAll();
    },

    async updateClient(id: string, patch: ClientPatch) {
      const { error } = await sb
        .from("clients")
        .update({
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.phone !== undefined && { phone: patch.phone }),
          ...(patch.email !== undefined && { email: patch.email || null }),
          ...(patch.telegram !== undefined && {
            telegram: patch.telegram || null,
          }),
          ...(patch.note !== undefined && { comment: patch.note || null }),
          ...(patch.caseType !== undefined && {
            case_type: patch.caseType || null,
          }),
          ...(patch.responsibleLawyer !== undefined && {
            responsible_lawyer: patch.responsibleLawyer || null,
          }),
          ...(patch.priority !== undefined && {
            priority: patch.priority || null,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      await logEvent(id, "client_updated", "Данные клиента обновлены");
      return fetchAll();
    },

    async updateClientStatus(id: string, status: ClientStatus) {
      const { data: current, error: readError } = await sb
        .from("clients")
        .select("status")
        .eq("id", id)
        .single();
      if (readError) throw readError;
      if (current.status === status) return fetchAll();
      const { error } = await sb
        .from("clients")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await logEvent(
        id,
        "status_changed",
        `${STATUS_LABELS[current.status as ClientStatus]} → ${STATUS_LABELS[status]}`,
        { from: current.status, to: status },
      );
      return fetchAll();
    },

    async softDeleteClient(id: string) {
      const { error } = await sb
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return fetchAll();
    },

    async addNote(clientId: string, text: string) {
      await logEvent(clientId, "note_added", text);
      return fetchAll();
    },

    async createTask(clientId: string, title: string, dueDate?: string) {
      const { error } = await sb.from("tasks").insert({
        client_id: clientId,
        title: title.trim(),
        due_date: dueDate || null,
      });
      if (error) throw error;
      await logEvent(clientId, "task_created", `Задача: ${title}`);
      return fetchAll();
    },

    async toggleTask(taskId: string) {
      const { data: task, error: readError } = await sb
        .from("tasks")
        .select("client_id, title, completed")
        .eq("id", taskId)
        .single();
      if (readError) throw readError;
      const completed = !task.completed;
      const { error } = await sb
        .from("tasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      if (error) throw error;
      if (completed) {
        await logEvent(
          task.client_id,
          "task_completed",
          `Задача выполнена: ${task.title}`,
        );
      }
      return fetchAll();
    },

    async getProfile(): Promise<Profile> {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not authenticated");
      const { data, error } = await sb
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      return {
        id: uid,
        email: data?.email ?? auth.user?.email ?? "",
        fullName: data?.full_name ?? undefined,
        companyName: data?.company_name ?? undefined,
      };
    },

    async updateProfile(patch) {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not authenticated");
      const { error } = await sb
        .from("profiles")
        .update({
          full_name: patch.fullName?.trim() || null,
          company_name: patch.companyName?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", uid);
      if (error) throw error;
      return this.getProfile();
    },

    async getAccountSettings(): Promise<AccountSettings> {
      const { data, error } = await sb
        .from("account_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return {
        telegramEnabled: data?.telegram_enabled ?? true,
        notifyOnClientCreated: data?.notify_on_client_created ?? true,
        notifyOnTaskOverdue: data?.notify_on_task_overdue ?? true,
        notifyOnStatusChanged: data?.notify_on_status_changed ?? false,
      };
    },

    async updateAccountSettings(settings: AccountSettings) {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not authenticated");
      const { error } = await sb.from("account_settings").upsert({
        user_id: uid,
        telegram_enabled: settings.telegramEnabled,
        notify_on_client_created: settings.notifyOnClientCreated,
        notify_on_task_overdue: settings.notifyOnTaskOverdue,
        notify_on_status_changed: settings.notifyOnStatusChanged,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return settings;
    },

    async listRecipients() {
      const { data, error } = await sb
        .from("notification_recipients")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map(mapRecipient);
    },

    async addRecipient(input) {
      const { error } = await sb.from("notification_recipients").insert({
        name: input.name.trim(),
        destination: input.destination.trim(),
        channel: "telegram",
      });
      if (error) throw error;
      return this.listRecipients();
    },

    async updateRecipient(id, patch) {
      const { error } = await sb
        .from("notification_recipients")
        .update({ ...(patch.isActive !== undefined && { is_active: patch.isActive }) })
        .eq("id", id);
      if (error) throw error;
      return this.listRecipients();
    },

    async deleteRecipient(id) {
      const { error } = await sb
        .from("notification_recipients")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return this.listRecipients();
    },

    async listNotificationEvents(limit = 20) {
      const { data, error } = await sb
        .from("notification_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(mapEvent);
    },

    async addAttachment(clientId: string, fileName: string) {
      const { error } = await sb
        .from("attachments")
        .insert({ client_id: clientId, file_name: fileName });
      if (error) throw error;
      await logEvent(clientId, "attachment_added", `Документ: ${fileName}`);
      return fetchAll();
    },
  };
}
