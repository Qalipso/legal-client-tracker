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
  MatterDeadline,
  MatterRisk,
  NewClientInput,
  NotificationEvent,
  NotificationRecipient,
  Profile,
  ReferenceData,
  ReferenceItem,
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
  matterTitle: r.matter_title ?? undefined,
  matterType: r.matter_type ?? undefined,
  matterSubject: r.matter_subject ?? undefined,
  stage: r.stage ?? undefined,
  counterparty: r.counterparty ?? undefined,
  keyDeadline: r.key_deadline ?? undefined,
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
  documentType: r.document_type ?? undefined,
  documentStatus: r.document_status ?? undefined,
  uploadedAt: r.created_at,
});

const mapDeadline = (r: Row): MatterDeadline => ({
  id: r.id,
  clientId: r.client_id,
  deadlineType: r.deadline_type ?? undefined,
  title: r.title,
  dueDate: r.due_date,
  completed: r.completed,
  completedAt: r.completed_at ?? undefined,
  note: r.note ?? undefined,
  createdAt: r.created_at,
});

const mapRisk = (r: Row): MatterRisk => ({
  id: r.id,
  clientId: r.client_id,
  text: r.text,
  isResolved: r.is_resolved,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at ?? undefined,
});

const mapReference = (r: Row): ReferenceItem => ({ code: r.code, label: r.label });

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
    const [clients, history, tasks, attachments, deadlines, risks] =
      await Promise.all([
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
        sb.from("matter_deadlines").select("*").order("due_date"),
        sb.from("matter_risks").select("*").order("created_at", {
          ascending: false,
        }),
      ]);
    const firstError =
      clients.error ??
      history.error ??
      tasks.error ??
      attachments.error ??
      deadlines.error ??
      risks.error;
    if (firstError) throw firstError;
    return {
      clients: (clients.data ?? []).map(mapClient),
      history: (history.data ?? []).map(mapHistory),
      tasks: (tasks.data ?? []).map(mapTask),
      attachments: (attachments.data ?? []).map(mapAttachment),
      deadlines: (deadlines.data ?? []).map(mapDeadline),
      risks: (risks.data ?? []).map(mapRisk),
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
          email: input.email?.trim() || null,
          telegram: input.telegram?.trim() || null,
          responsible_lawyer: input.responsibleLawyer?.trim() || null,
          priority: input.priority || null,
          matter_title: input.matterTitle?.trim() || null,
          matter_type: input.matterType || null,
          matter_subject: input.matterSubject?.trim() || null,
          stage: input.stage || null,
          counterparty: input.counterparty?.trim() || null,
          key_deadline: input.keyDeadline || null,
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
          ...(patch.matterTitle !== undefined && {
            matter_title: patch.matterTitle || null,
          }),
          ...(patch.matterType !== undefined && {
            matter_type: patch.matterType || null,
          }),
          ...(patch.matterSubject !== undefined && {
            matter_subject: patch.matterSubject || null,
          }),
          ...(patch.stage !== undefined && { stage: patch.stage || null }),
          ...(patch.counterparty !== undefined && {
            counterparty: patch.counterparty || null,
          }),
          ...(patch.keyDeadline !== undefined && {
            key_deadline: patch.keyDeadline || null,
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
        avatarUrl: data?.avatar_url ?? undefined,
        role: data?.role ?? "lawyer",
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

    async uploadAvatar(file: File) {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not authenticated");
      const ext = file.name.split(".").pop() || "png";
      const path = `${uid}/avatar.${ext}`;
      const { error: uploadError } = await sb.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data: pub } = sb.storage.from("avatars").getPublicUrl(path);
      // cache-bust so the header picks up the new photo immediately
      const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`;
      const { error } = await sb
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
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
        emailEnabled: data?.email_enabled ?? false,
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
        email_enabled: settings.emailEnabled,
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
        channel: input.channel ?? "telegram",
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

    async createTelegramConnectToken() {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not authenticated");
      const { data, error } = await sb
        .from("telegram_connect_tokens")
        .insert({ user_id: uid })
        .select("token")
        .single();
      if (error) throw error;
      return data.token;
    },

    async addAttachment(
      clientId: string,
      file: File,
      documentType?: string,
      documentStatus?: string,
    ) {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not authenticated");

      const attachmentId = crypto.randomUUID();
      const storagePath = `${uid}/${clientId}/${attachmentId}-${file.name}`;
      const { error: uploadError } = await sb.storage
        .from("case-documents")
        .upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { error } = await sb.from("attachments").insert({
        id: attachmentId,
        client_id: clientId,
        file_name: file.name,
        storage_path: storagePath,
        document_type: documentType || null,
        document_status: documentStatus || null,
      });
      if (error) throw error;
      await logEvent(clientId, "attachment_added", `Документ: ${file.name}`);
      return fetchAll();
    },

    async getAttachmentUrl(attachment) {
      if (!attachment.storagePath) return null;
      const { data, error } = await sb.storage
        .from("case-documents")
        .createSignedUrl(attachment.storagePath, 60); // 60s — just enough to open/download
      if (error) return null;
      return data.signedUrl;
    },

    async getReferenceData(): Promise<ReferenceData> {
      const [types, stages, docTypes, docStatuses, deadlineTypes] =
        await Promise.all([
          sb.from("matter_types").select("code,label").order("sort_order"),
          sb.from("matter_stages").select("code,label").order("sort_order"),
          sb.from("document_types").select("code,label").order("sort_order"),
          sb
            .from("document_statuses")
            .select("code,label")
            .order("sort_order"),
          sb.from("deadline_types").select("code,label").order("sort_order"),
        ]);
      const firstError =
        types.error ??
        stages.error ??
        docTypes.error ??
        docStatuses.error ??
        deadlineTypes.error;
      if (firstError) throw firstError;
      return {
        matterTypes: (types.data ?? []).map(mapReference),
        matterStages: (stages.data ?? []).map(mapReference),
        documentTypes: (docTypes.data ?? []).map(mapReference),
        documentStatuses: (docStatuses.data ?? []).map(mapReference),
        deadlineTypes: (deadlineTypes.data ?? []).map(mapReference),
      };
    },

    async createDeadline(
      clientId: string,
      title: string,
      dueDate: string,
      deadlineType?: string,
    ) {
      const { error } = await sb.from("matter_deadlines").insert({
        client_id: clientId,
        title: title.trim(),
        due_date: dueDate,
        deadline_type: deadlineType || null,
      });
      if (error) throw error;
      await logEvent(clientId, "task_created", `Срок: ${title} — ${dueDate}`);
      return fetchAll();
    },

    async toggleDeadline(deadlineId: string) {
      const { data: deadline, error: readError } = await sb
        .from("matter_deadlines")
        .select("client_id, title, completed")
        .eq("id", deadlineId)
        .single();
      if (readError) throw readError;
      const completed = !deadline.completed;
      const { error } = await sb
        .from("matter_deadlines")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", deadlineId);
      if (error) throw error;
      if (completed) {
        await logEvent(
          deadline.client_id,
          "task_completed",
          `Срок выполнен: ${deadline.title}`,
        );
      }
      return fetchAll();
    },

    async addRisk(clientId: string, text: string) {
      const { error } = await sb
        .from("matter_risks")
        .insert({ client_id: clientId, text: text.trim() });
      if (error) throw error;
      await logEvent(clientId, "note_added", `Риск: ${text}`);
      return fetchAll();
    },

    async resolveRisk(riskId: string) {
      const { data: risk, error: readError } = await sb
        .from("matter_risks")
        .select("client_id, text, is_resolved")
        .eq("id", riskId)
        .single();
      if (readError) throw readError;
      const isResolved = !risk.is_resolved;
      const { error } = await sb
        .from("matter_risks")
        .update({
          is_resolved: isResolved,
          resolved_at: isResolved ? new Date().toISOString() : null,
        })
        .eq("id", riskId);
      if (error) throw error;
      return fetchAll();
    },
  };
}
