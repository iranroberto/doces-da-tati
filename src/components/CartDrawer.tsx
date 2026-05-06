import { Copy, MessageCircle, Minus, Package, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { buildPixPayload } from "@/lib/pix";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const CartDrawer = ({ open, onClose }: CartDrawerProps) => {
  const { cart, updateCartQty, removeFromCart, clearCart, cartTotal, config } = useStore();
  const pixPayload = buildPixPayload({
    key: config.pixKey,
    amount: cartTotal,
    receiverName: config.pixReceiverName,
    city: config.pixCity,
    description: "Pedido doce da tati",
    txid: `TATI${Math.round(cartTotal * 100)}`,
  });
  const pixQrUrl = pixPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixPayload)}`
    : "";

  const copyPixCode = async () => {
    if (!pixPayload) return;

    try {
      await navigator.clipboard.writeText(pixPayload);
      toast.success("Codigo Pix copiado!");
    } catch {
      toast.error("Nao foi possivel copiar. Selecione o codigo manualmente.");
    }
  };

  const buildWhatsAppOrder = () => {
    const items = cart.map(i => `- ${i.quantity}x ${i.product.name} - ${formatPrice(i.product.price * i.quantity)}`).join("\n");
    const payment = pixPayload ? `\n\nPix copia e cola:\n${pixPayload}` : "";
    const msg = `Ola! Gostaria de fazer o seguinte pedido:\n\n${items}\n\nTotal: ${formatPrice(cartTotal)}${payment}`;
    return `https://wa.me/${(config.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Seu Carrinho</SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingBagIcon />
            <p>Seu carrinho esta vazio</p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.product.image ? (
                    <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.product.name}</p>
                  <p className="text-sm font-bold text-primary">{formatPrice(item.product.price * item.quantity)}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateCartQty(item.product.id, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" disabled={item.quantity >= item.product.stock} onClick={() => updateCartQty(item.product.id, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeFromCart(item.product.id)} aria-label={`Remover ${item.product.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <SheetFooter className="flex-col gap-3 border-t border-border pt-4">
            <div className="flex w-full items-center justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-primary">{formatPrice(cartTotal)}</span>
            </div>
            {pixPayload && (
              <div className="w-full rounded-lg border border-border bg-card p-3 text-left">
                <div className="mb-3 flex items-center gap-2 font-bold text-card-foreground">
                  <QrCode className="h-4 w-4 text-primary" /> Pagar com Pix
                </div>
                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <img src={pixQrUrl} alt="QR Code Pix" className="mx-auto h-28 w-28 rounded-md border bg-white p-1" />
                  <div className="space-y-2">
                    <Textarea value={pixPayload} readOnly className="h-24 resize-none text-xs" />
                    <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={copyPixCode}>
                      <Copy className="h-4 w-4" /> Copiar codigo Pix
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {!pixPayload && (
              <p className="text-center text-sm text-muted-foreground">Configure a chave Pix no painel admin para gerar codigo e QR Code.</p>
            )}
            {config.whatsapp ? (
              <Button className="w-full gap-2 bg-green-600 text-base font-bold text-white hover:bg-green-700" asChild>
                <a href={buildWhatsAppOrder()} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" /> Finalizar pelo WhatsApp
                </a>
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Configure o WhatsApp no painel admin para finalizar pedidos.</p>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={clearCart}>Limpar Carrinho</Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

const ShoppingBagIcon = () => (
  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
    <Package className="h-8 w-8" />
  </span>
);

export default CartDrawer;
