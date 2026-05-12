export interface Product {
  id: string;
  name: string;
  price: number;
  promotionalPrice?: number;
  description: string;
  image: string;
  categoryId: string;
  isPromo: boolean;
  stock: number;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export interface StoreConfig {
  name: string;
  logo: string;
  banner: string;
  bannerImage: string;
  showBanner: boolean;
  bannerPositionX: number;
  bannerPositionY: number;
  bannerHeight: number;
  showHeaderName: boolean;
  whatsapp: string;
  pixKey: string;
  pixReceiverName: string;
  pixCity: string;
  adminPassword: string;
  filterAllLabel: string;
  filterPromoLabel: string;
  filterAvailableLabel: string;
  categoryAllLabel: string;
  showFilterAll: boolean;
  showFilterPromo: boolean;
  showFilterAvailable: boolean;
  showCategoryFilter: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CustomerInfo {
  id?: string;
  name: string;
  whatsapp: string;
}

export type CustomerStatus = "ativo" | "bloqueado";

export interface Customer {
  id: string;
  nome: string;
  telefone: string;
  empresa_unidade: string;
  status: CustomerStatus;
  criado_em: string;
}
