import { corsHeaders, getMercadoPagoCredentials, getSupabaseConfig, json, requireAdminPassword } from "../_shared.js";

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

const maskSecret = (value) => {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 10) return `${text.slice(0, 3)}...`;

  return `${text.slice(0, 7)}...${text.slice(-4)}`;
};

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

const upsertSettings = async (env, settings) => {
  const { url, serviceKey } = getSupabaseConfig(env);
  if (!url || !serviceKey) {
    return { ok: false, error: "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no backend." };
  }

  const response = await fetch(`${url}/rest/v1/mercado_pago_settings`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: "main",
      ...settings,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return { ok: false, error: error.message || "Nao foi possivel salvar as credenciais." };
  }

  return { ok: true };
};

export const onRequestGet = async ({ env }) => {
  const credentials = await getMercadoPagoCredentials(env);

  return json({
    accessTokenConfigured: Boolean(credentials.accessToken),
    publicKeyConfigured: Boolean(credentials.publicKey),
    accessTokenMasked: maskSecret(credentials.accessToken),
    publicKeyMasked: maskSecret(credentials.publicKey),
  });
};

export const onRequestPost = async ({ request, env }) => {
  const body = await readJson(request);
  const isAuthorized = await requireAdminPassword(env, body.adminPassword);

  if (!isAuthorized) {
    return json({ error: "Senha admin invalida." }, 401);
  }

  const accessToken = String(body.accessToken || "").trim();
  const publicKey = String(body.publicKey || "").trim();

  if (!accessToken && !publicKey) {
    return json({ error: "Informe pelo menos uma credencial para salvar." }, 400);
  }

  const settings = {};
  if (accessToken) settings.access_token = accessToken;
  if (publicKey) settings.public_key = publicKey;

  const result = await upsertSettings(env, settings);
  if (!result.ok) return json({ error: result.error }, 500);

  return json({ ok: true });
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
