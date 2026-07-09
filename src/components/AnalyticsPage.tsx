// Placeholder — real reports (case load, deadline health, throughput) are
// planned but not built. Deliberately no fabricated numbers or charts here:
// showing fake data would violate no-fake-claims worse than an honest stub.
export default function AnalyticsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              История и аналитика
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Отчёты по делам, нагрузке и срокам
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ← К доске
          </button>
        </header>

        <main className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-4xl">🚧</p>
          <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
            В разработке
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Здесь появятся отчёты: сколько дел в работе и просрочено, нагрузка
            по типам дел, скорость закрытия, история изменений по делу за
            период. Сейчас вкладка — заглушка, реальных данных нет.
          </p>
        </main>
      </div>
    </div>
  );
}
