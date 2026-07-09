import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppData,
  ClientPatch,
  ClientStatus,
  NewClientInput,
} from "./types/client";
import { getProvider } from "./lib/providers";
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

const emptyData: AppData = {
  clients: [],
  history: [],
  tasks: [],
  attachments: [],
};

export default function App() {
  const provider = useRef(getProvider()).current;
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
    provider
      .fetchAll()
      .then(setData)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [provider]);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const dismissToast = useCallback(() => setToast(null), []);

  // every mutation returns the fresh snapshot; on failure the UI keeps
  // its previous state and reports the error instead of pretending
  async function run(action: Promise<AppData>, message: string) {
    try {
      setData(await action);
      setToast(message);
    } catch {
      setToast("Ошибка сохранения — попробуйте ещё раз");
    }
  }

  function handleAdd(input: NewClientInput) {
    setShowForm(false);
    void run(provider.createClient(input), "Клиент добавлен");
  }

  function handleUpdateClient(id: string, patch: ClientPatch) {
    void run(provider.updateClient(id, patch), "Данные клиента обновлены");
  }

  function handleStatusChange(id: string, status: ClientStatus) {
    void run(provider.updateClientStatus(id, status), "Статус обновлён");
  }

  function handleDelete(id: string) {
    const client = data.clients.find((c) => c.id === id);
    if (!client) return;
    if (!window.confirm(`Удалить клиента «${client.name}»?`)) return;
    setSelectedId(null);
    void run(provider.softDeleteClient(id), "Клиент удалён");
  }

  function handleAddNote(clientId: string, text: string) {
    void run(provider.addNote(clientId, text), "Заметка добавлена");
  }

  function handleAddTask(clientId: string, title: string, dueDate?: string) {
    void run(provider.createTask(clientId, title, dueDate), "Задача добавлена");
  }

  function handleToggleTask(taskId: string) {
    void run(provider.toggleTask(taskId), "Задача обновлена");
  }

  function handleAddAttachment(clientId: string, fileName: string) {
    void run(
      provider.addAttachment(clientId, fileName),
      "Документ прикреплён",
    );
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
          {loading && (
            <p className="py-16 text-center text-sm text-slate-400">
              Загрузка данных…
            </p>
          )}
          {loadError && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
              Не удалось загрузить данные. Проверьте подключение и обновите
              страницу.
            </p>
          )}
          {!loading && !loadError && (
            <>
              <StatusCards clients={data.clients} />

              {showForm && (
                <ClientForm
                  onAdd={handleAdd}
                  onCancel={() => setShowForm(false)}
                />
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
            </>
          )}
        </main>

        <footer className="mt-8 text-center text-xs text-slate-400">
          {provider.name === "supabase"
            ? "Данные хранятся в Supabase (PostgreSQL)."
            : "Demo-режим: данные хранятся локально в вашем браузере (localStorage)."}
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
          onUpdateClient={handleUpdateClient}
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
