import { supabase } from "@/lib/supabase";

export const LOCAL_ORDERS_KEY = "store_orders";

export interface OrderItemDraft {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface OrderCustomerDraft {
  id?: string;
  name?: string;
  whatsapp?: string;
}

export interface OrderDraft {
  createdAt: string;
  customer?: OrderCustomerDraft;
  items: OrderItemDraft[];
  total: number;
  paymentMethod: string;
  paymentStatus?: PaymentStatus;
  transactionId?: string;
  paidAt?: string;
  registeredOrderId?: string;
}

export type PaymentMethod = "pix" | "dinheiro" | "credito" | "debito";
export type PaymentStatus = "aprovado" | "pendente" | "recusado" | "cancelado";

export interface LocalOrder {
  id: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  customerWhatsapp: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  transactionId: string;
  paidAt: string;
  items: OrderItemDraft[];
}

const isUuid = (value: string | undefined) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const isMissingOrdersTableError = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "PGRST205" || code === "42P01";
};

const isMissingPaymentColumnsError = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "42703" || code === "PGRST204";
};

const normalizeOrderItems = (items: unknown): OrderItemDraft[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item: Partial<OrderItemDraft>) => ({
    productId: String(item.productId ?? ""),
    name: String(item.name ?? ""),
    price: Number(item.price ?? 0),
    quantity: Number(item.quantity ?? 0),
    image: String(item.image ?? ""),
  }));
};

export const loadLocalOrders = (): LocalOrder[] => {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    const orders = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(orders)) return [];

    return orders.map(order => ({
      id: String(order.id ?? ""),
      createdAt: String(order.createdAt ?? ""),
      customerId: String(order.customerId ?? ""),
      customerName: String(order.customerName ?? "Cliente"),
      customerWhatsapp: String(order.customerWhatsapp ?? ""),
      total: Number(order.total ?? 0),
      status: String(order.status ?? "aberto"),
      paymentMethod: String(order.paymentMethod ?? "pix"),
      paymentStatus: normalizePaymentStatus(order.paymentStatus),
      transactionId: String(order.transactionId ?? ""),
      paidAt: String(order.paidAt ?? ""),
      items: normalizeOrderItems(order.items),
    }));
  } catch {
    return [];
  }
};

export const normalizePaymentStatus = (status: unknown): PaymentStatus => {
  if (status === "aprovado" || status === "pendente" || status === "recusado" || status === "cancelado") {
    return status;
  }

  if (status === "approved") return "aprovado";
  if (status === "rejected") return "recusado";
  if (status === "cancelled" || status === "canceled") return "cancelado";

  return "pendente";
};

export const paymentMethodLabel = (method: string) => {
  if (method === "pix") return "PIX";
  if (method === "dinheiro") return "Dinheiro";
  if (method === "credito") return "Cartao de Credito";
  if (method === "debito") return "Cartao de Debito";
  return method || "Nao informado";
};

export const saveLocalOrder = (order: OrderDraft, orderId: string) => {
  const orders = loadLocalOrders();
  const nextOrder: LocalOrder = {
    id: orderId,
    createdAt: order.createdAt || new Date().toISOString(),
    customerId: order.customer?.id ?? "",
    customerName: order.customer?.name ?? "Cliente",
    customerWhatsapp: order.customer?.whatsapp ?? "",
    total: order.total,
    status: "aberto",
    paymentMethod: order.paymentMethod,
    paymentStatus: normalizePaymentStatus(order.paymentStatus),
    transactionId: order.transactionId ?? "",
    paidAt: order.paidAt ?? "",
    items: order.items,
  };

  if (orders.some(item => item.id === orderId)) {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders.map(item => item.id === orderId ? { ...item, ...nextOrder } : item)));
    return;
  }

  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([
    nextOrder,
    ...orders,
  ]));
};

