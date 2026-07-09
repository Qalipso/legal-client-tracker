import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const sb = getSupabase();
    if (!sb) return;
    if (!email.trim() || password.length < 6) {
      setError("Укажите email и пароль (минимум 6 символов)");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setInfo("Аккаунт создан. Подтвердите email по ссылке из письма, затем войдите.");
        }
        // при выключенном подтверждении сессия приходит сразу — AuthGate перерисует приложение
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes("Invalid login credentials")
          ? "Неверный email или пароль"
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          Legal Client Tracker
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "login"
            ? "Войдите, чтобы открыть доску дел"
            : "Создайте аккаунт юриста"}
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <div>
            <label
              htmlFor="auth-email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lawyer@example.com"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div>
            <label
              htmlFor="auth-password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Пароль
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "login" ? "signup" : "login"));
            setError(null);
            setInfo(null);
          }}
          className="mt-4 text-sm text-slate-500 underline-offset-2 hover:underline"
        >
          {mode === "login"
            ? "Нет аккаунта? Зарегистрироваться"
            : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
