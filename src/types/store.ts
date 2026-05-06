export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  isPromo: boolean;
  stock: number;
}

export interface StoreConfig {
  name: string;
  logo: string;
  banner: string;
  whatsapp: string;
  pixKey: string;
  pixReceiverName: string;
  pixCity: string;
  adminPassword: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
