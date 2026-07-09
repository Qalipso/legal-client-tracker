import type { Client } from "../types/client";
import { STATUS_LABELS } from "./statuses";

// Fire-and-forget Telegram notification via the Supabase Edge Function.
// Never blocks or breaks the add-client flow: no env → no-op,
// network/function errors are logged and swallowed.
export function notifyNewClient(client: Pick<Client, "name" | "phone" | "status">): void {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return;

  void fetch(`${url}/functions/v1/notify-telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      name: client.name,
      phone: client.phone,
      status: STATUS_LABELS[client.status],
    }),
  })
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!body?.sent) {
        console.info("[notify-telegram] not sent:", body?.reason ?? res.status);
      }
    })
    .catch((e) => console.info("[notify-telegram] failed:", e));
}
