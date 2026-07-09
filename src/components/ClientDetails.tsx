import { useState } from "react";
import type {
  Attachment,
  CaseHistoryItem,
  Client,
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
  onAddNote: (clientId: string, text: string) => void;
  onAddTask: (clientId: string, title: string, dueDate?: string) => void;
  onToggleTask: (taskId: string) => void;
  onAddAttachment: (clientId: string, fileName: string) => void;
};

const HISTORY_ICONS: Record<HistoryType, string> = {
  created: "●",
  note: "✎",
  status_change: "⇄",
  attachment: "📎",
  task: "☑",
};

export default function ClientDetails({
  client,
  history,
  tasks,
  attachments,
  onClose,
  onStatusChange,
  onDelete,
  onAddNote,
  onAddTask,
  onToggleTask,
  onAddAttachment,
}: Props) {
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const clientHistory = history
    .filter((h) => h.clientId === client.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const statusHistory = clientHistory.filter(
    (h) => h.type === "status_change",
  );
  const clientTasks = tasks
    .filter((t) => t.clientId === client.id)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const clientAttachments = attachments.filter(
    (a) => a.clientId === client.id,
  );

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    onAddNote(client.id, note.trim());
    setNote("");
  }

  function submitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask(client.id, taskTitle.trim(), taskDue || undefined);
    setTaskTitle("");
    setTaskDue("");
  }

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
        <div className="sticky top-0 border-b border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {client.name}
              </h2>
              <p className="text-sm text-slate-500">{client.phone}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть карточку"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-500 hover:bg-slate-50"
            >
              ✕
            </button>
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
                onStatusChange(client.id, e.target.value as ClientStatus)
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
          {/* basic info */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Основная информация
            </h3>
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">Телефон</dt>
              <dd className="text-slate-900">{client.phone}</dd>
              <dt className="text-slate-500">Комментарий</dt>
              <dd className="text-slate-900">{client.note ?? "—"}</dd>
              <dt className="text-slate-500">Добавлен</dt>
              <dd className="text-slate-900">{formatDate(client.createdAt)}</dd>
              <dt className="text-slate-500">Обновлён</dt>
              <dd className="text-slate-900">{formatDate(client.updatedAt)}</dd>
            </dl>
          </section>

          {/* next actions */}
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

          {/* notes */}
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

          {/* attachments */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Документы
            </h3>
            <ul className="mt-2 flex flex-col gap-1">
              {clientAttachments.length === 0 && (
                <li className="text-sm text-slate-400">Нет документов</li>
              )}
              {clientAttachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between text-sm"
                >
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

          {/* case history timeline */}
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

          {/* status history */}
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

          <button
            type="button"
            onClick={() => onDelete(client.id)}
            className="mt-2 self-start rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Удалить клиента
          </button>
        </div>
      </aside>
    </>
  );
}
