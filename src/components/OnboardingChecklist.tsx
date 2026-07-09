const DISMISSED_KEY = "legal-client-tracker:onboarding-dismissed";

export function isOnboardingDismissed(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === "1";
}

export function dismissOnboarding(): void {
  localStorage.setItem(DISMISSED_KEY, "1");
}

type Step = { label: string; done: boolean };

type Props = {
  hasClient: boolean;
  hasTelegramConnected: boolean;
  hasSentNotification: boolean;
  hasDeadline: boolean;
  onDismiss: () => void;
  onOpenSettings: () => void;
};

export default function OnboardingChecklist({
  hasClient,
  hasTelegramConnected,
  hasSentNotification,
  hasDeadline,
  onDismiss,
  onOpenSettings,
}: Props) {
  const steps: Step[] = [
    { label: "Добавьте первого клиента", done: hasClient },
    { label: "Подключите Telegram (Настройки → Получатели)", done: hasTelegramConnected },
    { label: "Отправьте тестовое уведомление", done: hasSentNotification },
    { label: "Добавьте контрольный срок в карточке дела", done: hasDeadline },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-500/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
            Быстрый старт ({doneCount}/{steps.length})
          </h2>
          <p className="mt-0.5 text-xs text-violet-700/80 dark:text-violet-300/70">
            Основные шаги, чтобы начать пользоваться трекером
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Скрыть быстрый старт"
          className="rounded-lg px-2 py-1 text-xs text-violet-500 hover:bg-violet-100 dark:text-violet-400 dark:hover:bg-violet-500/10"
        >
          ✕
        </button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {steps.map((step) => (
          <li
            key={step.label}
            className={`flex items-center gap-2 text-sm ${
              step.done
                ? "text-violet-400 line-through dark:text-violet-500/60"
                : "text-violet-900 dark:text-violet-200"
            }`}
          >
            <span aria-hidden="true">{step.done ? "✅" : "▢"}</span>
            {step.label}
          </li>
        ))}
      </ul>
      {!hasTelegramConnected && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-3 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          Перейти в Настройки
        </button>
      )}
    </div>
  );
}
