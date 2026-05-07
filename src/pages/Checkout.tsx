import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, MessageCircle, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";

interface CheckoutItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface PendingCheckout {
  createdAt: string;
  items: CheckoutItem[];
  total: number;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const loadPendingCheckout = (): PendingCheckout | null => {
  try {
    const raw = localStorage.getItem("pending_checkout");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const Checkout = () => {
  const { config } = useStore();
  const [order, setOrder] = useState<PendingCheckout | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrder(loadPendingCheckout());
  }, []);

  const whatsappUrl = useMemo(() => {
    if (!order || !config.whatsapp) return "";

    const items = order.items
      .map(item => `- ${item.quantity}x ${item.name} - ${formatPrice(item.price * item.quantity)}`)
      .join("\n");
    const message = [
      "Ola! Segue meu pedido e comprovante do Pix.",
      "",
      items,
      "",
      `Total: ${formatPrice(order.total)}`,
      config.pixKey ? `Chave Pix usada: ${config.pixKey}` : "",
    ].filter(Boolean).join("\n");

    return `https://wa.me/${config.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  }, [config.pixKey, config.whatsapp, order]);

  const copyPixKeyAndOpenWhatsApp = async () => {
    if (!config.pixKey) {
      toast.error("Chave Pix nao configurada.");
      return;
    }

    try {
      await navigator.clipboard.writeText(config.pixKey);
      setCopied(true);
      toast.success("Chave Pix copiada!");
    } catch {
      toast.error("Nao foi possivel copiar a chave Pix.");
    }

    if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
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

      <div className="container mx-auto grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Produtos</h2>
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

        <aside className="h-fit rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3 text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>

          <div className="space-y-3 py-4">
            <div>
              <p className="text-sm font-bold">Chave Pix</p>
              <p className="mt-1 break-all rounded-md border border-border bg-muted px-3 py-2 text-sm">
                {config.pixKey || "Chave Pix nao configurada"}
              </p>
            </div>

            <Button className="w-full gap-2" disabled={!config.pixKey} onClick={copyPixKeyAndOpenWhatsApp}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar chave Pix
            </Button>

            {whatsappUrl ? (
              <Button className="w-full gap-2 bg-green-600 font-bold text-white hover:bg-green-700" asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" /> Enviar comprovante
                </a>
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">WhatsApp nao configurado no painel admin.</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default Checkout;
