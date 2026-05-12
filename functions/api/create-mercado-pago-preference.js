import { corsHeaders, json, updateSupabaseOrderPayment } from "../_shared.js";

const allowedPaymentTypes = {
  credito: "credit_card",
  debito: "debit_card",
};

const getSiteUrl = (request, env) => {
  if (env.SITE_URL) return env.SITE_URL;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost = async ({ request, env }) => {
  const accessToken = env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN nao configurado." }, 500);

  try {
    const body = await request.json();
    const orderId = String(body.orderId || "");
    const total = Number(body.total || 0);
    const paymentMethod = String(body.paymentMethod || "");
    const customerName = String(body.customerName || "Cliente");
    const customerEmail = String(body.customerEmail || "cliente@docesdatati.local");
    const items = Array.isArray(body.items) ? body.items : [];
    const selectedType = allowedPaymentTypes[paymentMethod];

    if (!orderId || !total || total <= 0 || !selectedType) {
      return json({ error: "Dados invalidos para criar pagamento." }, 400);
    }

    const siteUrl = getSiteUrl(request, env);
    const excludedPaymentTypes = ["credit_card", "debit_card", "ticket", "bank_transfer", "atm"]
      .filter(id => id !== selectedType)
      .map(id => ({ id }));

    const preference = {
      external_reference: orderId,
      items: items.length
        ? items.map(item => ({
            id: String(item.productId || ""),
            title: String(item.name || "Produto"),
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.price || 0),
            currency_id: "BRL",
          }))
        : [{
            id: orderId,
            title: "Pedido Doces da Tati",
            quantity: 1,
            unit_price: total,
            currency_id: "BRL",
          }],
      payer: {
        name: customerName,
        email: customerEmail,
      },
      payment_methods: {
        excluded_payment_types: excludedPaymentTypes,
        installments: paymentMethod === "credito" ? 12 : 1,
      },
      back_urls: {
        success: `${siteUrl}/#/checkout?mp_result=success&order_id=${encodeURIComponent(orderId)}`,
        failure: `${siteUrl}/#/checkout?mp_result=failure&order_id=${encodeURIComponent(orderId)}`,
        pending: `${siteUrl}/#/checkout?mp_result=pending&order_id=${encodeURIComponent(orderId)}`,
      },
      auto_return: "approved",
      notification_url: env.MERCADO_PAGO_WEBHOOK_URL || `${siteUrl}/api/mercado-pago-webhook`,
      statement_descriptor: "DOCES DA TATI",
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });
    const result = await response.json();

    if (!response.ok) {
      return json({ error: result.message || "Erro Mercado Pago.", details: result }, response.status);
    }

    await updateSupabaseOrderPayment(env, {
      orderId,
      paymentMethod,
      paymentStatus: "pendente",
      transactionId: String(result.id || ""),
      paidAt: null,
    });

    return json({
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro inesperado." }, 500);
  }
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
