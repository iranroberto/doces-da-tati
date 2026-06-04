import { corsHeaders, getSupabaseConfig, json, requireAdminPassword } from "../_shared.js";

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

export const onRequestPost = async ({ request, env }) => {
  const body = await readJson(request);
  const isAuthorized = await requireAdminPassword(env, body.adminPassword);

  if (!isAuthorized) {
    return json({ error: "Senha admin invalida." }, 401);
  }

  const orderId = String(body.orderId || "").trim();
  const status = String(body.status || "").trim();

  if (!orderId) return json({ error: "Pedido invalido." }, 400);
  if (status !== "aberto" && status !== "entregue") {
    return json({ error: "Status invalido." }, 400);
  }

  const { url, serviceKey } = getSupabaseConfig(env);
  if (!url || !serviceKey) {
    return json({ error: "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no backend." }, 500);
  }

  const response = await fetch(`${url}/rest/v1/pedidos?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status,
      atualizado_em: new Date().toISOString(),
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    return json({ error: result?.message || "Nao foi possivel atualizar o pedido.", details: result }, response.status);
  }

  const updatedOrder = Array.isArray(result) ? result[0] : null;
  if (!updatedOrder) return json({ error: "Pedido nao encontrado." }, 404);

  return json({ ok: true, status: updatedOrder.status || status });
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
