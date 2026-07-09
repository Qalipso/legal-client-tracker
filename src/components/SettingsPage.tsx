import { useEffect, useState } from "react";
import type {
  AccountSettings,
  NewClientInput,
  NotificationEvent,
  NotificationRecipient,
  Profile,
  UserRole,
} from "../types/client";
import type { DataProvider } from "../lib/providers";
import { sendTestNotification } from "../lib/notify";
import { formatDateTime } from "../lib/clients";
import { STATUS_ORDER } from "../lib/statuses";
import { parseCsv, toCsv } from "../lib/csv";
import { downloadIcs, toIcs } from "../lib/ics";

type Props = {
  provider: DataProvider;
  onBack: () => void;
  onLogout: () => void;
  onToast: (message: string) => void;
  onProfileChange: (profile: Profile) => void;
};

const EVENT_LABELS: Record<string, string> = {
  "client.created": "Новый клиент",
  "task.created": "Новая задача",
  "task.overdue": "Просроченная задача",
  "status.changed": "Смена статуса",
  test: "Тест",
};

const STATUS_BADGES: Record<NotificationEvent["status"], string> = {
  sent: "bg-emerald-50 text-emerald-700",
  error: "bg-red-50 text-red-700",
  skipped: "bg-slate-100 text-slate-500",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  lawyer: "Юрист",
  assistant: "Ассистент",
};

const EXPORT_COLUMNS = [
  "name",
  "phone",
  "email",
  "telegram",
  "status",
  "note",
  "matterTitle",
  "matterType",
  "matterSubject",
  "stage",
  "counterparty",
  "keyDeadline",
  "priority",
  "responsibleLawyer",
] as const;

