// Telegram notification on new client.
// The bot token lives ONLY here (Supabase secrets), never in the frontend.
// Configure: supabase secrets set TG_BOT_TOKEN=... TG_CHAT_ID=...
// Without secrets the function answers {sent:false} and the app works as usual.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let payload: { name?: string; phone?: string; status?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const { name, phone, status } = payload;
  if (!name) return json({ error: "name is required" }, 400);

  const token = Deno.env.get("TG_BOT_TOKEN");
  const chatId = Deno.env.get("TG_CHAT_ID");
  if (!token || !chatId) {
    return json({ sent: false, reason: "telegram is not configured" });
  }

  const text = [
    "Новый клиент добавлен:",
    name,
    phone ? `Телефон: ${phone}` : null,
    status ? `Статус: ${status}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  return json({ sent: tg.ok, status: tg.status });
});
