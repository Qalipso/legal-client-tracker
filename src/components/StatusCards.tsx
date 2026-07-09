import type { Client, ClientStatus } from "../types/client";
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from "../lib/statuses";

type Props = {
  clients: Client[];
};

export default function StatusCards({ clients }: Props) {
  const counts = clients.reduce(
    (acc, c) => {
      acc[c.status] += 1;
      return acc;
    },
    { new: 0, in_progress: 0, waiting_client: 0, closed: 0 } as Record<
      ClientStatus,
      number
    >,
  );

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {STATUS_ORDER.map((status) => (
        <div
          key={status}
          className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${STATUS_STYLES[status].card}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[status].dot}`}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {STATUS_LABELS[status]}
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {counts[status]}
          </p>
        </div>
      ))}
      <div className="rounded-xl border border-slate-300 bg-slate-900 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-100">
        <span className="text-sm text-slate-300 dark:text-slate-600">
          Всего клиентов
        </span>
        <p className="mt-2 text-3xl font-semibold text-white dark:text-slate-900">
          {clients.length}
        </p>
      </div>
    </section>
  );
}
