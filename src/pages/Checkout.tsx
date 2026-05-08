import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, MessageCircle, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const pixField = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

const sanitizePixText = (value: string, maxLength: number) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, maxLength) || "NAO INFORMADO";

const crc16 = (payload: string) => {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const createPixPayload = (config: { pixKey: string; pixReceiverName: string; pixCity: string }, amount: number) => {
  const key = config.pixKey.trim();
  if (!key || amount <= 0) return "";

  const merchantAccount = pixField("26", [
    pixField("00", "br.gov.bcb.pix"),
    pixField("01", key),
    pixField("02", "Pedido doces da tati"),
  ].join(""));

  const payloadWithoutCrc = [
    pixField("00", "01"),
    merchantAccount,
    pixField("52", "0000"),
    pixField("53", "986"),
    pixField("54", amount.toFixed(2)),
    pixField("58", "BR"),
    pixField("59", sanitizePixText(config.pixReceiverName, 25)),
    pixField("60", sanitizePixText(config.pixCity, 15)),
    pixField("62", pixField("05", "***")),
  ].join("");

  const payloadForCrc = `${payloadWithoutCrc}6304`;
  return `${payloadForCrc}${crc16(payloadForCrc)}`;
};

const loadPendingCheckout = (): PendingCheckout | null => {
  try {
    const raw = localStorage.getItem("pending_checkout");
    const value = raw ? JSON.parse(raw) : null;
    if (!value || !Array.isArray(value.items)) return null;

    return {
      createdAt: String(value.createdAt ?? ""),
      customer: value.customer
        ? {
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
    };
  } catch {
    return null;
  }
};

const Checkout = () => {
  const { config } = useStore();
  const [order, setOrder] = useState<PendingCheckout | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    setOrder(loadPendingCheckout());
  }, []);

  const whatsappUrl = useMemo(() => {
    if (!order || !config.whatsapp) return "";

    const customerName = String(order.customer?.name ?? "").trim();
    const customerWhatsapp = String(order.customer?.whatsapp ?? "").trim();
    const items = order.items
      .map(item => `- ${item.quantity}x ${item.name} - ${formatPrice(item.price * item.quantity)}`)
      .join("\n");
    const message = [
      "Ola! Segue meu pedido e comprovante do Pix.",
      "",
      customerName ? `Cliente: ${customerName}` : "",
      customerWhatsapp ? `WhatsApp: ${customerWhatsapp}` : "",
      items,
      "",
      `Total: ${formatPrice(order.total)}`,
      config.pixKey ? `Chave Pix usada: ${config.pixKey}` : "",
    ].filter(Boolean).join("\n");

    return `https://wa.me/${config.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  }, [config.pixKey, config.whatsapp, order]);

  const pixPayload = useMemo(() => {
    if (!order) return "";
    return createPixPayload(config, order.total);
  }, [config, order]);

  const copyText = async (text: string, successMessage: string) => {
    if (!text) {
      toast.error("Pix nao configurado.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error("Nao foi possivel copiar.");
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

            <Button
              className="w-full gap-2"
              disabled={!config.pixKey}
              onClick={async () => {
                await copyText(config.pixKey, "Chave Pix copiada!");
                setCopiedKey(true);
              }}
            >
              {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar chave Pix
            </Button>

            <div>
              <p className="text-sm font-bold">Pix copia e cola</p>
              <Textarea
                readOnly
                value={pixPayload || "Configure a chave Pix no painel admin para gerar o Pix copia e cola."}
                className="mt-1 min-h-28 resize-none text-xs"
              />
            </div>

            <Button
              className="w-full gap-2"
              disabled={!pixPayload}
              onClick={async () => {
                await copyText(pixPayload, "Pix copia e cola copiado!");
                setCopiedPix(true);
              }}
            >
              {copiedPix ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar Pix copia e cola
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
