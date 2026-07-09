const DISMISSED_KEY = "legal-client-tracker:onboarding-dismissed";

export function isOnboardingDismissed(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === "1";
}

export function dismissOnboarding(): void {
  localStorage.setItem(DISMISSED_KEY, "1");
}

type Step = { title: string; hint: string; done: boolean };

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
    {
      title: "Добавьте первого клиента",
      hint: "Заведите дело — и увидите всю доску в работе",
      done: hasClient,
    },
    {
      title: "Подключите Telegram",
      hint: "Уведомления о делах придут туда, где вы их точно увидите",
      done: hasTelegramConnected,
    },
    {
      title: "Отправьте тестовое уведомление",
      hint: "Убедитесь, что всё работает, прежде чем полагаться на него",
      done: hasSentNotification,
    },
    {
      title: "Добавьте контрольный срок",
      hint: "Откройте карточку клиента — и не пропустите важный дедлайн",
      done: hasDeadline,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  // Guide toward whatever's next, rather than always pointing at Settings —
  // "add a client"/"add a deadline" already have their own obvious buttons
  // elsewhere on this screen, so a second CTA for those would just be noise.
  const nextAction =
    hasClient && !hasTelegramConnected
      ? { label: "Подключить Telegram", onClick: onOpenSettings }
      : hasClient && hasTelegramConnected && !hasSentNotification
        ? { label: "Отправить тест", onClick: onOpenSettings }
        : null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-500/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
            👋 Давайте настроим всё за пару минут
          </h2>
          <p className="mt-0.5 text-xs text-violet-700/80 dark:text-violet-300/70">
            {doneCount === steps.length
              ? "Готово — вы всё настроили!"
              : "Несколько шагов — и трекер будет работать на вас в полную силу"}
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

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-violet-200/60 dark:bg-violet-900/40">
        <div
          className="h-full rounded-full bg-violet-500 transition-all dark:bg-violet-400"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.title} className="flex items-start gap-2 text-sm">
            <span aria-hidden="true" className="mt-0.5">
              {step.done ? "✅" : "▢"}
            </span>
            <div>
              <p
                className={
                  step.done
                    ? "text-violet-400 line-through dark:text-violet-500/60"
                    : "font-medium text-violet-900 dark:text-violet-200"
                }
              >
                {step.title}
              </p>
              {!step.done && (
                <p className="text-xs text-violet-700/70 dark:text-violet-300/60">
                  {step.hint}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {nextAction && (
        <button
          type="button"
          onClick={nextAction.onClick}
          className="mt-3 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          {nextAction.label}
        </button>
      )}
    </div>
  );
}