export const registerOrder = async (order: OrderDraft) => {
  if (order.registeredOrderId) return order.registeredOrderId;

  let orderId = `local-${Date.now()}`;

  if (supabase) {
    const result = await supabase
      .from("pedidos")
      .insert({
        cliente_id: isUuid(order.customer?.id) ? order.customer?.id : null,
        status: "aberto",
        total: order.total,
        forma_pagamento: order.paymentMethod,
        status_pagamento: normalizePaymentStatus(order.paymentStatus),
        transaction_id: order.transactionId || null,
        itens: order.items,
        pago_em: order.paidAt || null,
      })
      .select("id")
      .single();

    let data = result.data;
    let error = result.error;

    if (isMissingPaymentColumnsError(error)) {
      const legacyResult = await supabase
        .from("pedidos")
        .insert({
          cliente_id: isUuid(order.customer?.id) ? order.customer?.id : null,
          status: "aberto",
          total: order.total,
        })
        .select("id")
        .single();

      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error && !isMissingOrdersTableError(error)) throw error;
    if (data?.id) orderId = String(data.id);
  }

  saveLocalOrder(order, orderId);
  return orderId;
};

export const updateOrderPayment = async (
  orderId: string,
  updates: {
    paymentMethod?: string;
    paymentStatus?: PaymentStatus;
    transactionId?: string;
    paidAt?: string;
  },
) => {
  const paymentStatus = updates.paymentStatus ? normalizePaymentStatus(updates.paymentStatus) : undefined;
  const paidAt = paymentStatus === "aprovado" ? updates.paidAt || new Date().toISOString() : updates.paidAt;
  let currentSupabaseStatus: PaymentStatus | undefined;

  if (supabase && isUuid(orderId)) {
    const currentResult = await supabase
      .from("pedidos")
      .select("status_pagamento")
      .eq("id", orderId)
      .maybeSingle();

    if (!currentResult.error && currentResult.data?.status_pagamento) {
      currentSupabaseStatus = normalizePaymentStatus(currentResult.data.status_pagamento);
    }

    if (!(currentSupabaseStatus === "aprovado" && paymentStatus && paymentStatus !== "aprovado")) {
      const { error } = await supabase
        .from("pedidos")
        .update({
          forma_pagamento: updates.paymentMethod,
          status_pagamento: paymentStatus,
          transaction_id: updates.transactionId || null,
          pago_em: paidAt || null,
        })
        .eq("id", orderId);

      if (error && !isMissingOrdersTableError(error) && !isMissingPaymentColumnsError(error)) throw error;
    }
  }

  const orders = loadLocalOrders();
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders.map(order => {
    if (order.id !== orderId) return order;

    const nextPaymentStatus = order.paymentStatus === "aprovado" && paymentStatus && paymentStatus !== "aprovado"
      ? "aprovado"
      : currentSupabaseStatus === "aprovado" && paymentStatus && paymentStatus !== "aprovado"
        ? "aprovado"
        : paymentStatus ?? order.paymentStatus;

    return {
      ...order,
      paymentMethod: updates.paymentMethod ?? order.paymentMethod,
      paymentStatus: nextPaymentStatus,
      transactionId: updates.transactionId ?? order.transactionId,
      paidAt: paidAt ?? order.paidAt,
    };
  })));
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  if (supabase && isUuid(orderId)) {
    const { error } = await supabase
      .from("pedidos")
      .update({
        status,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error && !isMissingOrdersTableError(error)) throw error;
  }

  const orders = loadLocalOrders();
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders.map(order => (
    order.id === orderId ? { ...order, status } : order
  ))));
};

export const deleteOrder = async (orderId: string) => {
  if (supabase && isUuid(orderId)) {
    const { error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", orderId);

    if (error && !isMissingOrdersTableError(error)) throw error;
  }

  const orders = loadLocalOrders();
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders.filter(order => order.id !== orderId)));
};

export const parseOrderItems = normalizeOrderItems;
