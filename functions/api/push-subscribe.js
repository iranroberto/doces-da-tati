import { getSupabaseConfig, json } from "../_shared.js";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

export const onRequestPost = async ({ request, env }) => {
  const { url, key } = getSupabaseConfig(env);
  if (!url || !key) return json({ error: "Supabase nao configurado." }, 500);

  const body = await request.json().catch(() => ({}));
  const subscription = body.subscription || {};
  const endpoint = String(subscription.endpoint || "");
  const p256dh = String(subscription.keys?.p256dh || "");
  const auth = String(subscription.keys?.auth || "");

  if (!endpoint || !p256dh || !auth) {
    return json({ error: "Inscricao de notificacao invalida." }, 400);
  }

  const row = {
    cliente_id: isUuid(body.customerId) ? String(body.customerId) : null,
    endpoint,
    p256dh,
    auth,
    user_agent: String(request.headers.get("User-Agent") || ""),
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(`${url}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    return json({ error: error?.message || "Nao foi possivel salvar a inscricao." }, response.status);
  }

  return json({ ok: true });
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
