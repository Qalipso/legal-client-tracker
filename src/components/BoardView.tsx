import { useState } from "react";
import type { Client, ClientStatus, Task } from "../types/client";
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from "../lib/statuses";
import { formatDate, isOverdue, nextTask } from "../lib/clients";

type Props = {
  clients: Client[];
  tasks: Task[];
  onOpenClient: (id: string) => void;
  onStatusChange: (id: string, status: ClientStatus) => void;
};

export default function BoardView({
  clients,
  tasks,
  onOpenClient,
  onStatusChange,
}: Props) {
  const [dragOver, setDragOver] = useState<ClientStatus | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATUS_ORDER.map((status) => {
        const columnClients = clients.filter((c) => c.status === status);
        const style = STATUS_STYLES[status];
        const isTarget = dragOver === status;
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOver(status);
            }}
            onDragLeave={(e) => {
              // only clear when actually leaving the column, not entering a child
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOver((v) => (v === status ? null : v));
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              setDragging(false);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onStatusChange(id, status);
            }}
            className={`flex flex-col gap-3 rounded-xl border p-3 transition ${style.column} ${
              isTarget
                ? "ring-2 ring-slate-400 ring-offset-2"
                : dragging
                  ? "border-dashed"
                  : ""
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${style.dot}`}
                >
                  {style.icon}
                </span>
                <h3 className={`text-sm font-semibold ${style.columnHeader}`}>
                  {STATUS_LABELS[status]}
                </h3>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                {columnClients.length}
              </span>
            </div>

            {columnClients.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 px-1 py-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                {dragging ? "Перетащите сюда" : "Нет дел"}
              </p>
            )}

            {columnClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                next={nextTask(tasks, client.id)}
                onOpen={() => onOpenClient(client.id)}
                onDragStart={() => setDragging(true)}
                onDragEnd={() => {
                  setDragging(false);
                  setDragOver(null);
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ClientCard({
  client,
  next,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  client: Client;
  next?: Task;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const overdue = next ? isOverdue(next) : false;
  const accent = STATUS_STYLES[client.status].cardAccent;
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", client.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`cursor-grab rounded-lg border border-l-4 bg-white p-3 text-left shadow-sm transition hover:shadow-md active:cursor-grabbing dark:bg-slate-900 dark:hover:shadow-none ${accent} ${
        overdue
          ? "border-red-300 ring-1 ring-red-200 dark:border-red-800 dark:ring-red-900/50"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {client.name}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {client.phone}
      </p>
      {client.note && (
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
          {client.note}
        </p>
      )}
      {next && (
        <p
          className={`mt-2 text-xs font-medium ${
            overdue
              ? "text-red-600 dark:text-red-400"
              : "text-slate-700 dark:text-slate-300"
          }`}
        >
          → {next.title}
          {next.dueDate && (
            <span className={overdue ? "" : "text-slate-400 dark:text-slate-500"}>
              {" "}
              · до {formatDate(next.dueDate)}
              {overdue && " (просрочено)"}
            </span>
          )}
        </p>
      )}
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        Добавлен {formatDate(client.createdAt)}
      </p>
    </button>
  );
}
