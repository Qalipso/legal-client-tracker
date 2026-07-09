import { useEffect, useState } from "react";
import type {
  AccountSettings,
  NotificationEvent,
  NotificationRecipient,
  Profile,
} from "../types/client";
import type { DataProvider } from "../lib/providers";
import { sendTestNotification } from "../lib/notify";
import { formatDateTime } from "../lib/clients";

type Props = {
  provider: DataProvider;
  onBack: () => void;
  onLogout: () => void;
  onToast: (message: string) => void;
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

export default function SettingsPage({
  provider,
  onBack,
  onLogout,
  onToast,
}: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChatId, setNewChatId] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

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
      await provider.updateProfile({
        fullName: profile.fullName,
        companyName: profile.companyName,
      });
      onToast("Профиль сохранён");
    } catch {
      onToast("Не удалось сохранить профиль");
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
    if (!newName.trim() || !newChatId.trim()) return;
    try {
      setRecipients(
        await provider.addRecipient({ name: newName, destination: newChatId }),
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
    setTestResult(
      r.sent
        ? `✅ Отправлено (доставлено: ${r.delivered ?? 1})`
        : `Не отправлено: ${r.reason ?? "неизвестная причина"}`,
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
              Профиль, уведомления и получатели
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
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Уведомления</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
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
              {toggle("Новый клиент", "notifyOnClientCreated")}
              {toggle("Просроченная задача", "notifyOnTaskOverdue")}
              {toggle("Смена статуса дела", "notifyOnStatusChanged")}
            </div>
          </section>

          {/* Recipients */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Получатели</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {recipients.length === 0 && (
                <li className="text-sm text-slate-400">
                  Пока нет получателей. Добавьте Telegram chat ID — узнать свой
                  можно у{" "}
                  <a
                    href="https://t.me/userinfobot"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    @userinfobot
                  </a>
                  .
                </li>
              )}
              {recipients.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className={r.isActive ? "" : "text-slate-400 line-through"}>
                    <span className="font-medium">{r.name}</span>{" "}
                    <span className="text-slate-500">· {r.destination}</span>
                  </span>
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
                </li>
              ))}
            </ul>

            <form onSubmit={addRecipient} className="mt-3 flex flex-col gap-2 sm:flex-row">
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
                placeholder="Telegram chat ID"
                aria-label="Telegram chat ID"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Добавить
              </button>
            </form>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={runTest}
                disabled={testing}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {testing ? "Отправка…" : "Send test notification"}
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
