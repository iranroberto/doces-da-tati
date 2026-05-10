import type { Product } from "@/types/store";

export const hasPromotionalPrice = (product: Product) =>
  typeof product.promotionalPrice === "number" &&
  product.promotionalPrice > 0 &&
  product.promotionalPrice < product.price;

export const getProductPrice = (product: Product) =>
  hasPromotionalPrice(product) ? product.promotionalPrice as number : product.price;
