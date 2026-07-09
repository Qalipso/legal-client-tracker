import type { DataProvider } from "./types";
import { localStorageProvider } from "./localStorageProvider";
import { createSupabaseProvider } from "./supabaseProvider";

// Supabase when env is configured, localStorage demo-mode otherwise.
// The rest of the app only ever sees the DataProvider interface.
export function getProvider(): DataProvider {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) {
    try {
      return createSupabaseProvider(url, anonKey);
    } catch {
      // bad env values — fall back rather than crash the app
    }
  }
  return localStorageProvider;
}

export type { DataProvider };
