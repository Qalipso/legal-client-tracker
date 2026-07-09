import { useEffect, useState } from "react";
import type { NotificationSettings } from "../types/client";
import type { DataProvider } from "../lib/providers";
import { sendTestNotification } from "../lib/notify";

type Props = {
  provider: DataProvider;
  onClose: () => void;
  onSaved: () => void;
};

export default function SettingsPanel({ provider, onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    provider
      .getSettings()
      .then(setSettings)
      .catch(() => setSettings({ notifyOnNewClient: true }));
  }, [provider]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await provider.saveSettings(settings);
      onSaved();
      onClose();
    } catch {
      setTestResult("Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!settings) return;
    setTesting(true);
    setTestResult(null);
    try {
      // сохранить перед тестом, чтобы функция увидела актуальный chat ID
      await provider.saveSettings(settings);
      const r = await sendTestNotification();
      setTestResult(
        r.sent
          ? "✅ Отправлено — проверьте Telegram"
          : `Не отправлено: ${r.reason ?? r.description ?? "неизвестная причина"}`,
      );
    } catch (e) {
      setTestResult(`Ошибка: ${String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Настройки уведомлений"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Уведомления в Telegram
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть настройки"
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-500 hover:bg-slate-50"
          >
            ✕
          </button>
        </div>

        {!settings ? (
          <p className="mt-4 text-sm text-slate-400">Загрузка…</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label
                htmlFor="tg-chat-id"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Telegram chat ID получателя
              </label>
              <input
                id="tg-chat-id"
                type="text"
                value={settings.telegramChatId ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, telegramChatId: e.target.value })
                }
                placeholder="123456789"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              />
              <p className="mt-1 text-xs text-slate-400">
                Узнать свой ID: напишите{" "}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 underline"
                >
                  @userinfobot
                </a>{" "}
                в Telegram — он ответит числом. Затем напишите вашему боту
                любое сообщение, чтобы он мог отправлять вам уведомления.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.notifyOnNewClient}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifyOnNewClient: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Уведомлять о новых клиентах
            </label>

            {testResult && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  testResult.startsWith("✅")
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {testResult}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={runTest}
                disabled={testing}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {testing ? "Отправка…" : "Отправить тест"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
