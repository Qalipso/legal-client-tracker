import { getSupabase } from "./supabaseClient";

export type NotifyEventType =
  | "client.created"
  | "task.created"
  | "task.overdue"
  | "status.changed"
  | "test";

export type NotifyResult = {
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  delivered?: number;
  failed?: number;
  errors?: string[];
};

async function callFunction(
  eventType: NotifyEventType | string,
  payload: Record<string, unknown>,
  recipientId?: string,
): Promise<NotifyResult> {
  const sb = getSupabase();
  if (!sb) return { skipped: true, reason: "demo-режим (Supabase не настроен)" };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { skipped: true, reason: "нет активной сессии" };

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(`${url}/functions/v1/notify-telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // JWT пользователя — функция определяет auth.uid() из него
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      event_type: eventType,
      payload,
      ...(recipientId ? { recipient_id: recipientId } : {}),
    }),
  });
  return (
    (await res.json().catch(() => null)) ?? {
      skipped: true,
      reason: `HTTP ${res.status}`,
    }
  );
}

// Fire-and-forget — never blocks or breaks the main flow.
export function notifyEvent(
  eventType: NotifyEventType,
  payload: Record<string, unknown>,
): void {
  void callFunction(eventType, payload)
    .then((r) => {
      if (!r.sent) console.info(`[notify:${eventType}]`, r.reason ?? r);
    })
    .catch((e) => console.info(`[notify:${eventType}] failed:`, e));
}

// Explicit test from the settings page — returns the outcome for the UI.
export async function sendTestNotification(): Promise<NotifyResult> {
  try {
    return await callFunction("test", {});
  } catch (e) {
    return { skipped: true, reason: String(e) };
  }
}

// Re-sends one already-logged (failed) notification to the exact same
// recipient it originally targeted — bypasses the enable-toggle checks on
// the server (the original attempt already passed them), so a retry never
// silently turns into a skip. See notify-telegram/index.ts's recipient_id
// branch.
export async function retryNotification(
  eventType: string,
  payload: Record<string, unknown>,
  recipientId: string,
): Promise<NotifyResult> {
  try {
    return await callFunction(eventType, payload, recipientId);
  } catch (e) {
    return { skipped: true, reason: String(e) };
  }
}
