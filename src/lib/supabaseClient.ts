import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

// Single Supabase client per page (multiple GoTrueClient instances conflict).
// null → env not configured → app runs in localStorage demo-mode without auth.
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  client = url && anonKey ? createClient(url, anonKey) : null;
  return client;
}
