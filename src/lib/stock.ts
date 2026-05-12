import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/store";
import type { OrderItemDraft } from "@/lib/orders";

const STOCK_DECREMENTED_ORDERS_KEY = "stock_decremented_orders";

const loadDecrementedOrderIds = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STOCK_DECREMENTED_ORDERS_KEY) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
};

const markOrderStockDecremented = (orderId: string) => {
  const ids = new Set(loadDecrementedOrderIds());
  ids.add(orderId);
  localStorage.setItem(STOCK_DECREMENTED_ORDERS_KEY, JSON.stringify(Array.from(ids)));
};

export const wasOrderStockDecremented = (orderId: string) =>
  loadDecrementedOrderIds().includes(orderId);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const tryMarkRemoteOrderStockDecremented = async (orderId: string) => {
  if (!supabase || !isUuid(orderId)) return true;

  const { data, error } = await supabase
    .from("pedidos")
    .update({
      estoque_baixado: true,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("estoque_baixado", false)
    .select("id");

  if (!error) return Boolean(data?.length);

  const message = String(error.message || "");
  const missingStockFlag = error.code === "42703" || error.code === "PGRST204" || message.includes("estoque_baixado");
  if (missingStockFlag) return true;

  throw error;
};

export const decrementStockForPaidOrder = async (
  orderId: string,
  items: OrderItemDraft[],
) => {
  if (!orderId || wasOrderStockDecremented(orderId)) return;

  const quantitiesByProduct = new Map<string, number>();
  items.forEach(item => {
    if (!item.productId || item.quantity <= 0) return;
    quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) || 0) + item.quantity);
  });

  if (!quantitiesByProduct.size) return;
  markOrderStockDecremented(orderId);

  const shouldDecrement = await tryMarkRemoteOrderStockDecremented(orderId);
  if (!shouldDecrement) return;

  try {
    const localProducts = JSON.parse(localStorage.getItem("store_products") || "[]") as Product[];
    if (Array.isArray(localProducts)) {
      localStorage.setItem("store_products", JSON.stringify(localProducts.map(product => {
        const quantity = quantitiesByProduct.get(product.id) || 0;
        if (!quantity) return product;
        return { ...product, stock: Math.max(0, Number(product.stock || 0) - quantity) };
      })));
    }
  } catch {
    // O estoque online continua sendo atualizado mesmo se o cache local falhar.
  }

  if (!supabase || !isUuid(orderId)) return;

  await Promise.all(Array.from(quantitiesByProduct.entries()).map(async ([productId, quantity]) => {
    const { data, error } = await supabase
      .from("products")
      .select("stock")
      .eq("id", productId)
      .maybeSingle();

    if (error) throw error;

    const currentStock = Number(data?.stock ?? 0);
    const { error: updateError } = await supabase
      .from("products")
      .update({
        stock: Math.max(0, currentStock - quantity),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (updateError) throw updateError;
  }));
};
