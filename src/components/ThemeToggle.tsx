import { useState } from "react";
import { getTheme, setTheme, type Theme } from "../lib/theme";

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Включить дневную тему" : "Включить тёмную тему"
      }
      title={theme === "dark" ? "Дневная тема" : "Тёмная тема"}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
