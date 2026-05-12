import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, CheckCircle2, Copy, CreditCard, Loader2, MessageCircle, Package, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "@/context/StoreContext";
import { type PaymentMethod, type PaymentStatus, paymentMethodLabel, registerOrder, updateOrderPayment } from "@/lib/orders";
import { buildPixPayload } from "@/lib/pix";
import { Button } from "@/components/ui/button";
import type { CustomerInfo } from "@/types/store";

interface CheckoutItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface PendingCheckout {
  createdAt: string;
  customer?: CustomerInfo;
  items: CheckoutItem[];
  total: number;
  paymentMethod: string;
  paymentStatus?: PaymentStatus;
  transactionId?: string;
  paidAt?: string;
  registeredOrderId?: string;
}

const paymentOptions: Array<{ id: PaymentMethod; label: string; description: string; icon: typeof QrCode }> = [
  { id: "pix", label: "PIX", description: "Copie a chave ou o Pix copia e cola", icon: QrCode },
  { id: "dinheiro", label: "Dinheiro", description: "Pagamento combinado na entrega", icon: Banknote },
  { id: "credito", label: "Credito", description: "Cartao via Mercado Pago", icon: CreditCard },
  { id: "debito", label: "Debito", description: "Cartao via Mercado Pago", icon: CreditCard },
];

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const loadPendingCheckout = (): PendingCheckout | null => {
  try {
    const raw = localStorage.getItem("pending_checkout");
    const value = raw ? JSON.parse(raw) : null;
    if (!value || !Array.isArray(value.items)) return null;

    return {
      createdAt: String(value.createdAt ?? ""),
      customer: value.customer
        ? {
            id: String(value.customer.id ?? ""),
            name: String(value.customer.name ?? ""),
            whatsapp: String(value.customer.whatsapp ?? ""),
          }
        : undefined,
      items: value.items.map((item: Partial<CheckoutItem>) => ({
        productId: String(item.productId ?? ""),
        name: String(item.name ?? ""),
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
        image: String(item.image ?? ""),
      })),
      total: Number(value.total ?? 0),
      paymentMethod: String(value.paymentMethod ?? ""),
      paymentStatus: value.paymentStatus,
      transactionId: value.transactionId ? String(value.transactionId) : undefined,
      paidAt: value.paidAt ? String(value.paidAt) : undefined,
      registeredOrderId: value.registeredOrderId ? String(value.registeredOrderId) : undefined,
    };
  } catch {
    return null;
  }
};

const savePendingCheckout = (order: PendingCheckout) => {
  localStorage.setItem("pending_checkout", JSON.stringify(order));
};

const getMercadoPagoReturnParams = () => {
  const query = window.location.hash.split("?")[1] || window.location.search.slice(1);
  return new URLSearchParams(query);
};

