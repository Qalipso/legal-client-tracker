import type { ClientStatus } from "../types/client";
import { STATUS_LABELS, STATUS_ORDER } from "../lib/statuses";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: ClientStatus | "all";
  onStatusFilterChange: (value: ClientStatus | "all") => void;
};

export default function Filters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Поиск по имени, телефону или статусу…"
        aria-label="Поиск по клиентам"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 sm:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-600"
      />
      <select
        value={statusFilter}
        onChange={(e) =>
          onStatusFilterChange(e.target.value as ClientStatus | "all")
        }
        aria-label="Фильтр по статусу"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-600"
      >
        <option value="all">Все статусы</option>
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
