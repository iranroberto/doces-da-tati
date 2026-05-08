import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CartItem, Category, Product, StoreConfig } from "@/types/store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const productImage = (fileName: string) => fileName ? `/produtos/${fileName}` : "";
const STORE_CONFIG_ID = "main";
const DEFAULT_LOGO = "/logo-doces-da-tati-round.png?v=20260507-2";

const normalizeLogo = (logo: unknown) => {
  const value = String(logo ?? "");
  return value.startsWith("/logo-doces-da-tati-round.png") ? DEFAULT_LOGO : value;
};

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Torta de Limao",
    price: 4.5,
    description:
      "Cremosa, refrescante e com o equilibrio perfeito entre doce e azedinho. Simplesmente irresistivel!",
    image: productImage("torta-de-limao.png"),
    categoryId: "bolos",
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
    categoryId: "doces",
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
    categoryId: "salgados",
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
    categoryId: "salgados",
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
    categoryId: "doces",
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
    categoryId: "doces",
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
    categoryId: "doces",
    isPromo: true,
    stock: 10,
  },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: "doces", name: "Doces", isActive: true },
  { id: "bolos", name: "Bolos", isActive: true },
  { id: "salgados", name: "Salgados", isActive: true },
];

const DEFAULT_CONFIG: StoreConfig = {
  name: "doces da tati",
  logo: DEFAULT_LOGO,
  banner: "",
  bannerImage: "",
  showBanner: false,
  bannerPositionX: 50,
  bannerPositionY: 50,
  showHeaderName: true,
  whatsapp: "5521968682297",
  pixKey: "",
  pixReceiverName: "DOCES DA TATI",
  pixCity: "RIO DE JANEIRO",
  adminPassword: "bryan15",
  filterAllLabel: "Todos",
  filterPromoLabel: "Ofertas",
  filterAvailableLabel: "Disponiveis",
  categoryAllLabel: "Todas categorias",
  showFilterAll: true,
  showFilterPromo: true,
  showFilterAvailable: true,
  showCategoryFilter: true,
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Nao foi possivel salvar ${key} no localStorage:`, error);
  }
}

const configForLocalStorage = (config: StoreConfig): StoreConfig => ({
  ...config,
  logo: config.logo.startsWith("data:") ? "" : config.logo,
});

const parseBannerConfig = (banner: unknown): Partial<StoreConfig> => {
  const raw = String(banner || "");

  try {
    const value = JSON.parse(raw || "{}");
    return {
      bannerImage: value.bannerImage,
      showBanner: value.showBanner,
      bannerPositionX: value.bannerPositionX,
      bannerPositionY: value.bannerPositionY,
      showHeaderName: value.showHeaderName,
      filterAllLabel: value.filterAllLabel,
      filterPromoLabel: value.filterPromoLabel,
      filterAvailableLabel: value.filterAvailableLabel,
      categoryAllLabel: value.categoryAllLabel,
      showFilterAll: value.showFilterAll,
      showFilterPromo: value.showFilterPromo,
      showFilterAvailable: value.showFilterAvailable,
      showCategoryFilter: value.showCategoryFilter,
    };
  } catch {
    return raw.startsWith("data:") || raw.startsWith("/") || raw.startsWith("http") ? { bannerImage: raw, showBanner: true } : {};
  }
};

const serializeBannerConfig = (config: StoreConfig) => JSON.stringify({
  bannerImage: config.bannerImage,
  showBanner: config.showBanner,
  bannerPositionX: config.bannerPositionX,
  bannerPositionY: config.bannerPositionY,
  showHeaderName: config.showHeaderName,
  filterAllLabel: config.filterAllLabel,
  filterPromoLabel: config.filterPromoLabel,
  filterAvailableLabel: config.filterAvailableLabel,
  categoryAllLabel: config.categoryAllLabel,
  showFilterAll: config.showFilterAll,
  showFilterPromo: config.showFilterPromo,
  showFilterAvailable: config.showFilterAvailable,
  showCategoryFilter: config.showCategoryFilter,
});

const optionalBoolean = (value: unknown) => typeof value === "boolean" ? value : undefined;
const percentValue = (value: unknown, fallback: number) => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return fallback;
  return Math.min(100, Math.max(0, numberValue));
};

const normalizeConfig = (config: Partial<StoreConfig>): StoreConfig => ({
  ...DEFAULT_CONFIG,
  ...config,
  logo: normalizeLogo(config.logo ?? DEFAULT_CONFIG.logo),
  bannerImage: String(config.bannerImage ?? DEFAULT_CONFIG.bannerImage),
  showBanner: Boolean(config.showBanner ?? DEFAULT_CONFIG.showBanner),
  bannerPositionX: percentValue(config.bannerPositionX, DEFAULT_CONFIG.bannerPositionX),
  bannerPositionY: percentValue(config.bannerPositionY, DEFAULT_CONFIG.bannerPositionY),
  showHeaderName: Boolean(config.showHeaderName ?? DEFAULT_CONFIG.showHeaderName),
  filterAllLabel: String(config.filterAllLabel ?? DEFAULT_CONFIG.filterAllLabel),
  filterPromoLabel: String(config.filterPromoLabel ?? DEFAULT_CONFIG.filterPromoLabel),
  filterAvailableLabel: String(config.filterAvailableLabel ?? DEFAULT_CONFIG.filterAvailableLabel),
  categoryAllLabel: String(config.categoryAllLabel ?? DEFAULT_CONFIG.categoryAllLabel),
  showFilterAll: Boolean(config.showFilterAll ?? DEFAULT_CONFIG.showFilterAll),
  showFilterPromo: Boolean(config.showFilterPromo ?? DEFAULT_CONFIG.showFilterPromo),
  showFilterAvailable: Boolean(config.showFilterAvailable ?? DEFAULT_CONFIG.showFilterAvailable),
  showCategoryFilter: Boolean(config.showCategoryFilter ?? DEFAULT_CONFIG.showCategoryFilter),
});

const productFromRow = (row: Record<string, unknown>): Product => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  price: Number(row.price ?? 0),
  description: String(row.description ?? ""),
  image: String(row.image ?? ""),
  categoryId: String(row.category_id ?? ""),
  isPromo: Boolean(row.is_promo),
  stock: Number(row.stock ?? 0),
});

const productToRow = (product: Product, sortOrder: number) => ({
  id: product.id,
  name: product.name,
  price: product.price,
  description: product.description,
  image: product.image,
  category_id: product.categoryId,
  is_promo: product.isPromo,
  stock: product.stock,
  sort_order: sortOrder,
  updated_at: new Date().toISOString(),
});

const categoryFromRow = (row: Record<string, unknown>): Category => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  isActive: Boolean(row.is_active ?? true),
});

const categoryToRow = (category: Category, sortOrder: number) => ({
  id: category.id,
  name: category.name,
  is_active: category.isActive,
  sort_order: sortOrder,
  updated_at: new Date().toISOString(),
});

const configFromRow = (row: Record<string, unknown>): StoreConfig => {
  const bannerConfig = parseBannerConfig(row.banner);

  return normalizeConfig({
    name: String(row.name ?? DEFAULT_CONFIG.name),
    logo: String(row.logo ?? DEFAULT_CONFIG.logo),
    banner: String(row.banner ?? DEFAULT_CONFIG.banner),
    whatsapp: String(row.whatsapp ?? DEFAULT_CONFIG.whatsapp),
    pixKey: String(row.pix_key ?? DEFAULT_CONFIG.pixKey),
    pixReceiverName: String(row.pix_receiver_name ?? DEFAULT_CONFIG.pixReceiverName),
    pixCity: String(row.pix_city ?? DEFAULT_CONFIG.pixCity),
    adminPassword: String(row.admin_password ?? DEFAULT_CONFIG.adminPassword),
    bannerImage: bannerConfig.bannerImage,
    showBanner: bannerConfig.showBanner,
    bannerPositionX: bannerConfig.bannerPositionX,
    bannerPositionY: bannerConfig.bannerPositionY,
    showHeaderName: bannerConfig.showHeaderName,
    filterAllLabel: row.filter_all_label ? String(row.filter_all_label) : bannerConfig.filterAllLabel,
    filterPromoLabel: row.filter_promo_label ? String(row.filter_promo_label) : bannerConfig.filterPromoLabel,
    filterAvailableLabel: row.filter_available_label ? String(row.filter_available_label) : bannerConfig.filterAvailableLabel,
    categoryAllLabel: row.category_all_label ? String(row.category_all_label) : bannerConfig.categoryAllLabel,
    showFilterAll: optionalBoolean(row.show_filter_all) ?? bannerConfig.showFilterAll,
    showFilterPromo: optionalBoolean(row.show_filter_promo) ?? bannerConfig.showFilterPromo,
    showFilterAvailable: optionalBoolean(row.show_filter_available) ?? bannerConfig.showFilterAvailable,
    showCategoryFilter: optionalBoolean(row.show_category_filter) ?? bannerConfig.showCategoryFilter,
  });
};

const configToRow = (config: StoreConfig) => ({
  id: STORE_CONFIG_ID,
  name: config.name,
  logo: config.logo,
  banner: serializeBannerConfig(config),
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
  categories: Category[];
  setCategories: (c: Category[]) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
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
  const [config, setConfigState] = useState<StoreConfig>(() => {
    const storedConfig = load("store_config", DEFAULT_CONFIG);
    return normalizeConfig(storedConfig);
  });
  const [categories, setCategoriesState] = useState<Category[]>(() => load("store_categories", DEFAULT_CATEGORIES));
  const [products, setProductsState] = useState<Product[]>(() => load("store_products", DEFAULT_PRODUCTS));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("admin") === "1");
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  const persistLocal = useCallback((nextConfig: StoreConfig, nextCategories: Category[], nextProducts: Product[]) => {
    saveLocal("store_config", configForLocalStorage(nextConfig));
    saveLocal("store_categories", nextCategories);
    saveLocal("store_products", nextProducts);
  }, []);

  const loadRemoteData = useCallback(async () => {
    if (!supabase) return;

    const [configResult, categoriesResult, productsResult] = await Promise.all([
      supabase.from("store_config").select("*").eq("id", STORE_CONFIG_ID).maybeSingle(),
      supabase.from("categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("products").select("*").order("sort_order", { ascending: true }),
    ]);

    if (configResult.error) throw configResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (productsResult.error) throw productsResult.error;

    let nextConfig = configResult.data ? configFromRow(configResult.data) : normalizeConfig(load("store_config", DEFAULT_CONFIG));
    let nextCategories = categoriesResult.data?.length
      ? categoriesResult.data.map(categoryFromRow)
      : load("store_categories", DEFAULT_CATEGORIES);
    let nextProducts = productsResult.data?.length
      ? productsResult.data.map(productFromRow)
      : load("store_products", DEFAULT_PRODUCTS);

    if (!configResult.data) {
      const storedFallbackConfig = load("store_config", DEFAULT_CONFIG);
      const fallbackConfig = normalizeConfig(storedFallbackConfig);
      const { error } = await supabase.from("store_config").upsert(configToRow(fallbackConfig));
      if (error) throw error;
      nextConfig = fallbackConfig;
    }

    if (!categoriesResult.data?.length) {
      const fallbackCategories = load("store_categories", DEFAULT_CATEGORIES);
      const { error } = await supabase.from("categories").upsert(fallbackCategories.map(categoryToRow));
      if (error) throw error;
      nextCategories = fallbackCategories;
    }

    if (!productsResult.data?.length) {
      const fallbackProducts = load("store_products", DEFAULT_PRODUCTS);
      const { error } = await supabase.from("products").upsert(fallbackProducts.map(productToRow));
      if (error) throw error;
      nextProducts = fallbackProducts;
    }

    setConfigState(nextConfig);
    setCategoriesState(nextCategories);
    setProductsState(nextProducts);
    persistLocal(nextConfig, nextCategories, nextProducts);
  }, [persistLocal]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
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
    saveLocal("store_config", configForLocalStorage(nextConfig));

    if (!supabase) return;
    const row = configToRow(nextConfig);
    if (nextConfig.logo === config.logo) {
      delete (row as Partial<ReturnType<typeof configToRow>>).logo;
    }

    const { error } = await supabase.from("store_config").upsert(row);
    if (error) throw error;
  }, [config.logo]);

  const setCategories = useCallback(async (nextCategories: Category[]) => {
    setCategoriesState(nextCategories);
    saveLocal("store_categories", nextCategories);

    if (!supabase) return;
    const { error } = await supabase.from("categories").upsert(nextCategories.map(categoryToRow));
    if (error) throw error;
  }, []);

  const setProducts = useCallback(async (nextProducts: Product[]) => {
    setProductsState(nextProducts);
    saveLocal("store_products", nextProducts);

    if (!supabase) return;
    const { error } = await supabase.from("products").upsert(nextProducts.map(productToRow));
    if (error) throw error;
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    const nextProducts = products.filter(product => product.id !== productId);
    setProductsState(nextProducts);
    saveLocal("store_products", nextProducts);

    if (!supabase) return;
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw error;
  }, [products]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    const nextCategories = categories.filter(category => category.id !== categoryId);
    const nextProducts = products.map(product =>
      product.categoryId === categoryId ? { ...product, categoryId: "" } : product
    );

    setCategoriesState(nextCategories);
    setProductsState(nextProducts);
    saveLocal("store_categories", nextCategories);
    saveLocal("store_products", nextProducts);

    if (!supabase) return;
    const [{ error: productError }, { error: categoryError }] = await Promise.all([
      supabase.from("products").upsert(nextProducts.map(productToRow)),
      supabase.from("categories").delete().eq("id", categoryId),
    ]);
    if (productError) throw productError;
    if (categoryError) throw categoryError;
  }, [categories, products]);

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
    <StoreContext.Provider value={{ config, setConfig, categories, setCategories, deleteCategory, products, setProducts, deleteProduct, isLoading, cart, addToCart, removeFromCart, updateCartQty, clearCart, cartTotal, cartCount, isAdmin, login, logout }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};
