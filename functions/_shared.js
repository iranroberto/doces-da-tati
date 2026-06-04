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
      "Cache-Control": "no-store",
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

const normalizeOrderItems = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

export const decrementSupabaseStockForOrder = async (env, orderId) => {
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig(env);
  if (!supabaseUrl || !supabaseKey || !orderId) return;

  const orderResponse = await fetch(`${supabaseUrl}/rest/v1/pedidos?id=eq.${encodeURIComponent(orderId)}&select=id,itens,estoque_baixado&limit=1`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
  });
  const orderRows = await orderResponse.json().catch(() => []);
  if (!orderResponse.ok || !Array.isArray(orderRows) || !orderRows[0] || orderRows[0].estoque_baixado) return;

  const quantitiesByProduct = new Map();
  normalizeOrderItems(orderRows[0].itens).forEach((item) => {
    const productId = String(item.productId || item.product_id || "");
    const quantity = Number(item.quantity || 0);
    if (!productId || quantity <= 0) return;
    quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity);
  });

  if (!quantitiesByProduct.size) return;

  const markResponse = await fetch(`${supabaseUrl}/rest/v1/pedidos?id=eq.${encodeURIComponent(orderId)}&estoque_baixado=is.false`, {
    method: "PATCH",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      estoque_baixado: true,
      atualizado_em: new Date().toISOString(),
    }),
  });
  const markedRows = await markResponse.json().catch(() => []);
  if (!markResponse.ok || !Array.isArray(markedRows) || !markedRows.length) return;

  await Promise.all(Array.from(quantitiesByProduct.entries()).map(async ([productId, quantity]) => {
    const productResponse = await fetch(`${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=stock&limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });
    const productRows = await productResponse.json().catch(() => []);
    if (!productResponse.ok || !Array.isArray(productRows) || !productRows[0]) return;

    const nextStock = Math.max(0, Number(productRows[0].stock || 0) - quantity);
    await fetch(`${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(productId)}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        stock: nextStock,
        updated_at: new Date().toISOString(),
      }),
    });
  }));
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

  const acceptedPasswords = [
    env.ADMIN_PASSWORD,
    env.STORE_ADMIN_PASSWORD,
    env.VITE_ADMIN_PASSWORD,
    env.DEFAULT_ADMIN_PASSWORD,
    "bryan15",
  ].filter(Boolean).map(String);

  if (acceptedPasswords.includes(providedPassword)) return true;

  const { data } = await fetchSupabaseRows(env, "store_config?id=eq.main&select=admin_password&limit=1");
  const row = Array.isArray(data) ? data[0] : null;

  return providedPassword === String(row?.admin_password || "");
};

export const updateSupabaseOrderPayment = async (env, { orderId, paymentMethod, paymentStatus, transactionId, paidAt }) => {
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig(env);

  if (!supabaseUrl || !supabaseKey || !orderId) return { ok: false, skipped: true };

  const currentResponse = await fetch(`${supabaseUrl}/rest/v1/pedidos?id=eq.${encodeURIComponent(orderId)}&select=status_pagamento&limit=1`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
  });
  const currentRows = await currentResponse.json().catch(() => []);
  const currentStatus = Array.isArray(currentRows) ? currentRows[0]?.status_pagamento : null;

  if (currentStatus === "aprovado" && paymentStatus !== "aprovado") {
    return { ok: true, skipped: "already_approved" };
  }

  const updateResponse = await fetch(`${supabaseUrl}/rest/v1/pedidos?id=eq.${encodeURIComponent(orderId)}`, {
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

  if (!updateResponse.ok) {
    const error = await updateResponse.json().catch(() => null);
    return { ok: false, error: error?.message || "Erro ao atualizar pagamento no Supabase." };
  }

  if (paymentStatus === "aprovado") {
    await decrementSupabaseStockForOrder(env, orderId);
  }

  return { ok: true };
};
