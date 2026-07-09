import { useState } from "react";
import type {
  Attachment,
  CaseHistoryItem,
  Client,
  ClientPatch,
  ClientPriority,
  ClientStatus,
  HistoryType,
  MatterDeadline,
  MatterRisk,
  ReferenceData,
  Task,
} from "../types/client";
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from "../lib/statuses";
import { formatDate, formatDateTime, isOverdue } from "../lib/clients";

type Props = {
  client: Client;
  history: CaseHistoryItem[];
  tasks: Task[];
  attachments: Attachment[];
  deadlines: MatterDeadline[];
  risks: MatterRisk[];
  referenceData: ReferenceData;
  onClose: () => void;
  onStatusChange: (id: string, status: ClientStatus) => void;
  onDelete: (id: string) => void;
  onUpdateClient: (id: string, patch: ClientPatch) => void;
  onAddNote: (clientId: string, text: string) => void;
  onAddTask: (clientId: string, title: string, dueDate?: string) => void;
  onToggleTask: (taskId: string) => void;
  onAddAttachment: (
    clientId: string,
    file: File,
    documentType?: string,
    documentStatus?: string,
  ) => Promise<void>;
  onGetAttachmentUrl: (attachment: Attachment) => Promise<string | null>;
  onAddDeadline: (
    clientId: string,
    title: string,
    dueDate: string,
    deadlineType?: string,
  ) => void;
  onToggleDeadline: (deadlineId: string) => void;
  onAddRisk: (clientId: string, text: string) => void;
  onResolveRisk: (riskId: string) => void;
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

function label(items: { code: string; label: string }[], code?: string) {
  return items.find((i) => i.code === code)?.label ?? code;
}

export default function ClientDetails(props: Props) {
  const { client, onClose } = props;
  const [editing, setEditing] = useState(false);

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 dark:bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label={`Карточка дела: ${client.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl lg:max-w-xl xl:max-w-2xl dark:bg-slate-900"
      >
        {/* header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {client.matterTitle || client.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {client.matterTitle ? client.name : client.phone}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
                className={`rounded-lg border px-2.5 py-1 text-sm ${
                  editing
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {editing ? "Просмотр" : "Редактировать"}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть карточку"
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[client.status].badge}`}
            >
              <span aria-hidden="true">
                {STATUS_STYLES[client.status].icon}
              </span>
              {STATUS_LABELS[client.status]}
            </span>
            <select
              value={client.status}
              onChange={(e) =>
                props.onStatusChange(client.id, e.target.value as ClientStatus)
              }
              aria-label="Изменить статус дела"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 pb-8 sm:p-5">
          {editing ? (
            <EditForm
              client={client}
              referenceData={props.referenceData}
              onSave={(patch) => {
                props.onUpdateClient(client.id, patch);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <MatterSummarySection {...props} />
              <PartiesSection {...props} />
            </>
          )}

          <TasksSection {...props} />
          <DeadlinesSection {...props} />
          <RisksSection {...props} />
          <NoteSection {...props} />
          <DocumentsSection {...props} />
          <HistorySection {...props} />

          <button
            type="button"
            onClick={() => props.onDelete(client.id)}
            className="mt-2 self-start rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Удалить клиента
          </button>
        </div>
      </aside>
    </>
  );
}

// "Сводка дела" — matter identity: title, type, subject, stage, key deadline
function MatterSummarySection({ client, referenceData }: Props) {
  const hasMatterData =
    client.matterTitle ||
    client.matterType ||
    client.matterSubject ||
    client.stage ||
    client.keyDeadline;
  const deadlineOverdue =
    client.keyDeadline && new Date(`${client.keyDeadline}T23:59:59`) < new Date();

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Сводка дела
      </h3>
      {!hasMatterData ? (
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
          Данные дела не заполнены — нажмите «Редактировать».
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {client.matterType && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {label(referenceData.matterTypes, client.matterType)}
              </span>
            )}
            {client.stage && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                {label(referenceData.matterStages, client.stage)}
              </span>
            )}
            {client.priority && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                Приоритет: {PRIORITY_LABELS[client.priority]}
              </span>
            )}
          </div>
          {client.matterSubject && (
            <p className="text-sm text-slate-800 dark:text-slate-200">{client.matterSubject}</p>
          )}
          {client.keyDeadline && (
            <p
              className={`text-sm font-medium ${deadlineOverdue ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}`}
            >
              Контрольный срок: {formatDate(client.keyDeadline)}
              {deadlineOverdue && " · просрочен"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// "Стороны" — доверитель (client contacts) + контрагент
function PartiesSection({ client }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Стороны
      </h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Доверитель</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {client.name}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{client.phone}</p>
          {client.email && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{client.email}</p>
          )}
          {client.telegram && (
            <p className="text-sm text-slate-600 dark:text-slate-300">TG: {client.telegram}</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Контрагент</p>
          <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
            {client.counterparty || "—"}
          </p>
        </div>
      </div>
      {(client.responsibleLawyer || client.note) && (
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {client.responsibleLawyer && (
            <>
              <dt className="text-slate-500 dark:text-slate-400">Ответственный</dt>
              <dd className="text-slate-900 dark:text-slate-100">{client.responsibleLawyer}</dd>
            </>
          )}
          {client.note && (
            <>
              <dt className="text-slate-500 dark:text-slate-400">Комментарий</dt>
              <dd className="text-slate-900 dark:text-slate-100">{client.note}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}

function EditForm({
  client,
  referenceData,
  onSave,
  onCancel,
}: {
  client: Client;
  referenceData: ReferenceData;
  onSave: (patch: ClientPatch) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<
    Required<Omit<ClientPatch, "priority">> & { priority: ClientPriority | "" }
  >({
    name: client.name,
    phone: client.phone,
    email: client.email ?? "",
    telegram: client.telegram ?? "",
    note: client.note ?? "",
    caseType: client.caseType ?? "",
    responsibleLawyer: client.responsibleLawyer ?? "",
    priority: client.priority ?? "",
    matterTitle: client.matterTitle ?? "",
    matterType: client.matterType ?? "",
    matterSubject: client.matterSubject ?? "",
    stage: client.stage ?? "",
    counterparty: client.counterparty ?? "",
    keyDeadline: client.keyDeadline ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const field = (label: string, key: keyof typeof form, type = "text") => (
    <div>
      <label
        htmlFor={`edit-${key}`}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <input
        id={`edit-${key}`}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
      />
    </div>
  );

  const selectField = (
    labelText: string,
    key: keyof typeof form,
    options: { code: string; label: string }[],
  ) => (
    <div>
      <label
        htmlFor={`edit-${key}`}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {labelText}
      </label>
      <select
        id={`edit-${key}`}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
      >
        <option value="">Не задан</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
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
      matterTitle: form.matterTitle.trim() || undefined,
      matterType: form.matterType || undefined,
      matterSubject: form.matterSubject.trim() || undefined,
      stage: form.stage || undefined,
      counterparty: form.counterparty.trim() || undefined,
      keyDeadline: form.keyDeadline || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Сводка дела
      </h3>
      {field("Название дела", "matterTitle")}
      <div className="grid gap-3 sm:grid-cols-2">
        {selectField("Тип дела", "matterType", referenceData.matterTypes)}
        {selectField("Стадия", "stage", referenceData.matterStages)}
      </div>
      {field("Предмет дела", "matterSubject")}
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Контрольный срок", "keyDeadline", "date")}
        <div>
          <label
            htmlFor="edit-priority"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
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
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
          >
            <option value="">Не задан</option>
            {(Object.keys(PRIORITY_LABELS) as ClientPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h3 className="mt-3 mb-1 border-t border-slate-200 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Стороны
      </h3>
      {field("Имя доверителя *", "name")}
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Телефон *", "phone", "tel")}
        {field("Контрагент", "counterparty")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Email", "email", "email")}
        {field("Telegram", "telegram")}
      </div>
      {field("Ответственный юрист", "responsibleLawyer")}
      {field("Комментарий", "note")}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function TasksSection({ client, tasks, onAddTask, onToggleTask }: Props) {
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
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Следующие действия
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {clientTasks.length === 0 && (
          <li className="text-sm text-slate-400 dark:text-slate-500">Нет задач</li>
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
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              />
              <span
                className={
                  task.completed
                    ? "text-slate-400 line-through dark:text-slate-500"
                    : "text-slate-800 dark:text-slate-200"
                }
              >
                {task.title}
              </span>
              {task.dueDate && (
                <span
                  className={`ml-auto whitespace-nowrap text-xs ${
                    overdue
                      ? "font-medium text-red-600 dark:text-red-400"
                      : "text-slate-400 dark:text-slate-500"
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
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
        />
        <input
          type="date"
          value={taskDue}
          onChange={(e) => setTaskDue(e.target.value)}
          aria-label="Срок задачи"
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus:ring-slate-600"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          +
        </button>
      </form>
    </section>
  );
}

// "Контрольные сроки" — typed legal deadlines, distinct from ad-hoc tasks above
function DeadlinesSection({
  client,
  deadlines,
  referenceData,
  onAddDeadline,
  onToggleDeadline,
}: Props) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState("");
  const clientDeadlines = deadlines
    .filter((d) => d.clientId === client.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    onAddDeadline(client.id, title.trim(), dueDate, type || undefined);
    setTitle("");
    setDueDate("");
    setType("");
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Контрольные сроки
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {clientDeadlines.length === 0 && (
          <li className="text-sm text-slate-400 dark:text-slate-500">Нет контрольных сроков</li>
        )}
        {clientDeadlines.map((d) => {
          const overdue = !d.completed && new Date(`${d.dueDate}T23:59:59`) < new Date();
          return (
            <li key={d.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.completed}
                onChange={() => onToggleDeadline(d.id)}
                aria-label={`Срок: ${d.title}`}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              />
              <span
                className={
                  d.completed ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                }
              >
                {d.title}
                {d.deadlineType && (
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                    ({label(referenceData.deadlineTypes, d.deadlineType)})
                  </span>
                )}
              </span>
              <span
                className={`ml-auto whitespace-nowrap text-xs ${
                  overdue ? "font-medium text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                до {formatDate(d.dueDate)}
                {overdue && " · просрочено"}
              </span>
            </li>
          );
        })}
      </ul>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Подать апелляцию…"
            aria-label="Новый контрольный срок"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Дата срока"
            required
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus:ring-slate-600"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Тип срока"
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus:ring-slate-600"
          >
            <option value="">Тип срока (необязательно)</option>
            {referenceData.deadlineTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            +
          </button>
        </div>
      </form>
    </section>
  );
}

// "Риски / открытые вопросы"
function RisksSection({ client, risks, onAddRisk, onResolveRisk }: Props) {
  const [text, setText] = useState("");
  const clientRisks = risks
    .filter((r) => r.clientId === client.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onAddRisk(client.id, text.trim());
    setText("");
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Риски / открытые вопросы
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {clientRisks.length === 0 && (
          <li className="text-sm text-slate-400 dark:text-slate-500">Нет открытых вопросов</li>
        )}
        {clientRisks.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={r.isResolved}
              onChange={() => onResolveRisk(r.id)}
              aria-label={`Риск: ${r.text}`}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600"
            />
            <span
              className={
                r.isResolved
                  ? "text-slate-400 line-through dark:text-slate-500"
                  : "text-slate-800 dark:text-slate-200"
              }
            >
              {r.text}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Контрагент может оспорить условие…"
          aria-label="Новый риск"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
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
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Добавить заметку
      </h3>
      <form onSubmit={submitNote} className="mt-2 flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Клиент просит проверить договор до пятницы…"
          aria-label="Новая заметка"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          +
        </button>
      </form>
    </section>
  );
}

function DocumentsSection({
  client,
  attachments,
  referenceData,
  onAddAttachment,
  onGetAttachmentUrl,
}: Props) {
  const [docType, setDocType] = useState("");
  const [docStatus, setDocStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const clientAttachments = attachments.filter(
    (a) => a.clientId === client.id,
  );

  async function openAttachment(a: Attachment) {
    setOpeningId(a.id);
    try {
      const url = await onGetAttachmentUrl(a);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Документы
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {clientAttachments.length === 0 && (
          <li className="text-sm text-slate-400 dark:text-slate-500">Нет документов</li>
        )}
        {clientAttachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => openAttachment(a)}
              disabled={openingId === a.id}
              className="text-left text-slate-800 hover:underline disabled:opacity-50 dark:text-slate-200"
            >
              📎 {a.fileName}
              {openingId === a.id && (
                <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">открываю…</span>
              )}
              {a.documentType && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {label(referenceData.documentTypes, a.documentType)}
                </span>
              )}
              {a.documentStatus && (
                <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  {label(referenceData.documentStatuses, a.documentStatus)}
                </span>
              )}
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {formatDate(a.uploadedAt)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          aria-label="Тип документа"
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus:ring-slate-600"
        >
          <option value="">Тип документа</option>
          {referenceData.documentTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={docStatus}
          onChange={(e) => setDocStatus(e.target.value)}
          aria-label="Статус документа"
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus:ring-slate-600"
        >
          <option value="">Статус документа</option>
          {referenceData.documentStatuses.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          {uploading ? "Загрузка…" : "Прикрепить файл"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploading(true);
              try {
                await onAddAttachment(
                  client.id,
                  file,
                  docType || undefined,
                  docStatus || undefined,
                );
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
        Файл сохраняется вместе с содержимым и доступен только вам.
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
      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          История дела
        </h3>
        <ol className="mt-2 flex flex-col gap-2 border-l border-slate-200 pl-4 dark:border-slate-700">
          {clientHistory.map((h) => (
            <li key={h.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-slate-300 text-[8px] text-white dark:bg-slate-600" />
              <p className="text-slate-800 dark:text-slate-200">
                <span className="mr-1">{HISTORY_ICONS[h.type]}</span>
                {h.text}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {formatDateTime(h.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          История статусов
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {statusHistory.length === 0 && (
            <li className="text-slate-400 dark:text-slate-500">Статус ещё не менялся</li>
          )}
          {statusHistory.map((h) => (
            <li key={h.id} className="flex justify-between">
              <span className="text-slate-800 dark:text-slate-200">{h.text}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatDate(h.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
