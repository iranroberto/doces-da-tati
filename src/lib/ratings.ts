import { supabase } from "@/lib/supabase";

export const LOCAL_RATINGS_KEY = "store_product_ratings";

export interface ProductRating {
  id: string;
  productId: string;
  orderId: string;
  customerId: string;
  rating: number;
  createdAt: string;
}

export interface ProductRatingSummary {
  average: number;
  count: number;
}

const isUuid = (value: string | undefined) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const normalizeRating = (value: unknown) => Math.min(5, Math.max(1, Number(value) || 1));

const loadLocalRatings = (): ProductRating[] => {
  try {
    const raw = localStorage.getItem(LOCAL_RATINGS_KEY);
    const ratings = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ratings)) return [];

    return ratings.map(rating => ({
      id: String(rating.id ?? ""),
      productId: String(rating.productId ?? ""),
      orderId: String(rating.orderId ?? ""),
      customerId: String(rating.customerId ?? ""),
      rating: normalizeRating(rating.rating),
      createdAt: String(rating.createdAt ?? ""),
    }));
  } catch {
    return [];
  }
};

const saveLocalRatings = (ratings: ProductRating[]) => {
  localStorage.setItem(LOCAL_RATINGS_KEY, JSON.stringify(ratings));
};

const localRatingId = (orderId: string, productId: string, customerId: string) =>
  `${orderId}:${productId}:${customerId}`;

export const getLocalRating = (orderId: string, productId: string, customerId: string) =>
  loadLocalRatings().find(rating =>
    rating.orderId === orderId && rating.productId === productId && rating.customerId === customerId
  ) ?? null;

export const saveProductRating = async ({
  orderId,
  productId,
  customerId,
  rating,
}: {
  orderId: string;
  productId: string;
  customerId: string;
  rating: number;
}) => {
  const normalizedRating = normalizeRating(rating);

  if (supabase && isUuid(orderId) && isUuid(customerId)) {
    const { error } = await supabase
      .from("product_ratings")
      .upsert({
        pedido_id: orderId,
        produto_id: productId,
        cliente_id: customerId,
        nota: normalizedRating,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "pedido_id,produto_id,cliente_id" });

    if (error) throw error;
  }

  const ratings = loadLocalRatings();
  const nextRating: ProductRating = {
    id: localRatingId(orderId, productId, customerId),
    productId,
    orderId,
    customerId,
    rating: normalizedRating,
    createdAt: new Date().toISOString(),
  };

  const exists = ratings.some(item => item.id === nextRating.id);
  saveLocalRatings(exists
    ? ratings.map(item => item.id === nextRating.id ? nextRating : item)
    : [nextRating, ...ratings]);

  return nextRating;
};

export const getProductRatingSummary = async (productId: string): Promise<ProductRatingSummary> => {
  if (supabase) {
    const { data, error } = await supabase
      .from("product_ratings")
      .select("nota")
      .eq("produto_id", productId);

    if (!error && Array.isArray(data)) {
      const ratings = data.map(row => Number(row.nota || 0)).filter(Boolean);
      const count = ratings.length;
      const average = count ? ratings.reduce((sum, value) => sum + value, 0) / count : 0;
      return { average, count };
    }
  }

  const ratings = loadLocalRatings().filter(rating => rating.productId === productId);
  const count = ratings.length;
  const average = count ? ratings.reduce((sum, item) => sum + item.rating, 0) / count : 0;
  return { average, count };
};
