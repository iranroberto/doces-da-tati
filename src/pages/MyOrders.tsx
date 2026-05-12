import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Package, ReceiptText, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { loadLocalOrders, normalizePaymentStatus, parseOrderItems, paymentMethodLabel, type OrderItemDraft, type PaymentStatus } from "@/lib/orders";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface CustomerOrder {
  id: string;
  createdAt: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  items: OrderItemDraft[];
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const mapOrderRows = (rows: Record<string, unknown>[]): CustomerOrder[] =>
  rows.map(row => ({
    id: String(row.id ?? ""),
    createdAt: String(row.criado_em ?? ""),
    total: Number(row.total ?? 0),
    status: String(row.status ?? "aberto"),
    paymentMethod: String(row.forma_pagamento ?? "pix"),
    paymentStatus: normalizePaymentStatus(row.status_pagamento),
    items: parseOrderItems(row.itens),
  }));

const MyOrders = () => {
  const { customer, isCustomerLoading } = useCustomerAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isCustomerLoading) return;

    if (!customer) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadOrders = async () => {
      if (!supabase || !isSupabaseConfigured) {
        return loadLocalOrders()
          .filter(order => order.customerId === customer.id || order.customerWhatsapp === customer.telefone)
          .map(order => ({
            id: order.id,
            createdAt: order.createdAt,
            total: order.total,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            items: order.items,
          }));
      }

      const result = await supabase
        .from("pedidos")
        .select("id, criado_em, status, total, forma_pagamento, status_pagamento, itens")
        .eq("cliente_id", customer.id)
        .order("criado_em", { ascending: false });

      if (result.error) {
        const code = String(result.error.code ?? "");
        if (code === "42703" || code === "PGRST204") {
          const legacyResult = await supabase
            .from("pedidos")
            .select("id, criado_em, status, total, forma_pagamento, status_pagamento")
            .eq("cliente_id", customer.id)
            .order("criado_em", { ascending: false });

          if (legacyResult.error) throw legacyResult.error;
          return mapOrderRows(legacyResult.data ?? []);
        }

        throw result.error;
      }

      return mapOrderRows(result.data ?? []);
    };

    loadOrders()
      .then(nextOrders => {
        if (isMounted) setOrders(nextOrders);
      })
      .catch(error => {
        console.error("Erro ao carregar pedidos do cliente:", error);
        if (isMounted) setOrders([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [customer, isCustomerLoading]);

  const totals = useMemo(() => ({
    paid: orders.filter(order => order.paymentStatus === "aprovado").length,
    delivered: orders.filter(order => order.status === "entregue").length,
  }), [orders]);

  if (!customer && !isCustomerLoading) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 text-center">
          <ReceiptText className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="font-display text-2xl">Meus pedidos</h1>
          <p className="mt-2 text-sm text-muted-foreground">Entre na sua conta para acompanhar seus pedidos.</p>
          <Button className="mt-5 gap-2" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar para loja</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" asChild>
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="font-display text-xl">Meus pedidos</h1>
            <p className="text-sm opacity-90">{customer?.nome}</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto space-y-5 px-4 py-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-bold text-muted-foreground">Pedidos</p>
            <p className="mt-2 font-display text-3xl text-primary">{orders.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-bold text-muted-foreground">Pagos</p>
            <p className="mt-2 font-display text-3xl text-green-700">{totals.paid}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-bold text-muted-foreground">Entregues</p>
            <p className="mt-2 font-display text-3xl text-primary">{totals.delivered}</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Carregando seus pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-bold">Nenhum pedido encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Quando voce finalizar uma compra, ela aparecera aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <article key={order.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">Pedido de {formatDateTime(order.createdAt)}</p>
                    <p className="text-sm text-muted-foreground">{paymentMethodLabel(order.paymentMethod)}</p>
                  </div>
                  <p className="font-bold text-primary">{formatPrice(order.total)}</p>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Itens</p>
                    {order.items.length > 0 ? (
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div key={`${order.id}-${item.productId}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">Itens nao registrados neste pedido.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 md:flex-col">
                    <span className={order.paymentStatus === "aprovado"
                      ? "inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800"
                      : "inline-flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-sm font-bold text-yellow-900"}
                    >
                      {order.paymentStatus === "aprovado" ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      {order.paymentStatus === "aprovado" ? "Pago" : "Pagamento pendente"}
                    </span>
                    <span className={order.status === "entregue"
                      ? "inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary"
                      : "inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground"}
                    >
                      <Truck className="h-4 w-4" />
                      {order.status === "entregue" ? "Entregue" : "Em preparo"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default MyOrders;
