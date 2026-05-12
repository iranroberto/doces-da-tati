import { corsHeaders, json, mercadoPagoStatusToApp, updateSupabaseOrderPayment } from "../_shared.js";

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

export const onRequestGet = async ({ request, env }) => {
  const accessToken = env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN nao configurado." }, 500);

  const url = new URL(request.url);
  const paymentId = url.searchParams.get("payment_id") || url.searchParams.get("collection_id");
  const orderId = url.searchParams.get("order_id") || url.searchParams.get("external_reference");

  if (!paymentId) return json({ error: "payment_id obrigatorio." }, 400);

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payment = await response.json();

  if (!response.ok) {
    return json({ error: payment.message || "Erro ao consultar pagamento.", details: payment }, response.status);
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