export default function SettingsPage({
  provider,
  onBack,
  onLogout,
  onToast,
  onProfileChange,
}: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChatId, setNewChatId] = useState("");
  const [newChannel, setNewChannel] = useState<"telegram" | "email">(
    "telegram",
  );
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const isAssistant = profile?.role === "assistant";

  useEffect(() => {
    Promise.all([
      provider.getProfile(),
      provider.getAccountSettings(),
      provider.listRecipients(),
      provider.listNotificationEvents(15),
    ])
      .then(([p, s, r, e]) => {
        setProfile(p);
        setSettings(s);
        setRecipients(r);
        setEvents(e);
      })
      .catch(() => setLoadError(true));
  }, [provider]);

  async function saveProfile() {
    if (!profile) return;
    try {
      const updated = await provider.updateProfile({
        fullName: profile.fullName,
        companyName: profile.companyName,
      });
      setProfile(updated);
      onProfileChange(updated);
      onToast("Профиль сохранён");
    } catch {
      onToast("Не удалось сохранить профиль");
    }
  }

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const updated = await provider.uploadAvatar(file);
      setProfile(updated);
      onProfileChange(updated);
      onToast("Фото обновлено");
    } catch {
      onToast("Не удалось загрузить фото");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function exportCsv() {
    // client-side only: reads the currently loaded snapshot via a fresh
    // fetch so the export always reflects the latest data
    provider.fetchAll().then((data) => {
      const rows = data.clients.map((c) =>
        Object.fromEntries(
          EXPORT_COLUMNS.map((col) => [col, String((c as any)[col] ?? "")]),
        ),
      );
      const csv = toCsv(rows, [...EXPORT_COLUMNS]);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onToast(`Экспортировано ${rows.length} клиентов`);
    });
  }

  function exportCalendar() {
    provider.fetchAll().then((data) => {
      const clientName = (clientId: string) =>
        data.clients.find((c) => c.id === clientId)?.name ?? "";
      const openTasks = data.tasks
        .filter((t) => t.dueDate && !t.completed)
        .map((t) => ({
          id: `task-${t.id}`,
          dueDate: t.dueDate!,
          title: `${t.title} — ${clientName(t.clientId)}`,
        }));
      const openDeadlines = data.deadlines
        .filter((d) => !d.completed)
        .map((d) => ({
          id: `deadline-${d.id}`,
          dueDate: d.dueDate,
          title: `${d.title} — ${clientName(d.clientId)}`,
          description: "Контрольный срок по делу",
        }));
      const items = [...openTasks, ...openDeadlines];
      const ics = toIcs(items, "Legal Client Tracker — сроки и задачи");
      downloadIcs(ics, `legal-client-tracker-${new Date().toISOString().slice(0, 10)}.ics`);
      onToast(
        items.length > 0
          ? `Экспортировано ${items.length} событий в календарь`
          : "Нет открытых задач/сроков для экспорта",
      );
    });
  }

  async function handleImportSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      let created = 0;
      let skipped = 0;
      for (const row of rows) {
        if (!row.name?.trim() || !row.phone?.trim()) {
          skipped++;
          continue;
        }
        const status = STATUS_ORDER.includes(row.status as any)
          ? (row.status as NewClientInput["status"])
          : "new";
        await provider.createClient({
          name: row.name,
          phone: row.phone,
          status,
          note: row.note || undefined,
          email: row.email || undefined,
          telegram: row.telegram || undefined,
          responsibleLawyer: row.responsibleLawyer || undefined,
          priority: (row.priority as any) || undefined,
          matterTitle: row.matterTitle || undefined,
          matterType: row.matterType || undefined,
          matterSubject: row.matterSubject || undefined,
          stage: row.stage || undefined,
          counterparty: row.counterparty || undefined,
          keyDeadline: row.keyDeadline || undefined,
        });
        created++;
      }
      setImportSummary(
        `Импортировано: ${created}. Пропущено (нет имени/телефона): ${skipped}.`,
      );
      onToast(`Импорт завершён: ${created} клиентов добавлено`);
    } catch {
      setImportSummary("Не удалось разобрать файл — проверьте формат CSV.");
    } finally {
      setImporting(false);
    }
  }

  async function toggleSetting(key: keyof AccountSettings) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try {
      await provider.updateAccountSettings(next);
    } catch {
      setSettings(settings);
      onToast("Не удалось сохранить настройки");
    }
  }

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newChatId.trim() || isAssistant) return;
    try {
      setRecipients(
        await provider.addRecipient({
          name: newName,
          destination: newChatId,
          channel: newChannel,
        }),
      );
      setNewName("");
      setNewChatId("");
      onToast("Получатель добавлен");
    } catch {
      onToast("Не удалось добавить получателя");
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    const r = await sendTestNotification();
    const failReason =
      r.reason ??
      r.errors?.[0] ??
      (r.errors?.length === 0 ? undefined : "неизвестная причина");
    setTestResult(
      r.sent
        ? `✅ Отправлено (доставлено: ${r.delivered ?? 1})`
        : `Не отправлено: ${failReason}${
            r.errors?.[0]?.includes("chat not found")
              ? " — напишите боту любое сообщение (боты не могут писать первыми) и проверьте chat ID"
              : ""
          }`,
    );
    setEvents(await provider.listNotificationEvents(15).catch(() => events));
    setTesting(false);
  }

  const activeRecipients = recipients.filter((r) => r.isActive).length;
  const lastEvent = events[0];

  const toggle = (
    label: string,
    key: keyof AccountSettings,
  ) => (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={settings ? Boolean(settings[key]) : false}
        onChange={() => toggleSetting(key)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
            <p className="mt-1 text-sm text-slate-500">
              Профиль, уведомления, получатели, импорт/экспорт и история
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← К доске
          </button>
        </header>

        {loadError && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Не удалось загрузить настройки. Обновите страницу.
          </p>
        )}

        <main className="mt-6 flex flex-col gap-6">
          {/* Profile */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Профиль</h2>
            {profile && (
              <>
                <div className="mt-3 flex items-center gap-4">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white">
                      {(profile.fullName || profile.email).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <label className="inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      {uploadingAvatar ? "Загрузка…" : "Сделать фото / загрузить"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="hidden"
                        disabled={uploadingAvatar}
                        onChange={handleAvatarSelect}
                      />
                    </label>
                    <p className="mt-1 text-xs text-slate-400">
                      На телефоне откроется камера; на десктопе — выбор файла.
                    </p>
                  </div>
                  <span className="ml-auto rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>
                {isAssistant && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Роль «Ассистент»: нельзя удалять клиентов и менять
                    настройки уведомлений. Роль назначается администратором
                    вне приложения (пока нет команды/workspace).
                  </p>
                )}
              </>
            )}
            {profile && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="pf-name" className="mb-1 block text-sm font-medium text-slate-700">
                    Имя
                  </label>
                  <input
                    id="pf-name"
                    type="text"
                    value={profile.fullName ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, fullName: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label htmlFor="pf-company" className="mb-1 block text-sm font-medium text-slate-700">
                    Компания
                  </label>
                  <input
                    id="pf-company"
                    type="text"
                    value={profile.companyName ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, companyName: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label htmlFor="pf-email" className="mb-1 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="pf-email"
                    type="email"
                    value={profile.email}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={saveProfile}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Выйти
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Notifications */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* stacks on mobile — a long status pill next to a short title
                used to wrap awkwardly above the heading on narrow screens */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold">Уведомления</h2>
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                  settings?.telegramEnabled && activeRecipients > 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Telegram: {settings?.telegramEnabled ? "включён" : "выключен"} ·
                получателей: {activeRecipients}
                {lastEvent &&
                  ` · последняя: ${lastEvent.status === "sent" ? "✅" : lastEvent.status === "error" ? "❌" : "—"}`}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {toggle("Telegram-уведомления включены", "telegramEnabled")}
              {toggle("Email-уведомления включены", "emailEnabled")}
              {toggle("Новый клиент", "notifyOnClientCreated")}
              {toggle("Просроченная задача", "notifyOnTaskOverdue")}
              {toggle("Смена статуса дела", "notifyOnStatusChanged")}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Email-уведомления: доставка через Resend ещё не подключена
              (нет API-ключа) — переключатель сохраняется, но письма не
              отправляются, пока администратор не настроит RESEND_API_KEY /
              RESEND_FROM_EMAIL в секретах Supabase.
            </p>
          </section>

          {/* Recipients */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Получатели</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {recipients.length === 0 && (
                <li className="text-sm text-slate-400">
                  Пока нет получателей. Напишите{" "}
                  <span className="font-medium text-slate-600">/start</span>{" "}
                  своему Telegram-боту — он ответит вашим chat ID (или узнайте
                  его у{" "}
                  <a
                    href="https://t.me/userinfobot"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    @userinfobot
                  </a>
                  ).
                </li>
              )}
              {recipients.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className={r.isActive ? "" : "text-slate-400 line-through"}>
                    <span className="font-medium">{r.name}</span>{" "}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {r.channel === "email" ? "email" : "telegram"}
                    </span>{" "}
                    <span className="text-slate-500">· {r.destination}</span>
                  </span>
                  {!isAssistant && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () =>
                          setRecipients(
                            await provider.updateRecipient(r.id, {
                              isActive: !r.isActive,
                            }),
                          )
                        }
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {r.isActive ? "Отключить" : "Включить"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Удалить получателя «${r.name}»?`)) return;
                          setRecipients(await provider.deleteRecipient(r.id));
                        }}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Удалить
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {!isAssistant && (
              <form onSubmit={addRecipient} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select
                  value={newChannel}
                  onChange={(e) =>
                    setNewChannel(e.target.value as "telegram" | "email")
                  }
                  aria-label="Канал получателя"
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="telegram">Telegram</option>
                  <option value="email">Email</option>
                </select>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Имя (Юрист Эдуард)"
                  aria-label="Имя получателя"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                />
                <input
                  type="text"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  placeholder={
                    newChannel === "email" ? "Email адрес" : "Telegram chat ID"
                  }
                  aria-label={
                    newChannel === "email" ? "Email адрес" : "Telegram chat ID"
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Добавить
                </button>
              </form>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={runTest}
                disabled={testing}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {testing ? "Отправка…" : "Отправить тест"}
              </button>
              {testResult && (
                <span
                  className={`text-sm ${testResult.startsWith("✅") ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {testResult}
                </span>
              )}
            </div>
          </section>

          {/* Import / export */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Данные</h2>
            <p className="mt-1 text-sm text-slate-500">
              Экспорт клиентов в CSV или импорт из CSV (колонки:{" "}
              {EXPORT_COLUMNS.join(", ")}).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Экспорт в CSV
              </button>
              <label className="inline-block cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {importing ? "Импорт…" : "Импорт из CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  disabled={importing}
                  onChange={handleImportSelect}
                />
              </label>
              {importSummary && (
                <span className="text-sm text-slate-600">{importSummary}</span>
              )}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={exportCalendar}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                📅 Экспорт сроков и задач (.ics)
              </button>
              <p className="mt-1 text-[11px] text-slate-400">
                Скачивает открытые задачи и контрольные сроки как .ics —
                импортируйте в Google Calendar (Настройки → Импорт и экспорт
                → Импорт) или любой другой календарь. Это разовый экспорт,
                не живая синхронизация.
              </p>
            </div>
          </section>

          {/* Notification history */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">История уведомлений</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {events.length === 0 && (
                <li className="text-sm text-slate-400">Пока нет попыток отправки</li>
              )}
              {events.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800">
                    {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                    {ev.error && (
                      <span className="ml-2 text-xs text-red-500">{ev.error}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[ev.status]}`}
                    >
                      {ev.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDateTime(ev.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
