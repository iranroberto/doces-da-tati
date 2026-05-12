import { corsHeaders, getMercadoPagoCredentials, json, mercadoPagoStatusToApp, updateSupabaseOrderPayment } from "../_shared.js";

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost = async ({ request, env }) => {
  const { accessToken } = await getMercadoPagoCredentials(env);
  if (!accessToken) return json({ ok: true, skipped: "missing_token" });

  const url = new URL(request.url);
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const topic = url.searchParams.get("topic") || url.searchParams.get("type") || body.type || body.topic;
  const paymentId = url.searchParams.get("id") || url.searchParams.get("data.id") || body.data?.id || body.id;

  if (topic !== "payment" || !paymentId) {
    return json({ ok: true, ignored: true });
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payment = await response.json();

  if (!response.ok) {
    return json({ ok: false, error: payment.message || "Erro ao consultar pagamento." });
  }

  const paymentStatus = mercadoPagoStatusToApp(payment.status);
  const appPaymentMethod = payment.payment_method_id === "pix" || payment.payment_type_id === "bank_transfer"
    ? "pix"
    : payment.payment_type_id === "debit_card"
      ? "debito"
      : "credito";

  await updateSupabaseOrderPayment(env, {
    orderId: payment.external_reference,
    paymentMethod: appPaymentMethod,
    paymentStatus,
    transactionId: String(payment.id),
    paidAt: paymentStatus === "aprovado" ? payment.date_approved || new Date().toISOString() : null,
  });

  return json({ ok: true });
};

export const onRequestGet = onRequestPost;

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
