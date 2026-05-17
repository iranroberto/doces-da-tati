import { corsHeaders, fetchSupabaseRows, getMercadoPagoCredentials, json, mercadoPagoStatusToApp, updateSupabaseOrderPayment } from "../_shared.js";

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

const getPaymentDate = (payment) => {
  const value = payment?.date_approved || payment?.date_created || payment?.date_last_updated;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const selectBestPayment = (payments) => {
  if (!Array.isArray(payments) || !payments.length) return null;

  return [...payments].sort((a, b) => {
    if (a.status === "approved" && b.status !== "approved") return -1;
    if (a.status !== "approved" && b.status === "approved") return 1;
    return getPaymentDate(b) - getPaymentDate(a);
  })[0];
};

const moneyEquals = (a, b) => Math.round(Number(a || 0) * 100) === Math.round(Number(b || 0) * 100);

const getOrderFallbackData = async (env, orderId) => {
  if (!orderId) return {};

  const { data } = await fetchSupabaseRows(
    env,
    `pedidos?id=eq.${encodeURIComponent(orderId)}&select=total,criado_em&limit=1`,
  );
  const row = Array.isArray(data) ? data[0] : null;

  return {
    total: Number(row?.total || 0),
    createdAt: row?.criado_em ? String(row.criado_em) : "",
  };
};

const findApprovedPixByAmount = async ({ accessToken, orderId, total, createdAt }) => {
  if (!total || total <= 0) return null;

  const createdTime = createdAt ? new Date(createdAt).getTime() : Date.now();
  const safeCreatedTime = Number.isNaN(createdTime) ? Date.now() : createdTime;
  const beginDate = new Date(safeCreatedTime - 10 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const query = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    range: "date_created",
    begin_date: beginDate,
    end_date: endDate,
    status: "approved",
    payment_method_id: "pix",
    limit: "50",
  });

  const response = await fetch(`https://api.mercadopago.com/v1/payments/search?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.results)) return null;

  const matches = result.results.filter(payment => {
    const reference = String(payment.external_reference || "");
    return payment.status === "approved"
      && (payment.payment_method_id === "pix" || payment.payment_type_id === "bank_transfer")
      && moneyEquals(payment.transaction_amount, total)
      && (!reference || reference === orderId);
  });

  return selectBestPayment(matches);
};

export const onRequestGet = async ({ request, env }) => {
  const { accessToken } = await getMercadoPagoCredentials(env);
  if (!accessToken) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN nao configurado." }, 500);

  const url = new URL(request.url);
  const paymentId = url.searchParams.get("payment_id") || url.searchParams.get("collection_id");
  const orderId = url.searchParams.get("order_id") || url.searchParams.get("external_reference");
  const requestedTotal = Number(url.searchParams.get("total") || 0);
  const requestedCreatedAt = url.searchParams.get("created_at") || "";

  if (!paymentId && !orderId) return json({ error: "payment_id ou order_id obrigatorio." }, 400);

  let response;
  let payment;
  let paymentById = null;
  let paymentByOrder = null;
  let searchResponse = null;

  if (paymentId) {
    response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    paymentById = await response.json();
  }

  if (orderId) {
    searchResponse = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = await searchResponse.json();
    if (!searchResponse.ok) {
      return json({ error: result?.message || "Erro ao consultar pagamentos do pedido.", details: result }, searchResponse.status);
    }
    paymentByOrder = selectBestPayment(result.results);
  }

  if (paymentById && paymentByOrder) {
    payment = selectBestPayment([paymentById, paymentByOrder]);
  } else {
    payment = paymentByOrder || paymentById;
  }

  if (paymentId && response && !response.ok) {
    if (paymentByOrder) {
      payment = paymentByOrder;
    } else {
      return json({ error: paymentById?.message || "Erro ao consultar pagamento.", details: paymentById }, response.status);
    }
  }

  if (!payment || payment.status !== "approved") {
    const fallbackOrder = await getOrderFallbackData(env, orderId);
    const approvedFallbackPayment = await findApprovedPixByAmount({
      accessToken,
      orderId,
      total: requestedTotal || fallbackOrder.total,
      createdAt: requestedCreatedAt || fallbackOrder.createdAt,
    });
    if (approvedFallbackPayment) {
      payment = payment ? selectBestPayment([payment, approvedFallbackPayment]) : approvedFallbackPayment;
    }
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

  const updateResult = await updateSupabaseOrderPayment(env, {
    orderId: resolvedOrderId,
    paymentMethod: appPaymentMethod,
    paymentStatus,
    transactionId: String(payment.id),
    paidAt,
  });

  const updateWarning = updateResult && !updateResult.ok
    ? updateResult.error || "Pagamento consultado, mas nao foi possivel atualizar o pedido."
    : "";

  return json({
    paymentId: String(payment.id),
    orderId: resolvedOrderId,
    paymentMethod: appPaymentMethod,
    status: paymentStatus,
    rawStatus: payment.status,
    statusDetail: payment.status_detail || "",
    paidAt,
    updateWarning,
  });
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
