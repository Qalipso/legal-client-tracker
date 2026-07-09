export type Theme = "light" | "dark";

const THEME_KEY = "legal-client-tracker:theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark() ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

// call once at module load (see index.html's inline head script for the
// flash-free version that runs before React mounts) and again from
// components that need to react to the current value
export function initTheme(): Theme {
  const theme = getTheme();
  applyTheme(theme);
  return theme;
}
