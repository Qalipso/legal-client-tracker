import type { DataProvider } from "./types";
import { localStorageProvider } from "./localStorageProvider";
import { createSupabaseProvider } from "./supabaseProvider";

// Supabase when env is configured, localStorage demo-mode otherwise.
// The rest of the app only ever sees the DataProvider interface.
// Module-level singleton: the Supabase client must be created exactly once
// per page, otherwise each GoTrueClient instance warns and may conflict.
let cached: DataProvider | undefined;

export function getProvider(): DataProvider {
  if (cached) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) {
    try {
      cached = createSupabaseProvider(url, anonKey);
      return cached;
    } catch {
      // bad env values — fall back rather than crash the app
    }
  }
  cached = localStorageProvider;
  return cached;
}

export type { DataProvider };
