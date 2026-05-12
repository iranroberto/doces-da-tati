export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

export const mercadoPagoStatusToApp = (status) => {
  if (status === "approved") return "aprovado";
  if (status === "rejected") return "recusado";
  if (status === "cancelled" || status === "canceled") return "cancelado";
  return "pendente";
};

export const getSupabaseConfig = (env) => {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const fallbackKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  return {
    url,
    serviceKey,
    key: serviceKey || fallbackKey,
  };
};

export const fetchSupabaseRows = async (env, path) => {
  const { url, key } = getSupabaseConfig(env);
  if (!url || !key) return { data: null, error: "Supabase nao configurado." };

  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return { data: null, error: data?.message || "Erro ao consultar Supabase." };
  }

  return { data, error: null };
};

export const getMercadoPagoCredentials = async (env) => {
  const envCredentials = {
    accessToken: env.MERCADO_PAGO_ACCESS_TOKEN || "",
    publicKey: env.MERCADO_PAGO_PUBLIC_KEY || "",
  };

  const { data } = await fetchSupabaseRows(env, "mercado_pago_settings?id=eq.main&select=access_token,public_key&limit=1");
  const row = Array.isArray(data) ? data[0] : null;

  return {
    accessToken: row?.access_token || envCredentials.accessToken,
    publicKey: row?.public_key || envCredentials.publicKey,
  };
};

export const requireAdminPassword = async (env, password) => {
  const providedPassword = String(password || "");
  if (!providedPassword) return false;

  if (env.ADMIN_PASSWORD && providedPassword === env.ADMIN_PASSWORD) return true;

  const { data } = await fetchSupabaseRows(env, "store_config?id=eq.main&select=admin_password&limit=1");
  const row = Array.isArray(data) ? data[0] : null;

  return providedPassword === String(row?.admin_password || "");
};

export const updateSupabaseOrderPayment = async (env, { orderId, paymentMethod, paymentStatus, transactionId, paidAt }) => {
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig(env);

  if (!supabaseUrl || !supabaseKey || !orderId) return;

  await fetch(`${supabaseUrl}/rest/v1/pedidos?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      forma_pagamento: paymentMethod,
      status_pagamento: paymentStatus,
      transaction_id: transactionId || null,
      pago_em: paidAt || null,
    }),
  });
};
