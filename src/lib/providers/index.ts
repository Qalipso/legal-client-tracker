import type { DataProvider } from "./types";
import { localStorageProvider } from "./localStorageProvider";
import { createSupabaseProvider } from "./supabaseProvider";
import { getSupabase } from "../supabaseClient";

// Supabase when env is configured, localStorage demo-mode otherwise.
// The rest of the app only ever sees the DataProvider interface.
let cached: DataProvider | undefined;

export function getProvider(): DataProvider {
  if (cached) return cached;
  const sb = getSupabase();
  cached = sb ? createSupabaseProvider(sb) : localStorageProvider;
  return cached;
}

export type { DataProvider };
