import { corsHeaders, getMercadoPagoCredentials, json, mercadoPagoStatusToApp, updateSupabaseOrderPayment } from "../_shared.js";

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

export const onRequestGet = async ({ request, env }) => {
  const { accessToken } = await getMercadoPagoCredentials(env);
  if (!accessToken) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN nao configurado." }, 500);

  const url = new URL(request.url);
  const paymentId = url.searchParams.get("payment_id") || url.searchParams.get("collection_id");
  const orderId = url.searchParams.get("order_id") || url.searchParams.get("external_reference");

  if (!paymentId && !orderId) return json({ error: "payment_id ou order_id obrigatorio." }, 400);

  let response;
  let payment;

  if (paymentId) {
    response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    payment = await response.json();
  } else {
    response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = await response.json();
    payment = Array.isArray(result.results) ? result.results[0] : null;
  }

  if (!response.ok) {
    return json({ error: payment?.message || "Erro ao consultar pagamento.", details: payment }, response.status);
  }

  if (!payment) {
    return json({ error: "Pagamento ainda nao encontrado para este pedido." }, 404);
  }

  const paymentStatus = mercadoPagoStatusToApp(payment.status);
  const resolvedOrderId = orderId || payment.external_reference;
  const paidAt = paymentStatus === "aprovado" ? payment.date_approved || new Date().toISOString() : null;
  const appPaymentMethod = payment.payment_method_id === "pix" || payment.payment_type_id === "bank_transfer"
    ? "pix"
    : payment.payment_type_id === "debit_card"
      ? "debito"
      : "credito";

  await updateSupabaseOrderPayment(env, {
    orderId: resolvedOrderId,
    paymentMethod: appPaymentMethod,
    paymentStatus,
    transactionId: String(payment.id),
    paidAt,
  });

  return json({
    paymentId: String(payment.id),
    orderId: resolvedOrderId,
    paymentMethod: appPaymentMethod,
    status: paymentStatus,
    rawStatus: payment.status,
    paidAt,
  });
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
