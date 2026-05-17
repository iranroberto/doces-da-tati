import { getSupabaseConfig, json, requireAdminPassword } from "../_shared.js";
import { deletePushSubscription, hasVapidConfig, sendWebPush } from "../_push.js";

export const onRequestPost = async ({ request, env }) => {
  if (!hasVapidConfig(env)) {
    return json({ error: "Configure VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY na Cloudflare." }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const authorized = await requireAdminPassword(env, body.password);
  if (!authorized) return json({ error: "Senha admin invalida." }, 401);

  const title = String(body.title || "Doces da Tati").trim().slice(0, 80);
  const message = String(body.body || "").trim().slice(0, 240);
  const urlPath = String(body.url || "/").trim() || "/";

  if (!message) return json({ error: "Escreva uma mensagem para enviar." }, 400);

  const { url, key } = getSupabaseConfig(env);
  if (!url || !key) return json({ error: "Supabase nao configurado." }, 500);

  const broadcastResponse = await fetch(`${url}/rest/v1/push_broadcasts`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      title,
      body: message,
      url: urlPath.startsWith("/") ? urlPath : "/",
    }),
  });

  if (!broadcastResponse.ok) {
    const error = await broadcastResponse.json().catch(() => null);
    return json({ error: error?.message || "Nao foi possivel salvar a mensagem." }, broadcastResponse.status);
  }

  const subscriptionsResponse = await fetch(`${url}/rest/v1/push_subscriptions?select=endpoint`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  const subscriptions = await subscriptionsResponse.json().catch(() => []);

  if (!subscriptionsResponse.ok || !Array.isArray(subscriptions)) {
    return json({ error: "Nao foi possivel carregar inscritos." }, 500);
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(subscriptions.map(async (subscription) => {
    const result = await sendWebPush(env, subscription).catch(() => ({ ok: false, status: 0 }));
    if (result.ok) {
      sent += 1;
      return;
    }

    failed += 1;
    if (result.status === 404 || result.status === 410) {
      removed += 1;
      await deletePushSubscription(env, subscription.endpoint);
    }
  }));

  return json({
    ok: true,
    total: subscriptions.length,
    sent,
    failed,
    removed,
  });
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
