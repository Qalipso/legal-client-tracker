import type { Profile, UserRole } from "../types/client";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  lawyer: "Юрист",
  assistant: "Ассистент",
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  lawyer: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  assistant: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function initials(name?: string, email?: string): string {
  const source = name?.trim() || email || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function UserChip({
  profile,
  onClick,
}: {
  profile: Profile | null;
  onClick: () => void;
}) {
  if (!profile) return <div className="h-10" aria-hidden="true" />;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Открыть профиль в настройках"
      className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-left shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      {profile.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
          {initials(profile.fullName, profile.email)}
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {profile.fullName || profile.email}
        </span>
        <span
          className={`w-fit rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_STYLES[profile.role]}`}
        >
          {ROLE_LABELS[profile.role]}
        </span>
      </span>
    </button>
  );
}
