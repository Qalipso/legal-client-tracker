import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppData, ClientStatus } from "./types/client";
import {
  createClient,
  createHistoryItem,
  createTask,
  loadData,
  saveData,
} from "./lib/clients";
import { STATUS_LABELS } from "./lib/statuses";
import StatusCards from "./components/StatusCards";
import ClientForm from "./components/ClientForm";
import Filters from "./components/Filters";
import ClientTable from "./components/ClientTable";
import BoardView from "./components/BoardView";
import ClientDetails from "./components/ClientDetails";
import Toast from "./components/Toast";

type ViewMode = "table" | "board";

const VIEW_KEY = "legal-client-tracker:view";

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) || "board",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">(
    "all",
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const dismissToast = useCallback(() => setToast(null), []);

  function handleAdd(input: {
    name: string;
    phone: string;
    status: ClientStatus;
    note?: string;
  }) {
    const client = createClient(input);
    setData((prev) => ({
      ...prev,
      clients: [client, ...prev.clients],
      history: [
        createHistoryItem(client.id, "created", "Клиент добавлен"),
        ...prev.history,
      ],
    }));
    setShowForm(false);
    setToast("Клиент добавлен");
  }

  function handleStatusChange(id: string, status: ClientStatus) {
    setData((prev) => {
      const client = prev.clients.find((c) => c.id === id);
      if (!client || client.status === status) return prev;
      return {
        ...prev,
        clients: prev.clients.map((c) =>
          c.id === id
            ? { ...c, status, updatedAt: new Date().toISOString() }
            : c,
        ),
        history: [
          createHistoryItem(
            id,
            "status_change",
            `${STATUS_LABELS[client.status]} → ${STATUS_LABELS[status]}`,
          ),
          ...prev.history,
        ],
      };
    });
    setToast("Статус обновлён");
  }

  function handleDelete(id: string) {
    const client = data.clients.find((c) => c.id === id);
    if (!client) return;
    if (!window.confirm(`Удалить клиента «${client.name}»?`)) return;
    setData((prev) => ({
      clients: prev.clients.filter((c) => c.id !== id),
      history: prev.history.filter((h) => h.clientId !== id),
      tasks: prev.tasks.filter((t) => t.clientId !== id),
      attachments: prev.attachments.filter((a) => a.clientId !== id),
    }));
    setSelectedId(null);
    setToast("Клиент удалён");
  }

  function handleAddNote(clientId: string, text: string) {
    setData((prev) => ({
      ...prev,
      history: [createHistoryItem(clientId, "note", text), ...prev.history],
    }));
    setToast("Заметка добавлена");
  }

  function handleAddTask(clientId: string, title: string, dueDate?: string) {
    const task = createTask(clientId, title, dueDate);
    setData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, task],
      history: [
        createHistoryItem(clientId, "task", `Задача: ${title}`),
        ...prev.history,
      ],
    }));
    setToast("Задача добавлена");
  }

  function handleToggleTask(taskId: string) {
    setData((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      const completed = !task.completed;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, completed } : t,
        ),
        history: completed
          ? [
              createHistoryItem(
                task.clientId,
                "task",
                `Задача выполнена: ${task.title}`,
              ),
              ...prev.history,
            ]
          : prev.history,
      };
    });
  }

  function handleAddAttachment(clientId: string, fileName: string) {
    setData((prev) => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        {
          id: crypto.randomUUID(),
          clientId,
          fileName,
          uploadedAt: new Date().toISOString(),
        },
      ],
      history: [
        createHistoryItem(clientId, "attachment", `Документ: ${fileName}`),
        ...prev.history,
      ],
    }));
    setToast("Документ прикреплён");
  }

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.clients.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!query) return true;
      return (
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        STATUS_LABELS[c.status].toLowerCase().includes(query)
      );
    });
  }, [data.clients, search, statusFilter]);

  const selectedClient =
    data.clients.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Legal Client Tracker
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Доска ведения дел: клиенты, статусы, история и следующие шаги.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
          >
            {showForm ? "Скрыть форму" : "+ Добавить клиента"}
          </button>
        </header>

        <main className="mt-6 flex flex-col gap-6">
          <StatusCards clients={data.clients} />

          {showForm && (
            <ClientForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Filters
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
            <div
              role="group"
              aria-label="Вид"
              className="flex shrink-0 rounded-lg border border-slate-300 bg-white p-0.5"
            >
              {(
                [
                  ["board", "Доска"],
                  ["table", "Таблица"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  aria-pressed={view === mode}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    view === mode
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {view === "board" ? (
            <BoardView
              clients={visibleClients}
              tasks={data.tasks}
              onOpenClient={setSelectedId}
            />
          ) : (
            <ClientTable
              clients={visibleClients}
              totalCount={data.clients.length}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onOpenClient={setSelectedId}
            />
          )}
        </main>

        <footer className="mt-8 text-center text-xs text-slate-400">
          Данные хранятся локально в вашем браузере (localStorage).
        </footer>
      </div>

      {selectedClient && (
        <ClientDetails
          client={selectedClient}
          history={data.history}
          tasks={data.tasks}
          attachments={data.attachments}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onAddNote={handleAddNote}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onAddAttachment={handleAddAttachment}
        />
      )}

      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
