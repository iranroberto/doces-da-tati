import React, { createContext, useCallback, useContext, useState } from "react";
import { CartItem, Product, StoreConfig } from "@/types/store";

const productImage = (fileName: string) => fileName ? `/produtos/${fileName}` : "";

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Torta de Limão",
    price: 4.5,
    description:
      "Cremosa, refrescante e com o equilíbrio perfeito entre doce e azedinho. Simplesmente irresistível!",
    image: productImage("torta-de-limao.png"),
    isPromo: true,
    stock: 10,
  },
  {
    id: "2",
    name: "Pavê de Morango",
    price: 4.0,
    description:
      "Camadas deliciosas com creme suave e morangos fresquinhos. Leve e apaixonante!",
    image: productImage("pave-de-morango.png"),
    isPromo: false,
    stock: 10,
  },
  {
    id: "3",
    name: "Sanduíche Natural",
    price: 12.0,
    description:
      "Fresquinho, leve e bem recheado. Perfeito pra um lanche saudável e saboroso!",
    image: productImage("sanduiche-natural-de-frango.png"),
    isPromo: true,
    stock: 10,
  },
  {
    id: "4",
    name: "Torta de Frango",
    price: 10.0,
    description:
      "Massa macia com recheio cremoso de frango bem temperado. Sabor de comida caseira!",
    image: productImage("torta-de-frango.png"),
    isPromo: false,
    stock: 10,
  },
  {
    id: "5",
    name: "Pavê de Bolacha",
    price: 6.5,
    description:
      "Clássico que todo mundo ama! Camadas de creme com bolacha bem molhadinha.",
    image: productImage("pave-de-bolacha.png"),
    isPromo: false,
    stock: 10,
  },
  {
    id: "6",
    name: "Mousse de Limão",
    price: 38.0,
    description:
      "Leve, geladinho e com aquele azedinho na medida certa. Refrescante e delicioso!",
    image: productImage("mousse-de-limao.png"),
    isPromo: true,
    stock: 10,
  },
  {
    id: "7",
    name: "Mousse de Maracujá",
    price: 38.0,
    description:
      "Super cremoso, com sabor marcante e equilibrado. Perfeito pra qualquer hora!",
    image: productImage("mousse-de-maracuja.png"),
    isPromo: true,
    stock: 10,
  },
];

const DEFAULT_CONFIG: StoreConfig = {
  name: "doces da tati",
  logo: "/logo-doces-da-tati-round.png",
  banner: "",
  whatsapp: "5521968682297",
  pixKey: "",
  pixReceiverName: "DOCES DA TATI",
  pixCity: "RIO DE JANEIRO",
  adminPassword: "bryan15",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadConfig(): StoreConfig {
  const loaded = { ...DEFAULT_CONFIG, ...load("store_config", DEFAULT_CONFIG) };
  const migrated = localStorage.getItem("store_brand_migrated_tati") === "1";
  const logoMigrated = localStorage.getItem("store_logo_migrated_tati") === "1";

  if (!migrated) {
    const nextConfig = { ...loaded, name: DEFAULT_CONFIG.name, logo: DEFAULT_CONFIG.logo };
    localStorage.setItem("store_config", JSON.stringify(nextConfig));
    localStorage.setItem("store_brand_migrated_tati", "1");
    localStorage.setItem("store_logo_migrated_tati", "1");
    return nextConfig;
  }

  if (!logoMigrated || !loaded.logo) {
    const nextConfig = { ...loaded, logo: DEFAULT_CONFIG.logo };
    localStorage.setItem("store_config", JSON.stringify(nextConfig));
    localStorage.setItem("store_logo_migrated_tati", "1");
    return nextConfig;
  }

  return loaded;
}

interface StoreContextType {
  config: StoreConfig;
  setConfig: (c: StoreConfig) => void;
  products: Product[];
  setProducts: (p: Product[]) => void;
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<StoreConfig>(loadConfig);
  const [products, setProductsState] = useState<Product[]>(() => load("store_products", DEFAULT_PRODUCTS));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("admin") === "1");

  const setConfig = useCallback((c: StoreConfig) => {
    setConfigState(c);
    localStorage.setItem("store_config", JSON.stringify(c));
  }, []);

  const setProducts = useCallback((p: Product[]) => {
    setProductsState(p);
    localStorage.setItem("store_products", JSON.stringify(p));
  }, []);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) return;

    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }

      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }, []);

  const updateCartQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(productId);
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: Math.min(qty, i.product.stock) } : i));
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const login = useCallback((password: string) => {
    if (password === config.adminPassword) {
      setIsAdmin(true);
      sessionStorage.setItem("admin", "1");
      return true;
    }

    return false;
  }, [config.adminPassword]);

  const logout = useCallback(() => {
    setIsAdmin(false);
    sessionStorage.removeItem("admin");
  }, []);

  return (
    <StoreContext.Provider value={{ config, setConfig, products, setProducts, cart, addToCart, removeFromCart, updateCartQty, clearCart, cartTotal, cartCount, isAdmin, login, logout }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};
