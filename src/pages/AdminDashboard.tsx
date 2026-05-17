import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BarChart3, Bell, CheckCircle2, ClipboardList, Clock, DollarSign, Image, Instagram, KeyRound, LogOut, Package, Pencil, Plus, Save, Send, ShieldCheck, Store, Tags, Trash2, TrendingUp, Truck, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Category, Customer, Product } from "@/types/store";
import { useStore } from "@/context/StoreContext";
import { deleteOrder, loadLocalOrders, normalizePaymentStatus, parseOrderItems, paymentMethodLabel, updateOrderPayment, updateOrderStatus, type OrderItemDraft, type PaymentStatus } from "@/lib/orders";
import { getProductPrice, hasPromotionalPrice } from "@/lib/pricing";
import { formatPhone } from "@/lib/phone";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const LOCAL_CUSTOMERS_KEY = "store_customers";
const BANNER_RECOMMENDED_WIDTH = 1600;
const BANNER_RECOMMENDED_HEIGHT = 340;

const readApiJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

const apiErrorMessage = (result: Record<string, unknown>, fallback: string) =>
  String(result.error || result.message || fallback);

interface AdminOrder {
  id: string;
  createdAt: string;
  customerName: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  transactionId: string;
  items: OrderItemDraft[];
}

interface CustomerOrderGroup {
  customerName: string;
  total: number;
  orders: AdminOrder[];
}

const loadLocalCustomers = (): Customer[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalCustomers = (customers: Customer[]) => {
  localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(customers));
};

const mapOrderRows = (rows: Record<string, unknown>[]): AdminOrder[] => {
  const localOrders = loadLocalOrders();
  const localOrdersById = new Map(localOrders.map(order => [order.id, order]));

  const remoteOrders = rows.map(row => {
    const id = String(row.id);
    const localOrder = localOrdersById.get(id);
    const customer = row.clientes as { nome?: unknown } | Array<{ nome?: unknown }> | undefined;
    const customerName = Array.isArray(customer)
      ? String(customer[0]?.nome ?? "")
      : String(customer?.nome ?? "");

    return {
      id,
      createdAt: String(row.criado_em ?? ""),
      customerName: customerName || localOrder?.customerName || "Cliente",
      total: Number(row.total ?? 0),
      status: String(row.status ?? "aberto"),
      paymentMethod: String(row.forma_pagamento ?? localOrder?.paymentMethod ?? "pix"),
      paymentStatus: normalizePaymentStatus(row.status_pagamento ?? localOrder?.paymentStatus),
      transactionId: String(row.transaction_id ?? localOrder?.transactionId ?? ""),
      items: parseOrderItems(row.itens ?? localOrder?.items),
    };
  });

  const remoteOrderIds = new Set(remoteOrders.map(order => order.id));
  const localOnlyOrders: AdminOrder[] = localOrders
    .filter(order => !remoteOrderIds.has(order.id))
    .map(order => ({
      id: order.id,
      createdAt: order.createdAt,
      customerName: order.customerName || "Cliente",
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: normalizePaymentStatus(order.paymentStatus),
      transactionId: order.transactionId,
      items: order.items,
    }));

  return [...remoteOrders, ...localOnlyOrders].sort((a, b) => (
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  ));
};

const customerFromRow = (row: Record<string, unknown>): Customer => ({
  id: String(row.id),
  nome: String(row.nome ?? ""),
  telefone: String(row.telefone ?? ""),
  empresa_unidade: String(row.empresa_unidade ?? ""),
  status: String(row.status ?? "ativo") === "bloqueado" ? "bloqueado" : "ativo",
  criado_em: String(row.criado_em ?? ""),
});

const isMissingCustomersTableError = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "PGRST205" || code === "42P01";
};

const isMissingOrdersTableError = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "PGRST205" || code === "42P01";
};

const isMissingPaymentColumnsError = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "42703" || code === "PGRST204";
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatShortWeekday = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(value).replace(".", "");

const formatOrderItems = (items: OrderItemDraft[]) => {
  if (!items.length) return "Itens nao registrados neste pedido";

  return items
    .map(item => `${item.quantity}x ${item.name} (${formatPrice(item.price * item.quantity)})`)
    .join(", ");
};

