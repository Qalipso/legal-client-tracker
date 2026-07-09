import { useState } from "react";
import type { ClientStatus } from "../types/client";
import { STATUS_LABELS, STATUS_ORDER } from "../lib/statuses";

type Props = {
  onAdd: (input: {
    name: string;
    phone: string;
    status: ClientStatus;
    note?: string;
  }) => void;
  onCancel: () => void;
};

export default function ClientForm({ onAdd, onCancel }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<ClientStatus>("new");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Укажите имя клиента";
    if (!phone.trim()) nextErrors.phone = "Укажите телефон";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onAdd({ name, phone, status, note: note || undefined });
    setName("");
    setPhone("");
    setStatus("new");
    setNote("");
    setErrors({});
  }

  const inputClass = (invalid?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 dark:text-slate-100 dark:focus:ring-slate-600 ${
      invalid
        ? "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
        : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
    }`;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Новый клиент
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="client-name"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Имя клиента *
          </label>
          <input
            id="client-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иван Петров"
            className={inputClass(errors.name)}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="client-phone"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Телефон *
          </label>
          <input
            id="client-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 999 123-45-67"
            className={inputClass(errors.phone)}
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.phone}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="client-status"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Статус дела
          </label>
          <select
            id="client-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ClientStatus)}
            className={inputClass()}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="client-note"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Комментарий
          </label>
          <input
            id="client-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ждёт документы"
            className={inputClass()}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Добавить
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