const Checkout = () => {
  const { config } = useStore();
  const [order, setOrder] = useState<PendingCheckout | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("pix");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pendente");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const savedOrder = loadPendingCheckout();
    setOrder(savedOrder);

    if (savedOrder?.paymentMethod) {
      setSelectedPaymentMethod(savedOrder.paymentMethod as PaymentMethod);
    }

    if (savedOrder?.paymentStatus) {
      setPaymentStatus(savedOrder.paymentStatus);
    }
  }, []);

  useEffect(() => {
    const params = getMercadoPagoReturnParams();
    const paymentId = params.get("payment_id") || params.get("collection_id");
    const orderId = params.get("order_id") || params.get("external_reference") || order?.registeredOrderId;
    const fallbackStatus = params.get("mp_result") === "failure" ? "recusado" : "pendente";

    if (!paymentId || !orderId) return;

    setIsProcessing(true);
    fetch(`/api/get-mercado-pago-payment?payment_id=${encodeURIComponent(paymentId)}&order_id=${encodeURIComponent(orderId)}`)
      .then(response => response.json())
      .then(async result => {
        const nextStatus = (result.status || fallbackStatus) as PaymentStatus;
        setPaymentStatus(nextStatus);
        setSelectedPaymentMethod(result.paymentMethod || selectedPaymentMethod);

        setOrder(current => {
          if (!current) return current;
          const nextOrder = {
            ...current,
            registeredOrderId: orderId,
            paymentMethod: result.paymentMethod || current.paymentMethod || selectedPaymentMethod,
            paymentStatus: nextStatus,
            transactionId: result.paymentId || paymentId,
            paidAt: result.paidAt || current.paidAt,
          };
          savePendingCheckout(nextOrder);
          return nextOrder;
        });
      })
      .catch(error => {
        console.error("Erro ao consultar pagamento Mercado Pago:", error);
        toast.error("Nao foi possivel atualizar o status do pagamento.");
      })
      .finally(() => setIsProcessing(false));
  }, [order?.registeredOrderId, selectedPaymentMethod]);

  useEffect(() => {
    if (!order || order.items.length === 0 || order.registeredOrderId) return;

    let isMounted = true;
    const method = (order.paymentMethod || selectedPaymentMethod || "pix") as PaymentMethod;
    const status = order.paymentStatus || "pendente";

    registerOrder({
      ...order,
      paymentMethod: method,
      paymentStatus: status,
    })
      .then(registeredOrderId => {
        if (!isMounted) return;

        const nextOrder = {
          ...order,
          paymentMethod: method,
          paymentStatus: status,
          registeredOrderId,
        };
        setOrder(nextOrder);
        setSelectedPaymentMethod(method);
        setPaymentStatus(status);
        savePendingCheckout(nextOrder);
      })
      .catch(error => {
        console.error("Erro ao registrar pedido automaticamente:", error);
        toast.error("Nao foi possivel registrar o pedido no painel.");
      });

    return () => {
      isMounted = false;
    };
  }, [order, selectedPaymentMethod]);

  const pixPayload = useMemo(() => {
    if (!order) return "";

    return buildPixPayload({
      key: config.pixKey,
      amount: order.total,
      receiverName: config.pixReceiverName,
      city: config.pixCity,
      description: "Pedido Doces da Tati",
      txid: order.registeredOrderId?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "PEDIDO",
    });
  }, [config.pixCity, config.pixKey, config.pixReceiverName, order]);

  const whatsappUrl = useMemo(() => {
    if (!order || !config.whatsapp) return "";

    const customerName = String(order.customer?.name ?? "").trim();
    const customerWhatsapp = String(order.customer?.whatsapp ?? "").trim();
    const items = order.items
      .map(item => `- ${item.quantity}x ${item.name} - ${formatPrice(item.price * item.quantity)}`)
      .join("\n");
    const message = [
      "Ola! Segue meu pedido.",
      "",
      customerName ? `Cliente: ${customerName}` : "",
      customerWhatsapp ? `WhatsApp: ${customerWhatsapp}` : "",
      items,
      "",
      `Total: ${formatPrice(order.total)}`,
      `Pagamento: ${paymentMethodLabel(selectedPaymentMethod)}`,
      `Status pagamento: ${paymentStatus}`,
      order.transactionId ? `Transacao: ${order.transactionId}` : "",
    ].filter(Boolean).join("\n");

    return `https://wa.me/${config.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  }, [config.whatsapp, order, paymentStatus, selectedPaymentMethod]);

  const copyText = async (text: string, successMessage: string) => {
    if (!text) {
      toast.error("Informacao nao configurada.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error("Nao foi possivel copiar.");
    }
  };

  const ensureRegisteredOrder = async (method: PaymentMethod, status: PaymentStatus) => {
    if (!order) throw new Error("Pedido nao encontrado.");

    const nextOrder = {
      ...order,
      paymentMethod: method,
      paymentStatus: status,
    };
    const registeredOrderId = await registerOrder(nextOrder);
    const savedOrder = { ...nextOrder, registeredOrderId };

    setOrder(savedOrder);
    savePendingCheckout(savedOrder);

    return savedOrder;
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);

    if (!order) return;

    const nextOrder = {
      ...order,
      paymentMethod: method,
      paymentStatus,
    };
    setOrder(nextOrder);
    savePendingCheckout(nextOrder);

    if (!order.registeredOrderId) return;

    updateOrderPayment(order.registeredOrderId, {
      paymentMethod: method,
      paymentStatus,
    }).catch(error => {
      console.error("Erro ao atualizar forma de pagamento:", error);
      toast.error("Nao foi possivel atualizar o pagamento do pedido.");
    });
  };

  const confirmManualPayment = async () => {
    setIsProcessing(true);
    try {
      const savedOrder = await ensureRegisteredOrder(selectedPaymentMethod, "pendente");
      await updateOrderPayment(savedOrder.registeredOrderId!, {
        paymentMethod: selectedPaymentMethod,
        paymentStatus: "pendente",
      });
      toast.success("Pedido registrado!");
    } catch (error) {
      console.error("Erro ao registrar pedido:", error);
      toast.error("Nao foi possivel registrar o pedido.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startMercadoPagoPayment = async () => {
    if (!order) return;

    setIsProcessing(true);
    try {
      const savedOrder = await ensureRegisteredOrder(selectedPaymentMethod, "pendente");
      const response = await fetch("/api/create-mercado-pago-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: savedOrder.registeredOrderId,
          total: savedOrder.total,
          paymentMethod: selectedPaymentMethod,
          customerName: savedOrder.customer?.name,
          items: savedOrder.items,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.initPoint) {
        throw new Error(result.error || "Nao foi possivel iniciar o Mercado Pago.");
      }

      const nextOrder = {
        ...savedOrder,
        transactionId: result.preferenceId,
      };
      setOrder(nextOrder);
      savePendingCheckout(nextOrder);
      window.location.href = result.initPoint;
    } catch (error) {
      console.error("Erro Mercado Pago:", error);
      toast.error(error instanceof Error ? error.message : "Nao foi possivel iniciar o pagamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!order || order.items.length === 0) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="font-display text-2xl">Nenhum pedido encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Volte para a loja e monte seu carrinho.</p>
          <Button className="mt-5 gap-2" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar para loja</Link>
          </Button>
        </div>
      </main>
    );
  }

  const isCardPayment = selectedPaymentMethod === "credito" || selectedPaymentMethod === "debito";

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" asChild>
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="font-display text-xl">Finalizar Pedido</h1>
            <p className="text-sm opacity-90">{config.name}</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto grid gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-2xl">Resumo do pedido</h2>
            <p className="text-sm text-muted-foreground">{order.customer?.name}</p>
          </div>

          {order.items.map(item => (
            <article key={item.productId} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-primary">
                    <Package className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.quantity} x {formatPrice(item.price)}</p>
              </div>
              <p className="font-bold text-primary">{formatPrice(item.price * item.quantity)}</p>
            </article>
          ))}
        </section>

        <aside className="h-fit space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3 text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map(option => {
                const Icon = option.icon;
                const active = selectedPaymentMethod === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={active
                      ? "rounded-lg border-2 border-primary bg-primary/10 p-3 text-left text-primary"
                      : "rounded-lg border border-border bg-background p-3 text-left text-foreground"}
                    onClick={() => handlePaymentMethodChange(option.id)}
                  >
                    <Icon className="mb-2 h-5 w-5" />
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedPaymentMethod === "pix" && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-sm font-bold">PIX</p>
              <p className="break-all text-xs text-muted-foreground">{config.pixKey || "Chave Pix nao configurada"}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="gap-2" disabled={!config.pixKey} onClick={() => void copyText(config.pixKey, "Chave Pix copiada!")}>
                  <Copy className="h-4 w-4" /> Chave
                </Button>
                <Button variant="outline" className="gap-2" disabled={!pixPayload} onClick={() => void copyText(pixPayload, "Pix copia e cola copiado!")}>
                  <Copy className="h-4 w-4" /> Copia e cola
                </Button>
              </div>
            </div>
          )}

          {selectedPaymentMethod === "dinheiro" && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              O pedido sera registrado como pagamento pendente para acerto na entrega.
            </div>
          )}

          {isCardPayment && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              O pagamento sera processado em ambiente seguro do Mercado Pago.
            </div>
          )}

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Status: {paymentStatus}
            </p>
            {order.transactionId && (
              <p className="mt-1 break-all text-xs text-muted-foreground">Transacao: {order.transactionId}</p>
            )}
          </div>

          {isCardPayment ? (
            <Button className="h-11 w-full gap-2 font-bold" disabled={isProcessing} onClick={() => void startMercadoPagoPayment()}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pagar com Mercado Pago
            </Button>
          ) : (
            <Button className="h-11 w-full gap-2 font-bold" disabled={isProcessing} onClick={() => void confirmManualPayment()}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Registrar pedido
            </Button>
          )}

          {whatsappUrl ? (
            <Button className="w-full gap-2 bg-green-600 font-bold text-white hover:bg-green-700" asChild>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Enviar pedido
              </a>
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">WhatsApp nao configurado no painel admin.</p>
          )}
        </aside>
      </div>
    </main>
  );
};

export default Checkout;
