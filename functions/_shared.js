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

export const updateSupabaseOrderPayment = async (env, { orderId, paymentMethod, paymentStatus, transactionId, paidAt }) => {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY
    || env.SUPABASE_ANON_KEY
    || env.VITE_SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_ANON_KEY;

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
