import { useState } from "react";
import type {
  Attachment,
  CaseHistoryItem,
  Client,
  ClientPatch,
  ClientPriority,
  ClientStatus,
  HistoryType,
  Task,
} from "../types/client";
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from "../lib/statuses";
import { formatDate, formatDateTime, isOverdue } from "../lib/clients";

type Props = {
  client: Client;
  history: CaseHistoryItem[];
  tasks: Task[];
  attachments: Attachment[];
  onClose: () => void;
  onStatusChange: (id: string, status: ClientStatus) => void;
  onDelete: (id: string) => void;
  onUpdateClient: (id: string, patch: ClientPatch) => void;
  onAddNote: (clientId: string, text: string) => void;
  onAddTask: (clientId: string, title: string, dueDate?: string) => void;
  onToggleTask: (taskId: string) => void;
  onAddAttachment: (clientId: string, fileName: string) => void;
};

const HISTORY_ICONS: Record<HistoryType, string> = {
  client_created: "●",
  client_updated: "✎",
  note_added: "✎",
  status_changed: "⇄",
  attachment_added: "📎",
  task_created: "☑",
  task_completed: "✔",
};

const PRIORITY_LABELS: Record<ClientPriority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

export default function ClientDetails(props: Props) {
  const { client, onClose } = props;
  const [editing, setEditing] = useState(false);

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label={`Карточка дела: ${client.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
      >
        {/* header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {client.name}
              </h2>
              <p className="text-sm text-slate-500">{client.phone}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
                className={`rounded-lg border px-2.5 py-1 text-sm ${
                  editing
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {editing ? "Просмотр" : "Редактировать"}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть карточку"
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-500 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[client.status].badge}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[client.status].dot}`}
              />
              {STATUS_LABELS[client.status]}
            </span>
            <select
              value={client.status}
              onChange={(e) =>
                props.onStatusChange(client.id, e.target.value as ClientStatus)
              }
              aria-label="Изменить статус дела"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-6 p-4 pb-8">
          {editing ? (
            <EditForm
              client={client}
              onSave={(patch) => {
                props.onUpdateClient(client.id, patch);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <InfoSection client={client} />
          )}

          <TasksSection {...props} />
          <NoteSection {...props} />
          <AttachmentsSection {...props} />
          <HistorySection {...props} />

          <button
            type="button"
            onClick={() => props.onDelete(client.id)}
            className="mt-2 self-start rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Удалить клиента
          </button>
        </div>
      </aside>
    </>
  );
}

function InfoSection({ client }: { client: Client }) {
  const rows: [string, string | undefined][] = [
    ["Телефон", client.phone],
    ["Email", client.email],
    ["Telegram", client.telegram],
    ["Тип дела", client.caseType],
    ["Ответственный", client.responsibleLawyer],
    ["Приоритет", client.priority && PRIORITY_LABELS[client.priority]],
    ["Комментарий", client.note],
    ["Добавлен", formatDate(client.createdAt)],
    ["Обновлён", formatDate(client.updatedAt)],
  ];
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Основная информация
      </h3>
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-slate-900">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EditForm({
  client,
  onSave,
  onCancel,
}: {
  client: Client;
  onSave: (patch: ClientPatch) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Required<Omit<ClientPatch, "priority">> & {
    priority: ClientPriority | "";
  }>({
    name: client.name,
    phone: client.phone,
    email: client.email ?? "",
    telegram: client.telegram ?? "",
    note: client.note ?? "",
    caseType: client.caseType ?? "",
    responsibleLawyer: client.responsibleLawyer ?? "",
    priority: client.priority ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const field = (label: string, key: keyof typeof form, type = "text") => (
    <div>
      <label
        htmlFor={`edit-${key}`}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <input
        id={`edit-${key}`}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
      />
    </div>
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Имя не может быть пустым");
    if (!form.phone.trim()) return setError("Телефон не может быть пустым");
    setError(null);
    onSave({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      telegram: form.telegram.trim() || undefined,
      note: form.note.trim() || undefined,
      caseType: form.caseType.trim() || undefined,
      responsibleLawyer: form.responsibleLawyer.trim() || undefined,
      priority: form.priority || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Редактирование клиента
      </h3>
      {field("Имя клиента *", "name")}
      {field("Телефон *", "phone", "tel")}
      {field("Email", "email", "email")}
      {field("Telegram", "telegram")}
      {field("Тип дела", "caseType")}
      {field("Ответственный юрист", "responsibleLawyer")}
      <div>
        <label
          htmlFor="edit-priority"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Приоритет
        </label>
        <select
          id="edit-priority"
          value={form.priority}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              priority: e.target.value as ClientPriority | "",
            }))
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">Не задан</option>
          {(Object.keys(PRIORITY_LABELS) as ClientPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      {field("Комментарий", "note")}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function TasksSection({
  client,
  tasks,
  onAddTask,
  onToggleTask,
}: Props) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const clientTasks = tasks
    .filter((t) => t.clientId === client.id)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  function submitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask(client.id, taskTitle.trim(), taskDue || undefined);
    setTaskTitle("");
    setTaskDue("");
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Следующие действия
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {clientTasks.length === 0 && (
          <li className="text-sm text-slate-400">Нет задач</li>
        )}
        {clientTasks.map((task) => {
          const overdue = isOverdue(task);
          return (
            <li key={task.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => onToggleTask(task.id)}
                aria-label={`Задача: ${task.title}`}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span
                className={
                  task.completed
                    ? "text-slate-400 line-through"
                    : "text-slate-800"
                }
              >
                {task.title}
              </span>
              {task.dueDate && (
                <span
                  className={`ml-auto whitespace-nowrap text-xs ${
                    overdue ? "font-medium text-red-600" : "text-slate-400"
                  }`}
                >
                  до {formatDate(task.dueDate)}
                  {overdue && " · просрочено"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <form onSubmit={submitTask} className="mt-3 flex gap-2">
        <input
          type="text"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          placeholder="Позвонить клиенту…"
          aria-label="Новая задача"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <input
          type="date"
          value={taskDue}
          onChange={(e) => setTaskDue(e.target.value)}
          aria-label="Срок задачи"
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          +
        </button>
      </form>
    </section>
  );
}

function NoteSection({ client, onAddNote }: Props) {
  const [note, setNote] = useState("");

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    onAddNote(client.id, note.trim());
    setNote("");
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Добавить заметку
      </h3>
      <form onSubmit={submitNote} className="mt-2 flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Клиент просит проверить договор до пятницы…"
          aria-label="Новая заметка"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          +
        </button>
      </form>
    </section>
  );
}

function AttachmentsSection({ client, attachments, onAddAttachment }: Props) {
  const clientAttachments = attachments.filter(
    (a) => a.clientId === client.id,
  );
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Документы
      </h3>
      <ul className="mt-2 flex flex-col gap-1">
        {clientAttachments.length === 0 && (
          <li className="text-sm text-slate-400">Нет документов</li>
        )}
        {clientAttachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-800">📎 {a.fileName}</span>
            <span className="text-xs text-slate-400">
              {formatDate(a.uploadedAt)}
            </span>
          </li>
        ))}
      </ul>
      <label className="mt-2 inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
        Прикрепить файл
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAddAttachment(client.id, file.name);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-1 text-[11px] text-slate-400">
        Прототип: сохраняется только имя файла, без содержимого.
      </p>
    </section>
  );
}

function HistorySection({ client, history }: Props) {
  const clientHistory = history
    .filter((h) => h.clientId === client.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const statusHistory = clientHistory.filter(
    (h) => h.type === "status_changed",
  );
  return (
    <>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          История дела
        </h3>
        <ol className="mt-2 flex flex-col gap-2 border-l border-slate-200 pl-4">
          {clientHistory.map((h) => (
            <li key={h.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-slate-300 text-[8px] text-white" />
              <p className="text-slate-800">
                <span className="mr-1">{HISTORY_ICONS[h.type]}</span>
                {h.text}
              </p>
              <p className="text-xs text-slate-400">
                {formatDateTime(h.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          История статусов
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {statusHistory.length === 0 && (
            <li className="text-slate-400">Статус ещё не менялся</li>
          )}
          {statusHistory.map((h) => (
            <li key={h.id} className="flex justify-between">
              <span className="text-slate-800">{h.text}</span>
              <span className="text-xs text-slate-400">
                {formatDate(h.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
