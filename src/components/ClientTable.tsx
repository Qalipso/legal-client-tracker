import type { Client, ClientStatus } from "../types/client";
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from "../lib/statuses";
import { formatDate } from "../lib/clients";

type Props = {
  clients: Client[];
  totalCount: number;
  onStatusChange: (id: string, status: ClientStatus) => void;
  onDelete: (id: string) => void;
  onOpenClient: (id: string) => void;
};

export default function ClientTable({
  clients,
  totalCount,
  onStatusChange,
  onDelete,
  onOpenClient,
}: Props) {
  if (totalCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Пока нет клиентов. Нажмите «Добавить клиента», чтобы создать первого.
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Ничего не найдено. Измените поиск или фильтр.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Имя клиента</th>
            <th className="px-4 py-3 font-medium">Телефон</th>
            <th className="px-4 py-3 font-medium">Статус дела</th>
            <th className="px-4 py-3 font-medium">Комментарий</th>
            <th className="px-4 py-3 font-medium">Дата добавления</th>
            <th className="px-4 py-3 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onOpenClient(client.id)}
                  className="font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  {client.name}
                </button>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                {client.phone}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[client.status].badge}`}
                >
                  <span aria-hidden="true">
                    {STATUS_STYLES[client.status].icon}
                  </span>
                  {STATUS_LABELS[client.status]}
                </span>
              </td>
              <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">
                {client.note ?? "—"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                {formatDate(client.createdAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <select
                    value={client.status}
                    onChange={(e) =>
                      onStatusChange(client.id, e.target.value as ClientStatus)
                    }
                    aria-label={`Изменить статус: ${client.name}`}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onDelete(client.id)}
                    aria-label={`Удалить клиента: ${client.name}`}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
