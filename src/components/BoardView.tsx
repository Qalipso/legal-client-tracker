import type { Client, Task } from "../types/client";
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from "../lib/statuses";
import { formatDate, isOverdue, nextTask } from "../lib/clients";

type Props = {
  clients: Client[];
  tasks: Task[];
  onOpenClient: (id: string) => void;
};

export default function BoardView({ clients, tasks, onOpenClient }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATUS_ORDER.map((status) => {
        const columnClients = clients.filter((c) => c.status === status);
        return (
          <div
            key={status}
            className="flex flex-col gap-3 rounded-xl bg-slate-200/60 p-3"
          >
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[status].dot}`}
                />
                <h3 className="text-sm font-semibold text-slate-700">
                  {STATUS_LABELS[status]}
                </h3>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                {columnClients.length}
              </span>
            </div>

            {columnClients.length === 0 && (
              <p className="px-1 py-4 text-center text-xs text-slate-400">
                Нет дел
              </p>
            )}

            {columnClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                next={nextTask(tasks, client.id)}
                onOpen={() => onOpenClient(client.id)}
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
}: {
  client: Client;
  next?: Task;
  onOpen: () => void;
}) {
  const overdue = next ? isOverdue(next) : false;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md ${
        overdue ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
      }`}
    >
      <p className="text-sm font-semibold text-slate-900">{client.name}</p>
      <p className="mt-0.5 text-xs text-slate-500">{client.phone}</p>
      {client.note && (
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">
          {client.note}
        </p>
      )}
      {next && (
        <p
          className={`mt-2 text-xs font-medium ${
            overdue ? "text-red-600" : "text-slate-700"
          }`}
        >
          → {next.title}
          {next.dueDate && (
            <span className={overdue ? "" : "text-slate-400"}>
              {" "}
              · до {formatDate(next.dueDate)}
              {overdue && " (просрочено)"}
            </span>
          )}
        </p>
      )}
      <p className="mt-2 text-[11px] text-slate-400">
        Добавлен {formatDate(client.createdAt)}
      </p>
    </button>
  );
}
