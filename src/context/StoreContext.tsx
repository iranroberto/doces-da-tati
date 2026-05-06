import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CartItem, Product, StoreConfig } from "@/types/store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const productImage = (fileName: string) => fileName ? `/produtos/${fileName}` : "";
const STORE_CONFIG_ID = "main";

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Torta de Limao",
    price: 4.5,
    description:
      "Cremosa, refrescante e com o equilibrio perfeito entre doce e azedinho. Simplesmente irresistivel!",
    image: productImage("torta-de-limao.png"),
    isPromo: true,
    stock: 10,
  },
  {
    id: "2",
    name: "Pave de Morango",
    price: 4.0,
    description:
      "Camadas deliciosas com creme suave e morangos fresquinhos. Leve e apaixonante!",
    image: productImage("pave-de-morango.png"),
    isPromo: false,
    stock: 10,
  },
  {
    id: "3",
    name: "Sanduiche Natural",
    price: 12.0,
    description:
      "Fresquinho, leve e bem recheado. Perfeito pra um lanche saudavel e saboroso!",
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
    name: "Pave de Bolacha",
    price: 6.5,
    description:
      "Classico que todo mundo ama! Camadas de creme com bolacha bem molhadinha.",
    image: productImage("pave-de-bolacha.png"),
    isPromo: false,
    stock: 10,
  },
  {
    id: "6",
    name: "Mousse de Limao",
    price: 38.0,
    description:
      "Leve, geladinho e com aquele azedinho na medida certa. Refrescante e delicioso!",
    image: productImage("mousse-de-limao.png"),
    isPromo: true,
    stock: 10,
  },
  {
    id: "7",
    name: "Mousse de Maracuja",
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

const productFromRow = (row: Record<string, unknown>): Product => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  price: Number(row.price ?? 0),
  description: String(row.description ?? ""),
  image: String(row.image ?? ""),
  isPromo: Boolean(row.is_promo),
  stock: Number(row.stock ?? 0),
});

const productToRow = (product: Product, sortOrder: number) => ({
  id: product.id,
  name: product.name,
  price: product.price,
  description: product.description,
  image: product.image,
  is_promo: product.isPromo,
  stock: product.stock,
  sort_order: sortOrder,
  updated_at: new Date().toISOString(),
});

const configFromRow = (row: Record<string, unknown>): StoreConfig => ({
  name: String(row.name ?? DEFAULT_CONFIG.name),
  logo: String(row.logo ?? DEFAULT_CONFIG.logo),
  banner: String(row.banner ?? DEFAULT_CONFIG.banner),
  whatsapp: String(row.whatsapp ?? DEFAULT_CONFIG.whatsapp),
  pixKey: String(row.pix_key ?? DEFAULT_CONFIG.pixKey),
  pixReceiverName: String(row.pix_receiver_name ?? DEFAULT_CONFIG.pixReceiverName),
  pixCity: String(row.pix_city ?? DEFAULT_CONFIG.pixCity),
  adminPassword: String(row.admin_password ?? DEFAULT_CONFIG.adminPassword),
});

const configToRow = (config: StoreConfig) => ({
  id: STORE_CONFIG_ID,
  name: config.name,
  logo: config.logo,
  banner: config.banner,
  whatsapp: config.whatsapp,
  pix_key: config.pixKey,
  pix_receiver_name: config.pixReceiverName,
  pix_city: config.pixCity,
  admin_password: config.adminPassword,
  updated_at: new Date().toISOString(),
});

interface StoreContextType {
  config: StoreConfig;
  setConfig: (c: StoreConfig) => Promise<void>;
  products: Product[];
  setProducts: (p: Product[]) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  isLoading: boolean;
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
  const [config, setConfigState] = useState<StoreConfig>(() => load("store_config", DEFAULT_CONFIG));
  const [products, setProductsState] = useState<Product[]>(() => load("store_products", DEFAULT_PRODUCTS));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("admin") === "1");
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const persistLocal = useCallback((nextConfig: StoreConfig, nextProducts: Product[]) => {
    localStorage.setItem("store_config", JSON.stringify(nextConfig));
    localStorage.setItem("store_products", JSON.stringify(nextProducts));
  }, []);

  const loadRemoteData = useCallback(async () => {
    if (!supabase) return;

    const [configResult, productsResult] = await Promise.all([
      supabase.from("store_config").select("*").eq("id", STORE_CONFIG_ID).maybeSingle(),
      supabase.from("products").select("*").order("sort_order", { ascending: true }),
    ]);

    if (configResult.error) throw configResult.error;
    if (productsResult.error) throw productsResult.error;

    let nextConfig = configResult.data ? configFromRow(configResult.data) : config;
    let nextProducts = productsResult.data?.length ? productsResult.data.map(productFromRow) : products;

    if (!configResult.data) {
      const fallbackConfig = load("store_config", DEFAULT_CONFIG);
      const { error } = await supabase.from("store_config").upsert(configToRow(fallbackConfig));
      if (error) throw error;
      nextConfig = fallbackConfig;
    }

    if (!productsResult.data?.length) {
      const fallbackProducts = load("store_products", DEFAULT_PRODUCTS);
      const { error } = await supabase.from("products").upsert(fallbackProducts.map(productToRow));
      if (error) throw error;
      nextProducts = fallbackProducts;
    }

    setConfigState(nextConfig);
    setProductsState(nextProducts);
    persistLocal(nextConfig, nextProducts);
  }, [config, persistLocal, products]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    loadRemoteData()
      .catch(error => {
        console.error("Erro ao carregar dados do Supabase:", error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadRemoteData]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("store-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_config" }, () => {
        void loadRemoteData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        void loadRemoteData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRemoteData]);

  const setConfig = useCallback(async (nextConfig: StoreConfig) => {
    setConfigState(nextConfig);
    localStorage.setItem("store_config", JSON.stringify(nextConfig));

    if (!supabase) return;
    const { error } = await supabase.from("store_config").upsert(configToRow(nextConfig));
    if (error) throw error;
  }, []);

  const setProducts = useCallback(async (nextProducts: Product[]) => {
    setProductsState(nextProducts);
    localStorage.setItem("store_products", JSON.stringify(nextProducts));

    if (!supabase) return;
    const { error } = await supabase.from("products").upsert(nextProducts.map(productToRow));
    if (error) throw error;
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    const nextProducts = products.filter(product => product.id !== productId);
    setProductsState(nextProducts);
    localStorage.setItem("store_products", JSON.stringify(nextProducts));

    if (!supabase) return;
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw error;
  }, [products]);

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
    <StoreContext.Provider value={{ config, setConfig, products, setProducts, deleteProduct, isLoading, cart, addToCart, removeFromCart, updateCartQty, clearCart, cartTotal, cartCount, isAdmin, login, logout }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};
