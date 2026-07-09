import type { Client } from "../types/client";
import { STATUS_LABELS } from "./statuses";

type NotifyResult = { sent: boolean; reason?: string; description?: string };

function endpoint(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && anonKey ? { url, anonKey } : null;
}

async function callFunction(body: unknown): Promise<NotifyResult> {
  const env = endpoint();
  if (!env) {
    return { sent: false, reason: "demo-режим (Supabase не настроен)" };
  }
  const res = await fetch(`${env.url}/functions/v1/notify-telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.anonKey}`,
      apikey: env.anonKey,
    },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => null)) ?? {
    sent: false,
    reason: `HTTP ${res.status}`,
  };
}

// Fire-and-forget Telegram notification via the Supabase Edge Function.
// Never blocks or breaks the add-client flow.
export function notifyNewClient(
  client: Pick<Client, "name" | "phone" | "status">,
): void {
  void callFunction({
    name: client.name,
    phone: client.phone,
    status: STATUS_LABELS[client.status],
  })
    .then((r) => {
      if (!r.sent) console.info("[notify-telegram] not sent:", r.reason);
    })
    .catch((e) => console.info("[notify-telegram] failed:", e));
}

// Explicit test from the settings panel — returns the outcome for the UI.
export async function sendTestNotification(): Promise<NotifyResult> {
  try {
    return await callFunction({ test: true, name: "test" });
  } catch (e) {
    return { sent: false, reason: String(e) };
  }
}
