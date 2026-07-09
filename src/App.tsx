import { useCallback, useEffect, useMemo, useState } from "react";
import type { Client, ClientStatus } from "./types/client";
import { createClient, loadClients, saveClients } from "./lib/clients";
import { STATUS_LABELS } from "./lib/statuses";
import StatusCards from "./components/StatusCards";
import ClientForm from "./components/ClientForm";
import Filters from "./components/Filters";
import ClientTable from "./components/ClientTable";
import Toast from "./components/Toast";

export default function App() {
  const [clients, setClients] = useState<Client[]>(() => loadClients());
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">(
    "all",
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveClients(clients);
  }, [clients]);

  const dismissToast = useCallback(() => setToast(null), []);

  function handleAdd(input: {
    name: string;
    phone: string;
    status: ClientStatus;
    note?: string;
  }) {
    setClients((prev) => [createClient(input), ...prev]);
    setShowForm(false);
    setToast("Клиент добавлен");
  }

  function handleStatusChange(id: string, status: ClientStatus) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status, updatedAt: new Date().toISOString() }
          : c,
      ),
    );
    setToast("Статус обновлён");
  }

  function handleDelete(id: string) {
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    if (!window.confirm(`Удалить клиента «${client.name}»?`)) return;
    setClients((prev) => prev.filter((c) => c.id !== id));
    setToast("Клиент удалён");
  }

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!query) return true;
      return (
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        STATUS_LABELS[c.status].toLowerCase().includes(query)
      );
    });
  }, [clients, search, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Legal Client Tracker
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Клиенты, статусы дел и текущая загрузка — в одном месте.
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
          <StatusCards clients={clients} />

          {showForm && (
            <ClientForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
          )}

          <Filters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />

          <ClientTable
            clients={visibleClients}
            totalCount={clients.length}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        </main>

        <footer className="mt-8 text-center text-xs text-slate-400">
          Данные хранятся локально в вашем браузере (localStorage).
        </footer>
      </div>

      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
