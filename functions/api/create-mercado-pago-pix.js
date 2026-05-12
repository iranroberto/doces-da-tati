import { corsHeaders, json, updateSupabaseOrderPayment } from "../_shared.js";

export const onRequestOptions = () => new Response(null, { status: 204, headers: corsHeaders });

const readJson = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const getMercadoPagoError = (result) => {
  const causeDescription = Array.isArray(result.cause)
    ? result.cause.map(cause => cause.description).filter(Boolean).join(" ")
    : "";

  return result.message || result.error || causeDescription || "Nao foi possivel gerar o Pix no Mercado Pago.";
};

export const onRequestPost = async ({ request, env }) => {
  const accessToken = env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN nao configurado." }, 500);

  try {
    const body = await request.json();
    const orderId = String(body.orderId || "");
    const total = Number(body.total || 0);
    const customerName = String(body.customerName || "Cliente");
    const storeName = String(body.storeName || env.STORE_NAME || "Loja");
    const payerEmail = String(body.customerEmail || "").trim();

    if (!orderId || !total || total <= 0) {
      return json({ error: "Dados invalidos para criar PIX." }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
      return json({ error: "Informe um e-mail valido do cliente para gerar o Pix." }, 400);
    }

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `pix-${orderId}`,
      },
      body: JSON.stringify({
        transaction_amount: total,
        description: `Pedido ${storeName} - ${customerName}`.slice(0, 255),
        payment_method_id: "pix",
        external_reference: orderId,
        payer: {
          email: payerEmail,
          first_name: customerName.split(" ")[0] || "Cliente",
          last_name: customerName.split(" ").slice(1).join(" ") || "Cliente",
        },
        notification_url: env.MERCADO_PAGO_WEBHOOK_URL,
      }),
    });
    const result = await readJson(response);

    if (!response.ok) {
      return json({
        error: getMercadoPagoError(result),
        details: result,
      }, response.status);
    }

    const transactionData = result.point_of_interaction?.transaction_data || {};
    const qrCode = transactionData.qr_code || "";

    if (!qrCode) {
      return json({
        error: "Mercado Pago nao retornou o Pix copia e cola. Tente gerar novamente.",
        details: result,
      }, 502);
    }

    await updateSupabaseOrderPayment(env, {
      orderId,
      paymentMethod: "pix",
      paymentStatus: "pendente",
      transactionId: String(result.id || ""),
      paidAt: null,
    });

    return json({
      paymentId: String(result.id),
      status: result.status,
      qrCode,
      qrCodeBase64: transactionData.qr_code_base64 || "",
      ticketUrl: transactionData.ticket_url || "",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro inesperado." }, 500);
  }
};

export const onRequest = ({ request }) => json({ error: `Metodo ${request.method} nao permitido.` }, 405);