const productSignature = (product: Product) => JSON.stringify({
  id: product.id,
  name: product.name,
  price: product.price,
  promotionalPrice: product.promotionalPrice ?? null,
  description: product.description,
  image: product.image,
  categoryId: product.categoryId,
  isPromo: product.isPromo,
  stock: product.stock,
});

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const AdminDashboard = () => {
  const { config, setConfig, categories, setCategories, deleteCategory, products, setProducts, deleteProduct, isPromotionalPriceOnlineEnabled, logout, isAdmin, isLoading } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"dashboard" | "store" | "categories" | "products" | "orders" | "clients">("dashboard");

  const [storeName, setStoreName] = useState(config.name);
  const [whatsapp, setWhatsapp] = useState(config.whatsapp);
  const [instagram, setInstagram] = useState(config.instagram);
  const [pixKey, setPixKey] = useState(config.pixKey);
  const [pixReceiverName, setPixReceiverName] = useState(config.pixReceiverName);
  const [pixCity, setPixCity] = useState(config.pixCity);
  const [adminPw, setAdminPw] = useState(config.adminPassword);
  const [bannerImage, setBannerImage] = useState(config.bannerImage);
  const [showBanner, setShowBanner] = useState(config.showBanner);
  const [bannerPositionX, setBannerPositionX] = useState(String(config.bannerPositionX));
  const [bannerPositionY, setBannerPositionY] = useState(String(config.bannerPositionY));
  const [bannerHeight, setBannerHeight] = useState(String(config.bannerHeight));
  const [showHeaderName, setShowHeaderName] = useState(config.showHeaderName);
  const [filterAllLabel, setFilterAllLabel] = useState(config.filterAllLabel);
  const [filterPromoLabel, setFilterPromoLabel] = useState(config.filterPromoLabel);
  const [filterAvailableLabel, setFilterAvailableLabel] = useState(config.filterAvailableLabel);
  const [categoryAllLabel, setCategoryAllLabel] = useState(config.categoryAllLabel);
  const [showFilterAll, setShowFilterAll] = useState(config.showFilterAll);
  const [showFilterPromo, setShowFilterPromo] = useState(config.showFilterPromo);
  const [showFilterAvailable, setShowFilterAvailable] = useState(config.showFilterAvailable);
  const [showCategoryFilter, setShowCategoryFilter] = useState(config.showCategoryFilter);
  const [saveMessage, setSaveMessage] = useState("");
  const [storeFormDirty, setStoreFormDirty] = useState(false);
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpSettingsLoading, setMpSettingsLoading] = useState(false);
  const [mpSettingsSaving, setMpSettingsSaving] = useState(false);
  const [mpSettings, setMpSettings] = useState({
    accessTokenConfigured: false,
    publicKeyConfigured: false,
    accessTokenMasked: "",
    publicKeyMasked: "",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const lastAutoSavedProduct = useRef("");
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pPromotionalPrice, setPPromotionalPrice] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pImage, setPImage] = useState("");
  const [pCategoryId, setPCategoryId] = useState("");
  const [pPromo, setPPromo] = useState(false);
  const [pStock, setPStock] = useState("20");
  const [categoryName, setCategoryName] = useState("");
  const [categoryActive, setCategoryActive] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [autoSaveMessage, setAutoSaveMessage] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState("");
  const [pushTitle, setPushTitle] = useState("Doces da Tati");
  const [pushMessage, setPushMessage] = useState("");
  const [pushUrl, setPushUrl] = useState("/");
  const [sendingPush, setSendingPush] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingOrderStatusId, setUpdatingOrderStatusId] = useState("");
  const [verifyingPaymentId, setVerifyingPaymentId] = useState("");
  const [deletingOrderId, setDeletingOrderId] = useState("");
  const lastPaymentSyncById = useRef(new Map<string, number>());
  const ordersByIdRef = useRef(new Map<string, AdminOrder>());

  const buildProductData = (productId: string): { product?: Product; error?: string } => {
    const price = Number(pPrice);
    const promotionalPrice = pPromotionalPrice.trim() ? Number(pPromotionalPrice) : undefined;

    if (!pName.trim() || !pPrice || Number.isNaN(price)) {
      return { error: "Preencha nome e preco corretamente" };
    }

    if (promotionalPrice !== undefined && (Number.isNaN(promotionalPrice) || promotionalPrice <= 0)) {
      return { error: "Preencha o preco promocional corretamente" };
    }

    if (promotionalPrice !== undefined && promotionalPrice >= price) {
      return { error: "O preco promocional deve ser menor que o preco normal" };
    }

    return {
      product: {
        id: productId,
        name: pName.trim(),
        price,
        promotionalPrice,
        description: pDesc,
        image: pImage,
        categoryId: pCategoryId,
        isPromo: pPromo,
        stock: Math.max(0, parseInt(pStock, 10) || 0),
      },
    };
  };

  const syncMercadoPagoPayment = useCallback(async (order: AdminOrder, showToast = true) => {
    if (!order.id) {
      if (showToast) toast.error("Este pedido ainda nao tem identificador para verificar.");
      return;
    }

    if (showToast) setVerifyingPaymentId(order.id);

    try {
      const query = new URLSearchParams({ order_id: order.id });
      if (order.transactionId) query.set("payment_id", order.transactionId);
      if (order.total) query.set("total", String(order.total));
      if (order.createdAt) query.set("created_at", order.createdAt);
      const response = await fetch(`/api/get-mercado-pago-payment?${query.toString()}`);
      const result = await readApiJson(response);

      if (!response.ok) {
        throw new Error(apiErrorMessage(result, "Nao foi possivel verificar o Pix."));
      }

      const nextStatus = normalizePaymentStatus(result.status);
      const nextPaymentMethod = String(result.paymentMethod || order.paymentMethod || "pix");
      const nextTransactionId = String(result.paymentId || order.transactionId);
      const paidAt = result.paidAt ? String(result.paidAt) : undefined;

      await updateOrderPayment(order.id, {
        paymentMethod: nextPaymentMethod,
        paymentStatus: nextStatus,
        transactionId: nextTransactionId,
        paidAt,
      });

      setOrders(current => current.map(item => (
        item.id === order.id
          ? {
              ...item,
              paymentMethod: nextPaymentMethod,
              paymentStatus: item.paymentStatus === "aprovado" && nextStatus !== "aprovado" ? "aprovado" : nextStatus,
              transactionId: item.paymentStatus === "aprovado" && nextStatus !== "aprovado"
                ? item.transactionId || nextTransactionId
                : nextTransactionId,
            }
          : item
      )));

      if (showToast) {
        if (nextStatus === "aprovado") {
          toast.success("Pagamento Pix confirmado.");
        } else {
          toast.info(`Pagamento ainda esta ${nextStatus}.`);
        }
      }
    } catch (error) {
      console.error("Erro ao sincronizar pagamento Mercado Pago:", error);
      if (showToast) toast.error(error instanceof Error ? error.message : "Nao foi possivel verificar o Pix.");
    } finally {
      if (showToast) setVerifyingPaymentId("");
    }
  }, []);

  const syncPendingPixOrders = useCallback((nextOrders: AdminOrder[]) => {
    const now = Date.now();

    nextOrders
      .filter(order => order.paymentMethod === "pix" && order.paymentStatus === "pendente" && order.id)
      .slice(0, 8)
      .forEach(order => {
        const syncKey = order.transactionId || order.id;
        const lastSync = lastPaymentSyncById.current.get(syncKey) || 0;
        if (now - lastSync < 10_000) return;

        lastPaymentSyncById.current.set(syncKey, now);
        void syncMercadoPagoPayment(order, false);
      });
  }, [syncMercadoPagoPayment]);

  useEffect(() => {
    ordersByIdRef.current = new Map(orders.map(order => [order.id, order]));
  }, [orders]);

  useEffect(() => {
    if (storeFormDirty) return;

    setStoreName(config.name);
    setWhatsapp(config.whatsapp);
    setInstagram(config.instagram);
    setPixKey(config.pixKey);
    setPixReceiverName(config.pixReceiverName);
    setPixCity(config.pixCity);
    setAdminPw(config.adminPassword);
    setBannerImage(config.bannerImage);
    setShowBanner(config.showBanner);
    setBannerPositionX(String(config.bannerPositionX));
    setBannerPositionY(String(config.bannerPositionY));
    setBannerHeight(String(config.bannerHeight));
    setShowHeaderName(config.showHeaderName);
    setFilterAllLabel(config.filterAllLabel);
    setFilterPromoLabel(config.filterPromoLabel);
    setFilterAvailableLabel(config.filterAvailableLabel);
    setCategoryAllLabel(config.categoryAllLabel);
    setShowFilterAll(config.showFilterAll);
    setShowFilterPromo(config.showFilterPromo);
    setShowFilterAvailable(config.showFilterAvailable);
    setShowCategoryFilter(config.showCategoryFilter);
  }, [config, storeFormDirty]);

  useEffect(() => {
    if (tab !== "store") return;

    let isMounted = true;
    setMpSettingsLoading(true);

    fetch("/api/mercado-pago-settings")
      .then(response => readApiJson(response))
      .then(result => {
        if (!isMounted) return;
        setMpSettings({
          accessTokenConfigured: Boolean(result.accessTokenConfigured),
          publicKeyConfigured: Boolean(result.publicKeyConfigured),
          accessTokenMasked: String(result.accessTokenMasked || ""),
          publicKeyMasked: String(result.publicKeyMasked || ""),
        });
      })
      .catch(error => {
        console.error("Erro ao carregar credenciais Mercado Pago:", error);
      })
      .finally(() => {
        if (isMounted) setMpSettingsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tab]);

  useEffect(() => {
    if (!dialogOpen || !editingProduct) return;

    const { product } = buildProductData(editingProduct.id);
    if (!product) {
      setAutoSaveMessage("Aguardando dados validos para salvar");
      return;
    }

    const signature = productSignature(product);
    if (signature === lastAutoSavedProduct.current) {
      setAutoSaveMessage("");
      return;
    }

    setAutoSaveMessage("Salvando alteracoes...");
    const timeout = window.setTimeout(async () => {
      try {
        await setProducts(products.map(item => item.id === editingProduct.id ? product : item));
        lastAutoSavedProduct.current = signature;
        setAutoSaveMessage("Alteracoes salvas");
      } catch {
        setAutoSaveMessage("Nao foi possivel salvar no banco online");
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [dialogOpen, editingProduct, pCategoryId, pDesc, pImage, pName, pPrice, pPromo, pPromotionalPrice, pStock, products, setProducts]);

  useEffect(() => {
    if (tab !== "clients" && tab !== "dashboard") return;

    let isMounted = true;
    if (tab === "clients") setCustomersLoading(true);

    const loadCustomers = async () => {
      try {
        if (!supabase) {
          setCustomers(loadLocalCustomers());
          return;
        }

        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .order("criado_em", { ascending: false });

        if (isMissingCustomersTableError(error)) {
          setCustomers(loadLocalCustomers());
          return;
        }

        if (error) throw error;
        if (!isMounted) return;

        setCustomers((data ?? []).map(customerFromRow));
      } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        if (tab === "clients") toast.error("Nao foi possivel carregar clientes.");
      } finally {
        if (isMounted && tab === "clients") setCustomersLoading(false);
      }
    };

    void loadCustomers();

    return () => {
      isMounted = false;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "orders" && tab !== "dashboard") return;

    let isMounted = true;
    if (tab === "orders") setOrdersLoading(true);

    const loadOrders = async () => {
      try {
        if (!supabase) {
          const localOrders = loadLocalOrders();
          setOrders(localOrders);
          syncPendingPixOrders(localOrders);
          return;
        }

        const result = await supabase
          .from("pedidos")
          .select("id, criado_em, status, total, forma_pagamento, status_pagamento, transaction_id, itens, clientes(nome)")
          .order("criado_em", { ascending: false });

        let data = result.data;
        let error = result.error;

        if (isMissingPaymentColumnsError(error)) {
          const legacyResult = await supabase
            .from("pedidos")
            .select("id, criado_em, status, total, clientes(nome)")
            .order("criado_em", { ascending: false });
          data = legacyResult.data;
          error = legacyResult.error;
        }

        if (isMissingOrdersTableError(error)) {
          const localOrders = loadLocalOrders();
          setOrders(localOrders);
          syncPendingPixOrders(localOrders);
          return;
        }

        if (error) throw error;
        if (!isMounted) return;

        const currentOrdersById = ordersByIdRef.current;
        const mappedOrders = mapOrderRows(data ?? []).map(order => {
          const currentOrder = currentOrdersById.get(order.id);
          if (currentOrder?.paymentStatus !== "aprovado" || order.paymentStatus === "aprovado") return order;

          return {
            ...order,
            paymentStatus: "aprovado" as PaymentStatus,
            transactionId: order.transactionId || currentOrder.transactionId,
          };
        });
        setOrders(mappedOrders);
        syncPendingPixOrders(mappedOrders);
      } catch (error) {
        console.error("Erro ao carregar pedidos:", error);
        if (tab === "orders") toast.error("Nao foi possivel carregar pedidos.");
      } finally {
        if (isMounted && tab === "orders") setOrdersLoading(false);
      }
    };

    void loadOrders();

    const refreshOrders = () => {
      void loadOrders();
    };
    const interval = window.setInterval(refreshOrders, 5000);
    window.addEventListener("focus", refreshOrders);

    const channel = supabase
      ? supabase
          .channel(`admin-orders-${tab}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, refreshOrders)
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOrders);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [syncPendingPixOrders, tab]);

  const orderGroups = useMemo<CustomerOrderGroup[]>(() => {
    const groups = new Map<string, CustomerOrderGroup>();

    orders.forEach(order => {
      const customerName = order.customerName || "Cliente";
      const current = groups.get(customerName) || { customerName, total: 0, orders: [] };
      current.total += order.total;
      current.orders.push(order);
      groups.set(customerName, current);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const latestA = new Date(a.orders[0]?.createdAt || 0).getTime();
      const latestB = new Date(b.orders[0]?.createdAt || 0).getTime();
      return latestB - latestA;
    });
  }, [orders]);

  const todaysOrders = useMemo(() => {
    const today = new Date();
    return orders.filter(order => {
      const createdAt = new Date(order.createdAt);
      return !Number.isNaN(createdAt.getTime())
        && createdAt.getFullYear() === today.getFullYear()
        && createdAt.getMonth() === today.getMonth()
        && createdAt.getDate() === today.getDate();
    });
  }, [orders]);

  const approvedRevenue = useMemo(() => (
    orders
      .filter(order => order.paymentStatus === "aprovado")
      .reduce((sum, order) => sum + order.total, 0)
  ), [orders]);

  const totalRevenue = useMemo(() => (
    orders.reduce((sum, order) => sum + order.total, 0)
  ), [orders]);

  const deliveryPendingOrders = useMemo(() => (
    orders.filter(order => order.status !== "entregue")
  ), [orders]);

  const deliveredOrders = useMemo(() => (
    orders.filter(order => order.status === "entregue")
  ), [orders]);

  const pendingPaymentOrders = useMemo(() => (
    orders.filter(order => order.paymentStatus === "pendente")
  ), [orders]);

  const averageTicket = orders.length ? totalRevenue / orders.length : 0;
  const activeProducts = products.filter(product => product.stock > 0);
  const lowStockProducts = products.filter(product => product.stock > 0 && product.stock <= 3);

  const revenueByDay = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - (6 - index));

      return {
        key: date.toISOString().slice(0, 10),
        label: formatShortWeekday(date),
        total: 0,
      };
    });
    const daysByKey = new Map(days.map(day => [day.key, day]));

    orders
      .filter(order => order.paymentStatus === "aprovado")
      .forEach(order => {
        const createdAt = new Date(order.createdAt);
        if (Number.isNaN(createdAt.getTime())) return;
        const key = createdAt.toISOString().slice(0, 10);
        const day = daysByKey.get(key);
        if (day) day.total += order.total;
      });

    return days;
  }, [orders]);

  const maxDailyRevenue = Math.max(...revenueByDay.map(day => day.total), 1);

  const topProducts = useMemo(() => {
    const productsByName = new Map<string, { name: string; quantity: number; total: number }>();

    orders.forEach(order => {
      order.items.forEach(item => {
        const name = item.name || "Produto";
        const current = productsByName.get(name) || { name, quantity: 0, total: 0 };
        current.quantity += item.quantity;
        current.total += item.price * item.quantity;
        productsByName.set(name, current);
      });
    });

    return Array.from(productsByName.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4);
  }, [orders]);

  const recentOrders = orders.slice(0, 5);

  if (!isAdmin) {
    navigate("/admin");
    return null;
  }

  const saveStoreSettings = async () => {
    try {
      await setConfig({
        ...config,
        name: storeName.trim(),
        whatsapp,
        instagram: instagram.trim(),
        logo: config.logo,
        pixKey: pixKey.trim(),
        pixReceiverName: pixReceiverName.trim() || "DOCES DA TATI",
        pixCity: pixCity.trim() || "RIO DE JANEIRO",
        adminPassword: adminPw || "bryan15",
        bannerImage,
        showBanner,
        bannerPositionX: Number(bannerPositionX),
        bannerPositionY: Number(bannerPositionY),
        bannerHeight: Number(bannerHeight),
        showHeaderName,
        filterAllLabel: filterAllLabel.trim() || "Todos",
        filterPromoLabel: filterPromoLabel.trim() || "Ofertas",
        filterAvailableLabel: filterAvailableLabel.trim() || "Disponiveis",
        categoryAllLabel: categoryAllLabel.trim() || "Todas categorias",
        showFilterAll,
        showFilterPromo,
        showFilterAvailable,
        showCategoryFilter,
      });
      setStoreFormDirty(false);
      setSaveMessage("Configuracoes salvas com sucesso!");
      toast.success("Configuracoes salvas!");
      window.setTimeout(() => setSaveMessage(""), 3500);
    } catch (error) {
      console.error("Erro ao salvar configuracoes da loja:", error);
      toast.error("Nao foi possivel salvar no banco online");
    }
  };

  const saveMercadoPagoSettings = async () => {
    if (!mpAccessToken.trim() && !mpPublicKey.trim()) {
      toast.error("Informe o Access Token ou a Public Key para salvar.");
      return;
    }

    setMpSettingsSaving(true);
    try {
      const response = await fetch("/api/mercado-pago-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: mpAccessToken.trim(),
          publicKey: mpPublicKey.trim(),
          adminPassword: adminPw,
        }),
      });
      const result = await readApiJson(response);

      if (!response.ok) {
        throw new Error(apiErrorMessage(result, "Nao foi possivel salvar as credenciais."));
      }

      const refreshed = await fetch("/api/mercado-pago-settings");
      const refreshedResult = await readApiJson(refreshed);

      setMpSettings({
        accessTokenConfigured: Boolean(refreshedResult.accessTokenConfigured),
        publicKeyConfigured: Boolean(refreshedResult.publicKeyConfigured),
        accessTokenMasked: String(refreshedResult.accessTokenMasked || ""),
        publicKeyMasked: String(refreshedResult.publicKeyMasked || ""),
      });
      setMpAccessToken("");
      setMpPublicKey("");
      toast.success("Credenciais Mercado Pago salvas no backend.");
    } catch (error) {
      console.error("Erro ao salvar Mercado Pago:", error);
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar as credenciais.");
    } finally {
      setMpSettingsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await fileToBase64(file);
      try {
        await setConfig({ ...config, logo: b64 });
        toast.success("Logo atualizado!");
      } catch {
        toast.error("Nao foi possivel salvar a logo no banco online");
      }
    }
  };

  const removeLogo = async () => {
    try {
      await setConfig({ ...config, logo: "" });
      toast.success("Logo removida!");
    } catch {
      toast.error("Nao foi possivel remover a logo no banco online");
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerImage(await fileToBase64(file));
    setShowBanner(true);
    setStoreFormDirty(true);
  };

  const removeBanner = () => {
    setBannerImage("");
    setShowBanner(false);
    setStoreFormDirty(true);
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    lastAutoSavedProduct.current = "";
    setAutoSaveMessage("");
    setPName("");
    setPPrice("");
    setPPromotionalPrice("");
    setPDesc("");
    setPImage("");
    setPCategoryId(categories.find(category => category.isActive)?.id || "");
    setPPromo(false);
    setPStock("20");
    setDialogOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    lastAutoSavedProduct.current = productSignature(p);
    setAutoSaveMessage("");
    setPName(p.name);
    setPPrice(String(p.price));
    setPPromotionalPrice(p.promotionalPrice ? String(p.promotionalPrice) : "");
    setPDesc(p.description);
    setPImage(p.image);
    setPCategoryId(p.categoryId);
    setPPromo(p.isPromo);
    setPStock(String(p.stock));
    setDialogOpen(true);
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPImage(await fileToBase64(file));
  };

  const saveProduct = async () => {
    const { product: productData, error } = buildProductData(editingProduct?.id || Date.now().toString());

    if (!productData) {
      toast.error(error);
      return;
    }

    try {
      if (editingProduct) {
        await setProducts(products.map(p => p.id === editingProduct.id ? productData : p));
        lastAutoSavedProduct.current = productSignature(productData);
        toast.success("Produto atualizado!");
      } else {
        await setProducts([...products, productData]);
        toast.success("Produto adicionado!");
      }

      setDialogOpen(false);
    } catch {
      toast.error("Nao foi possivel salvar o produto no banco online");
    }
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryActive(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryActive(category.isActive);
  };

  const saveCategory = async () => {
    const name = categoryName.trim();
    const id = editingCategory?.id || slugify(name);

    if (!name || !id) {
      toast.error("Informe o nome da categoria");
      return;
    }

    if (!editingCategory && categories.some(category => category.id === id)) {
      toast.error("Ja existe uma categoria com esse nome");
      return;
    }

    const categoryData: Category = { id, name, isActive: categoryActive };

    try {
      if (editingCategory) {
        await setCategories(categories.map(category => category.id === editingCategory.id ? categoryData : category));
        toast.success("Categoria atualizada!");
      } else {
        await setCategories([...categories, categoryData]);
        toast.success("Categoria adicionada!");
      }
      resetCategoryForm();
    } catch {
      toast.error("Nao foi possivel salvar a categoria no banco online");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      if (editingCategory?.id === id) resetCategoryForm();
      toast.success("Categoria excluida!");
    } catch {
      toast.error("Nao foi possivel excluir a categoria no banco online");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success("Produto excluido!");
    } catch {
      toast.error("Nao foi possivel excluir o produto no banco online");
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    const confirmed = window.confirm(`Excluir o cliente ${customer.nome}?`);
    if (!confirmed) return;

    setDeletingCustomerId(customer.id);

    try {
      if (supabase) {
        const { error } = await supabase.from("clientes").delete().eq("id", customer.id);

        if (error && !isMissingCustomersTableError(error)) throw error;
      }

      const nextCustomers = customers.filter(item => item.id !== customer.id);
      setCustomers(nextCustomers);
      saveLocalCustomers(loadLocalCustomers().filter(item => item.id !== customer.id && item.telefone !== customer.telefone));
      toast.success("Cliente excluido!");
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      toast.error("Nao foi possivel excluir o cliente.");
    } finally {
      setDeletingCustomerId("");
    }
  };

  const sendPushBroadcast = async () => {
    if (!pushMessage.trim()) {
      toast.error("Escreva uma descricao para enviar.");
      return;
    }

    setSendingPush(true);

    try {
      const response = await fetch("/api/push-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: adminPw,
          title: pushTitle,
          body: pushMessage,
          url: pushUrl,
        }),
      });
      const result = await readApiJson(response);

      if (!response.ok) {
        throw new Error(apiErrorMessage(result, "Nao foi possivel enviar as notificacoes."));
      }

      toast.success(`Mensagem enviada para ${Number(result.sent || 0)} dispositivo(s).`);
      setPushMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar as notificacoes.");
    } finally {
      setSendingPush(false);
    }
  };

  const toggleOrderDeliveryStatus = async (order: AdminOrder) => {
    const nextStatus = order.status === "entregue" ? "aberto" : "entregue";
    setUpdatingOrderStatusId(order.id);

    try {
      await updateOrderStatus(order.id, nextStatus);
      setOrders(current => current.map(item => (
        item.id === order.id ? { ...item, status: nextStatus } : item
      )));
      toast.success(nextStatus === "entregue" ? "Pedido marcado como entregue." : "Pedido marcado como pendente.");
    } catch (error) {
      console.error("Erro ao atualizar status do pedido:", error);
      toast.error("Nao foi possivel atualizar o pedido.");
    } finally {
      setUpdatingOrderStatusId("");
    }
  };

  const handleDeleteOrder = async (order: AdminOrder) => {
    const confirmed = window.confirm(`Apagar o pedido de ${order.customerName} no valor de ${formatPrice(order.total)}?`);
    if (!confirmed) return;

    setDeletingOrderId(order.id);

    try {
      await deleteOrder(order.id);
      setOrders(current => current.filter(item => item.id !== order.id));
      toast.success("Pedido apagado.");
    } catch (error) {
      console.error("Erro ao apagar pedido:", error);
      toast.error("Nao foi possivel apagar o pedido.");
    } finally {
      setDeletingOrderId("");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const dashboardCards = [
    { label: "Pedidos hoje", value: String(todaysOrders.length), detail: `${orders.length} no total`, icon: ClipboardList },
    { label: "Faturamento pago", value: formatPrice(approvedRevenue), detail: `${formatPrice(totalRevenue)} em pedidos`, icon: DollarSign },
    { label: "Ticket medio", value: formatPrice(averageTicket), detail: orders.length ? "media por pedido" : "sem pedidos ainda", icon: TrendingUp },
    { label: "A entregar", value: String(deliveryPendingOrders.length), detail: `${deliveredOrders.length} entregue(s)`, icon: Truck },
    { label: "Pagamentos pendentes", value: String(pendingPaymentOrders.length), detail: "aguardando confirmacao", icon: Clock },
    { label: "Clientes", value: String(customers.length), detail: `${activeProducts.length} produto(s) ativos`, icon: Users },
  ];

  const navItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
    { id: "products" as const, label: "Produtos", icon: Package },
    { id: "orders" as const, label: "Pedidos", icon: ClipboardList },
    { id: "clients" as const, label: "Clientes", icon: Users },
    { id: "store" as const, label: "Loja", icon: Store },
    { id: "categories" as const, label: "Categorias", icon: Tags },
  ];

  return (
    <div className="min-h-screen bg-[#220b00] text-[#f0d8c0]">
      <header className="bg-[#f0d8c0] text-[#481800] shadow-[0_14px_40px_rgba(72,24,0,0.18)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 md:flex-row md:items-start md:justify-between">
          <button className="w-fit font-display text-2xl font-bold" onClick={() => navigate("/")}>
            Doces <span className="text-[#a76b18]">Admin</span>
          </button>

          <nav className="grid w-full gap-2 sm:grid-cols-2 md:max-w-xl md:grid-cols-3">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = tab === item.id;

              return (
                <button
                  key={item.id}
                  className={isActive
                    ? "flex items-center gap-3 bg-[#d8c0a8]/75 px-5 py-3 text-sm font-bold text-[#481800]"
                    : "flex items-center gap-3 px-5 py-3 text-sm font-semibold text-[#603000] transition hover:bg-[#d8c0a8]/45"}
                  onClick={() => setTab(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <Button variant="ghost" size="sm" className="gap-2 text-lg font-bold text-[#603000] hover:bg-[#d8c0a8]/60 hover:text-[#481800]" onClick={handleLogout}>
            <LogOut className="h-5 w-5" /> Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {isLoading && (
          <div className="mb-4 border border-[#603000] bg-[#481800] px-3 py-2 text-sm font-semibold text-[#f0d8c0]">
            Carregando dados online...
          </div>
        )}

        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-display text-4xl text-[#f0d8c0]">Dashboard</h1>
                <p className="mt-1 text-sm font-semibold text-[#d8c0a8]">Resumo operacional da loja, pagamentos, entregas e estoque.</p>
              </div>
              <div className="flex w-fit items-center gap-2 rounded-full border border-[#603000] bg-[#481800] px-4 py-2 text-sm font-bold text-[#f0d8a8]">
                <ShieldCheck className="h-4 w-4" />
                Online
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {dashboardCards.map(card => {
                const Icon = card.icon;

                return (
                  <div key={card.label} className="rounded-[18px] border border-[#603000] bg-[#481800] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold uppercase text-[#d8c0a8]">{card.label}</p>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f0d8c0]/10 text-[#f0d8a8]">
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <p className="mt-5 font-display text-3xl text-[#f0d8a8]">{card.value}</p>
                    <p className="mt-1 text-sm font-semibold text-[#d8c0a8]">{card.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
              <section className="rounded-[18px] border border-[#603000] bg-[#481800] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-[#f0d8a8]">Faturamento dos ultimos 7 dias</h2>
                    <p className="text-sm font-semibold text-[#d8c0a8]">Somente pedidos com pagamento aprovado.</p>
                  </div>
                  <Wallet className="h-6 w-6 text-[#d8c090]" />
                </div>
                <div className="mt-5 flex h-56 items-end gap-3">
                  {revenueByDay.map(day => {
                    const height = Math.max(8, Math.round((day.total / maxDailyRevenue) * 100));

                    return (
                      <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-36 w-full items-end rounded-lg bg-[#220b00]/70 p-1">
                          <div
                            className="w-full rounded-md bg-[#f0d8a8]"
                            style={{ height: `${height}%` }}
                            title={formatPrice(day.total)}
                          />
                        </div>
                        <span className="text-xs font-bold uppercase text-[#d8c0a8]">{day.label}</span>
                        <span className="text-xs font-bold text-[#f0d8a8]">{formatPrice(day.total)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[18px] border border-[#603000] bg-[#481800] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-[#f0d8a8]">Atencao</h2>
                    <p className="text-sm font-semibold text-[#d8c0a8]">Itens que merecem acompanhamento.</p>
                  </div>
                  <AlertTriangle className="h-6 w-6 text-yellow-200" />
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-lg border border-[#603000] bg-[#220b00]/45 p-4">
                    <p className="text-xs font-bold uppercase text-[#d8c0a8]">Estoque baixo</p>
                    <p className="mt-1 font-display text-3xl text-yellow-200">{lowStockProducts.length}</p>
                    <p className="mt-1 text-sm font-semibold text-[#d8c0a8]">produto(s) com 3 unidades ou menos</p>
                  </div>
                  <div className="rounded-lg border border-[#603000] bg-[#220b00]/45 p-4">
                    <p className="text-xs font-bold uppercase text-[#d8c0a8]">Pedidos pendentes</p>
                    <p className="mt-1 font-display text-3xl text-yellow-200">{deliveryPendingOrders.length}</p>
                    <p className="mt-1 text-sm font-semibold text-[#d8c0a8]">aguardando entrega</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="overflow-hidden rounded-[18px] border border-[#603000] bg-[#481800]">
                <div className="flex items-center justify-between border-b border-[#603000] px-5 py-4">
                  <div>
                    <h2 className="font-display text-2xl text-[#f0d8a8]">Ultimos pedidos</h2>
                    <p className="text-sm font-semibold text-[#d8c0a8]">Acompanhamento rapido de status.</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-[#d8c090] bg-transparent text-[#f0d8a8] hover:bg-[#603000] hover:text-[#f0d8c0]" onClick={() => setTab("orders")}>
                    Ver todos
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-4 border-b border-[#603000] px-5 py-3 text-xs font-bold uppercase text-[#f0d8a8]">
                  <span>Data</span>
                  <span>Cliente</span>
                  <span>Total</span>
                  <span>Status</span>
                </div>
                {recentOrders.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-[#d8c0a8]">
                    Nenhum pedido ainda
                  </div>
                ) : (
                  <div className="divide-y divide-[#603000]">
                    {recentOrders.map(order => (
                      <div key={order.id} className="grid grid-cols-1 gap-2 px-5 py-4 text-sm text-[#f0d8c0] md:grid-cols-4 md:gap-4">
                        <span className="font-bold">{formatDateTime(order.createdAt)}</span>
                        <span>{order.customerName}</span>
                        <span className="font-bold text-[#f0d8a8]">{formatPrice(order.total)}</span>
                        <span className={order.status === "entregue" ? "font-bold text-green-300" : "font-bold text-yellow-200"}>
                          {order.status === "entregue" ? "Entregue" : "Pendente"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-[18px] border border-[#603000] bg-[#481800] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-[#f0d8a8]">Mais vendidos</h2>
                    <p className="text-sm font-semibold text-[#d8c0a8]">Por quantidade nos pedidos.</p>
                  </div>
                  <Package className="h-6 w-6 text-[#d8c090]" />
                </div>
                {topProducts.length === 0 ? (
                  <div className="mt-5 rounded-lg border border-dashed border-[#603000] px-4 py-10 text-center text-sm font-semibold text-[#d8c0a8]">
                    Sem itens vendidos ainda
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {topProducts.map((product, index) => (
                      <div key={product.name} className="flex items-center justify-between gap-3 rounded-lg border border-[#603000] bg-[#220b00]/45 p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0d8c0] text-sm font-black text-[#481800]">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#f0d8c0]">{product.name}</p>
                            <p className="text-xs font-semibold text-[#d8c0a8]">{product.quantity} unidade(s)</p>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-[#f0d8a8]">{formatPrice(product.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {tab === "store" && (
          <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
            <Card className="rounded-lg">
              <CardHeader><CardTitle>Configuracoes da Loja</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome da Loja</Label>
                  <Input value={storeName} onChange={e => { setStoreFormDirty(true); setStoreName(e.target.value); }} />
                </div>
                <div>
                  <Label>Numero do WhatsApp (com DDD)</Label>
                  <Input placeholder="5511999999999" value={whatsapp} onChange={e => { setStoreFormDirty(true); setWhatsapp(e.target.value); }} />
                </div>
                <div>
                  <Label>Instagram</Label>
                  <div className="relative">
                    <Instagram className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="@docesdatati ou https://instagram.com/docesdatati"
                      value={instagram}
                      onChange={e => { setStoreFormDirty(true); setInstagram(e.target.value); }}
                    />
                  </div>
                </div>
                <div>
                  <Label>Chave Pix</Label>
                  <Input placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatoria" value={pixKey} onChange={e => { setStoreFormDirty(true); setPixKey(e.target.value); }} />
                </div>
                <div>
                  <Label>Nome de quem recebe o Pix</Label>
                  <Input placeholder="DOCES DA TATI" value={pixReceiverName} onChange={e => { setStoreFormDirty(true); setPixReceiverName(e.target.value); }} />
                </div>
                <div>
                  <Label>Cidade do Pix</Label>
                  <Input placeholder="RIO DE JANEIRO" value={pixCity} onChange={e => { setStoreFormDirty(true); setPixCity(e.target.value); }} />
                </div>
                <div>
                  <Label>Senha do Admin</Label>
                  <Input type="password" value={adminPw} onChange={e => { setStoreFormDirty(true); setAdminPw(e.target.value); }} />
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <h3 className="mb-3 text-base font-bold">Filtros da vitrine</h3>
                  <div className="space-y-4">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <Label>Nome do filtro principal</Label>
                        <Input value={filterAllLabel} onChange={e => { setStoreFormDirty(true); setFilterAllLabel(e.target.value); }} />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Switch checked={showFilterAll} onCheckedChange={checked => { setStoreFormDirty(true); setShowFilterAll(checked); }} />
                        <Label>Visivel</Label>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <Label>Nome do filtro de ofertas</Label>
                        <Input value={filterPromoLabel} onChange={e => { setStoreFormDirty(true); setFilterPromoLabel(e.target.value); }} />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Switch checked={showFilterPromo} onCheckedChange={checked => { setStoreFormDirty(true); setShowFilterPromo(checked); }} />
                        <Label>Visivel</Label>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <Label>Nome do filtro disponiveis</Label>
                        <Input value={filterAvailableLabel} onChange={e => { setStoreFormDirty(true); setFilterAvailableLabel(e.target.value); }} />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Switch checked={showFilterAvailable} onCheckedChange={checked => { setStoreFormDirty(true); setShowFilterAvailable(checked); }} />
                        <Label>Visivel</Label>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <Label>Nome do filtro de categorias</Label>
                        <Input value={categoryAllLabel} onChange={e => { setStoreFormDirty(true); setCategoryAllLabel(e.target.value); }} />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Switch checked={showCategoryFilter} onCheckedChange={checked => { setStoreFormDirty(true); setShowCategoryFilter(checked); }} />
                        <Label>Visivel</Label>
                      </div>
                    </div>
                  </div>
                </div>
                {saveMessage && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> {saveMessage}
                  </div>
                )}
                <Button className="w-full gap-2" onClick={saveStoreSettings}><Save className="h-4 w-4" /> Salvar</Button>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader><CardTitle>Logo da Loja</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Logo da Loja</Label>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                  {config.logo && <img src={config.logo} alt="Logo" className="mt-2 h-20 w-20 rounded-full border object-cover" />}
                  {config.logo && (
                    <Button variant="outline" className="mt-3 gap-2 text-destructive" onClick={removeLogo}>
                      <Trash2 className="h-4 w-4" /> Remover logo
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Mercado Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  {mpSettingsLoading ? (
                    <p className="font-semibold text-muted-foreground">Verificando credenciais...</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 font-bold">
                        <KeyRound className="h-4 w-4 text-primary" />
                        Access Token: {mpSettings.accessTokenConfigured ? "configurado" : "nao configurado"}
                      </p>
                      {mpSettings.accessTokenMasked && <p className="break-all text-xs text-muted-foreground">{mpSettings.accessTokenMasked}</p>}
                      <p className="flex items-center gap-2 font-bold">
                        <KeyRound className="h-4 w-4 text-primary" />
                        Public Key: {mpSettings.publicKeyConfigured ? "configurada" : "nao configurada"}
                      </p>
                      {mpSettings.publicKeyMasked && <p className="break-all text-xs text-muted-foreground">{mpSettings.publicKeyMasked}</p>}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={mpSettings.accessTokenConfigured ? "Digite um novo token para substituir" : "APP_USR-..."}
                    value={mpAccessToken}
                    onChange={e => setMpAccessToken(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Public Key</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={mpSettings.publicKeyConfigured ? "Digite uma nova public key para substituir" : "APP_USR-..."}
                    value={mpPublicKey}
                    onChange={e => setMpPublicKey(e.target.value)}
                  />
                </div>

                <Button className="w-full gap-2" disabled={mpSettingsSaving} onClick={() => void saveMercadoPagoSettings()}>
                  <Save className="h-4 w-4" />
                  {mpSettingsSaving ? "Salvando..." : "Salvar credenciais"}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader><CardTitle>Banner do topo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Imagem do banner</Label>
                  <p className="mb-2 mt-1 text-xs font-semibold text-muted-foreground">
                    Tamanho recomendado: {BANNER_RECOMMENDED_WIDTH} x {BANNER_RECOMMENDED_HEIGHT}px. Deixe o conteudo principal centralizado para nao cortar no celular.
                  </p>
                  <Input type="file" accept="image/*" onChange={handleBannerUpload} />
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    Depois de escolher a imagem ou ajustar a posicao, clique em Salvar banner.
                  </p>
                </div>

                {bannerImage && (
                  <>
                    <div
                      className="overflow-hidden rounded-lg border bg-muted"
                      style={{ aspectRatio: `${BANNER_RECOMMENDED_WIDTH} / ${BANNER_RECOMMENDED_HEIGHT}` }}
                    >
                      <img
                        src={bannerImage}
                        alt="Preview do banner"
                        className="h-full w-full object-cover"
                        style={{ objectPosition: `${bannerPositionX}% ${bannerPositionY}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold text-muted-foreground md:grid-cols-4">
                      <span>Arte: {BANNER_RECOMMENDED_WIDTH} x {BANNER_RECOMMENDED_HEIGHT}px</span>
                      <span>Horizontal: {bannerPositionX}%</span>
                      <span>Vertical: {bannerPositionY}%</span>
                      <span>Altura no site: {bannerHeight}px</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch checked={showBanner} onCheckedChange={checked => { setStoreFormDirty(true); setShowBanner(checked); }} />
                      <Label>Banner ativo no topo da vitrine</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch checked={showHeaderName} onCheckedChange={checked => { setStoreFormDirty(true); setShowHeaderName(checked); }} />
                      <Label>Nome da loja visivel sobre o banner</Label>
                    </div>

                    <div>
                      <Label>Ajuste horizontal</Label>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        value={bannerPositionX}
                        onChange={e => { setStoreFormDirty(true); setBannerPositionX(e.target.value); }}
                      />
                    </div>

                    <div>
                      <Label>Ajuste vertical</Label>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        value={bannerPositionY}
                        onChange={e => { setStoreFormDirty(true); setBannerPositionY(e.target.value); }}
                      />
                    </div>

                    <div>
                      <Label>Altura do banner</Label>
                      <Input
                        type="range"
                        min="140"
                        max="420"
                        value={bannerHeight}
                        onChange={e => { setStoreFormDirty(true); setBannerHeight(e.target.value); }}
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button className="gap-2" onClick={saveStoreSettings}>
                        <Save className="h-4 w-4" /> Salvar banner
                      </Button>
                      <Button variant="outline" className="gap-2 text-destructive" onClick={removeBanner}>
                        <Trash2 className="h-4 w-4" /> Remover banner
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "categories" && (
          <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card className="rounded-lg">
              <CardHeader><CardTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome da Categoria</Label>
                  <Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Ex.: Bolos" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={categoryActive} onCheckedChange={setCategoryActive} />
                  <Label>Categoria ativa</Label>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={saveCategory}><Save className="h-4 w-4" /> Salvar</Button>
                  {editingCategory && <Button variant="outline" onClick={resetCategoryForm}>Cancelar</Button>}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {categories.length === 0 ? (
                <Card className="rounded-lg">
                  <CardContent className="py-10 text-center text-muted-foreground">Nenhuma categoria cadastrada.</CardContent>
                </Card>
              ) : categories.map(category => {
                const productCount = products.filter(product => product.categoryId === category.id).length;

                return (
                  <Card key={category.id} className="rounded-lg">
                    <CardContent className="flex items-center gap-4 p-4">
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Tags className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold">{category.name}</p>
                          <span className={category.isActive ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700" : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"}>
                            {category.isActive ? "Ativa" : "Oculta"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{productCount} produto(s)</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" onClick={() => openEditCategory(category)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="text-destructive" onClick={() => handleDeleteCategory(category.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {tab === "products" && (
          <div className="space-y-4">
            {isPromotionalPriceOnlineEnabled === false && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                O preco promocional aparece neste navegador, mas para salvar online adicione a coluna promotional_price na tabela products do Supabase.
              </div>
            )}
            <Button className="gap-2" onClick={openNewProduct}><Plus className="h-4 w-4" /> Novo Produto</Button>

            <div className="grid gap-4">
              {products.map(p => (
                <Card key={p.id} className="rounded-lg">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-primary"><Image className="h-6 w-6" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold">{p.name}</p>
                        {(p.isPromo || hasPromotionalPrice(p)) && <span className="rounded-full bg-promo px-2 py-0.5 text-xs text-promo-foreground">Oferta</span>}
                      </div>
                      <div className="text-sm">
                        {hasPromotionalPrice(p) && (
                          <span className="mr-2 text-muted-foreground line-through">{formatPrice(p.price)}</span>
                        )}
                        <span className="font-bold text-primary">{formatPrice(getProductPrice(p))}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {categories.find(category => category.id === p.categoryId)?.name || "Sem categoria"} - Estoque: {p.stock}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" onClick={() => openEditProduct(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-display text-4xl text-[#f0d8c0]">Pedidos</h1>
                <p className="text-sm font-semibold text-[#d8c0a8]">Pedidos organizados por cliente, valor, data e entrega.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <span className="rounded-lg border border-[#603000] bg-[#481800] px-3 py-2 font-bold text-[#f0d8a8]">{orders.length} pedido(s)</span>
                <span className="rounded-lg border border-[#603000] bg-[#481800] px-3 py-2 font-bold text-green-300">{orders.filter(order => order.status === "entregue").length} entregue(s)</span>
                <span className="rounded-lg border border-[#603000] bg-[#481800] px-3 py-2 font-bold text-yellow-200">{orders.filter(order => order.status !== "entregue").length} a entregar</span>
                <span className="rounded-lg border border-[#603000] bg-[#481800] px-3 py-2 font-bold text-[#f0d8a8]">{orders.filter(order => order.paymentStatus === "pendente").length} pagamento(s) pendente(s)</span>
              </div>
            </div>

            {ordersLoading ? (
              <div className="rounded-[18px] border border-[#603000] bg-[#481800] px-5 py-10 text-center text-sm text-[#d8c0a8]">
                Carregando pedidos...
              </div>
            ) : orderGroups.length === 0 ? (
              <div className="rounded-[18px] border border-[#603000] bg-[#481800] px-5 py-10 text-center text-sm text-[#d8c0a8]">
                Nenhum pedido ainda
              </div>
            ) : (
              <div className="space-y-4">
                {orderGroups.map(group => (
                  <section key={group.customerName} className="overflow-hidden rounded-[18px] border border-[#603000] bg-[#481800]">
                    <div className="flex flex-col gap-2 border-b border-[#603000] px-5 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="font-display text-2xl text-[#f0d8a8]">{group.customerName}</h2>
                        <p className="text-sm font-semibold text-[#d8c0a8]">
                          {group.orders.length} pedido(s) - Total {formatPrice(group.total)}
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-[#f0d8c0] px-3 py-1 text-sm font-bold text-[#481800]">
                        {group.orders.filter(order => order.status === "entregue").length}/{group.orders.length} entregue(s)
                      </span>
                    </div>

                    <div className="divide-y divide-[#603000]">
                      {group.orders.map(order => {
                        const delivered = order.status === "entregue";

                        return (
                          <article key={order.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-[#f0d8c0] lg:grid-cols-[1fr_1.5fr_0.8fr_1fr_1.1fr_auto] lg:items-center">
                            <div>
                              <p className="text-xs font-bold uppercase text-[#d8c0a8]">Data</p>
                              <p className="font-bold">{formatDateTime(order.createdAt)}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase text-[#d8c0a8]">Itens comprados</p>
                              <p className="font-semibold text-[#f0d8c0]">{formatOrderItems(order.items)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase text-[#d8c0a8]">Valor</p>
                              <p className="font-bold text-[#f0d8a8]">{formatPrice(order.total)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase text-[#d8c0a8]">Pagamento</p>
                              <p>{paymentMethodLabel(order.paymentMethod)}</p>
                              <p className={order.paymentStatus === "aprovado" ? "font-bold text-green-300" : order.paymentStatus === "recusado" ? "font-bold text-red-300" : "font-bold text-yellow-200"}>
                                {order.paymentStatus}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase text-[#d8c0a8]">Pedido</p>
                              <p className={delivered ? "font-bold text-green-300" : "font-bold text-yellow-200"}>
                                {delivered ? "Entregue" : "Pendente de entrega"}
                              </p>
                              {order.transactionId && <p className="break-all text-xs text-[#d8c0a8]">Transacao: {order.transactionId}</p>}
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className={delivered
                                  ? "w-full gap-2 border-yellow-300 bg-transparent text-yellow-100 hover:bg-yellow-950/40 hover:text-yellow-50"
                                  : "w-full gap-2 border-green-300 bg-transparent text-green-100 hover:bg-green-950/40 hover:text-green-50"}
                                disabled={updatingOrderStatusId === order.id || deletingOrderId === order.id}
                                onClick={() => void toggleOrderDeliveryStatus(order)}
                              >
                                {delivered ? <ClipboardList className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                                {delivered ? "Marcar pendente" : "Marcar entregue"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full gap-2 border-red-300 bg-transparent text-red-200 hover:bg-red-950/40 hover:text-red-100"
                                disabled={deletingOrderId === order.id || updatingOrderStatusId === order.id}
                                onClick={() => void handleDeleteOrder(order)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Apagar
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "clients" && (
          <div className="space-y-6">
            <h1 className="font-display text-4xl text-[#f0d8c0]">Clientes</h1>
            <Card className="rounded-lg border-[#603000] bg-[#481800] text-[#f0d8c0]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Enviar aviso em massa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                  <div>
                    <Label>Titulo</Label>
                    <Input
                      value={pushTitle}
                      maxLength={80}
                      onChange={event => setPushTitle(event.target.value)}
                      className="border-[#603000] bg-[#301000] text-[#f0d8c0]"
                    />
                  </div>
                  <div>
                    <Label>Destino</Label>
                    <Input
                      value={pushUrl}
                      onChange={event => setPushUrl(event.target.value)}
                      placeholder="/"
                      className="border-[#603000] bg-[#301000] text-[#f0d8c0]"
                    />
                  </div>
                </div>
                <div>
                  <Label>Descricao</Label>
                  <Textarea
                    value={pushMessage}
                    maxLength={240}
                    onChange={event => setPushMessage(event.target.value)}
                    placeholder="Ex: Temos promoção de brigadeiro hoje ate acabar o estoque."
                    className="min-h-28 border-[#603000] bg-[#301000] text-[#f0d8c0] placeholder:text-[#d8c0a8]"
                  />
                  <p className="mt-1 text-xs text-[#d8c0a8]">{pushMessage.length}/240 caracteres</p>
                </div>
                <Button className="w-full gap-2" disabled={sendingPush} onClick={() => void sendPushBroadcast()}>
                  <Send className="h-4 w-4" />
                  {sendingPush ? "Enviando..." : "Enviar para clientes inscritos"}
                </Button>
              </CardContent>
            </Card>
            <div className="overflow-hidden rounded-[18px] border border-[#603000] bg-[#481800]">
              <div className="grid grid-cols-5 gap-4 border-b border-[#603000] px-5 py-4 text-sm font-bold uppercase text-[#f0d8a8]">
                <span>Nome</span>
                <span>WhatsApp</span>
                <span>Empresa</span>
                <span>Status</span>
                <span>Acoes</span>
              </div>
              {customersLoading ? (
                <div className="px-5 py-10 text-center text-sm text-[#d8c0a8]">Carregando clientes...</div>
              ) : customers.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[#d8c0a8]">Nenhum cliente ainda</div>
              ) : (
                <div className="divide-y divide-[#603000]">
                  {customers.map(customer => (
                    <div key={customer.id} className="grid grid-cols-1 gap-2 px-5 py-4 text-sm text-[#f0d8c0] md:grid-cols-5 md:items-center md:gap-4">
                      <span className="font-bold">{customer.nome}</span>
                      <span>{formatPhone(customer.telefone)}</span>
                      <span>{customer.empresa_unidade}</span>
                      <span className={customer.status === "ativo" ? "font-bold text-green-300" : "font-bold text-red-300"}>{customer.status}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit gap-2 border-red-300 bg-transparent text-red-200 hover:bg-red-950/40 hover:text-red-100"
                        disabled={deletingCustomerId === customer.id}
                        onClick={() => void handleDeleteCustomer(customer)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            {editingProduct && autoSaveMessage && (
              <p className="text-xs font-semibold text-muted-foreground">{autoSaveMessage}</p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={pName} onChange={e => setPName(e.target.value)} /></div>
            <div><Label>Preco (R$)</Label><Input type="number" step="0.01" value={pPrice} onChange={e => setPPrice(e.target.value)} /></div>
            <div><Label>Preco promocional (R$)</Label><Input type="number" step="0.01" value={pPromotionalPrice} onChange={e => setPPromotionalPrice(e.target.value)} placeholder="Opcional" /></div>
            <div><Label>Descricao</Label><Textarea value={pDesc} onChange={e => setPDesc(e.target.value)} /></div>
            <div>
              <Label>Categoria</Label>
              <select
                value={pCategoryId}
                onChange={e => setPCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Sem categoria</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div><Label>Estoque</Label><Input type="number" value={pStock} onChange={e => setPStock(e.target.value)} /></div>
            <div>
              <Label>Imagem</Label>
              <Input type="file" accept="image/*" onChange={handleProductImageUpload} />
              {pImage && <img src={pImage} alt="Preview" className="mt-2 h-32 w-full rounded-lg border object-cover" />}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pPromo} onCheckedChange={setPPromo} />
              <Label>Destacar como promocao</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveProduct}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
