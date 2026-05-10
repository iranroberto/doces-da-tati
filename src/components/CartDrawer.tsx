import { MessageCircle, Minus, Package, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useStore } from "@/context/StoreContext";
import { getProductPrice } from "@/lib/pricing";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCustomerAuthOpen: () => void;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const CartDrawer = ({ open, onClose, onCustomerAuthOpen }: CartDrawerProps) => {
  const { cart, updateCartQty, removeFromCart, clearCart, cartTotal, config } = useStore();
  const { customer } = useCustomerAuth();

  const finishOrder = () => {
    if (!customer) {
      toast.error("Entre com seu telefone para finalizar.");
      onCustomerAuthOpen();
      return;
    }

    const order = {
      createdAt: new Date().toISOString(),
      customer: {
        id: customer.id,
        name: customer.nome,
        whatsapp: customer.telefone,
        companyUnit: customer.empresa_unidade,
        status: customer.status,
        limit: customer.limite,
      },
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: getProductPrice(item.product),
        quantity: item.quantity,
        image: item.product.image,
      })),
      total: cartTotal,
    };

    localStorage.setItem("pending_checkout", JSON.stringify(order));
    window.open(`${window.location.origin}${window.location.pathname}#/checkout`, "_blank", "noopener,noreferrer");
    onClose();
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
                  <p className="text-sm font-bold text-primary">{formatPrice(getProductPrice(item.product) * item.quantity)}</p>
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
            <div className="w-full rounded-lg border border-border bg-muted/40 p-3 text-left">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-4 w-4" />
                </span>
                <p className="font-bold">Cliente</p>
              </div>
              {customer ? (
                <div className="space-y-1 text-sm">
                  <p className="font-bold">{customer.nome}</p>
                  <p className="text-muted-foreground">{formatPhone(customer.telefone)}</p>
                  <p className="text-muted-foreground">{customer.empresa_unidade}</p>
                  <div className="mt-2 flex items-center justify-between rounded-md bg-background px-3 py-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Limite fiado</span>
                    <span className="font-bold text-primary">{formatPrice(customer.limite)}</span>
                  </div>
                </div>
              ) : (
                <Button className="w-full gap-2" onClick={onCustomerAuthOpen}>
                  <UserRound className="h-4 w-4" /> Entrar ou criar conta
                </Button>
              )}
            </div>
            <div className="flex w-full items-center justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-primary">{formatPrice(cartTotal)}</span>
            </div>
            {config.whatsapp ? (
              <Button className="w-full gap-2 bg-green-600 text-base font-bold text-white hover:bg-green-700" onClick={finishOrder}>
                <MessageCircle className="h-5 w-5" /> Finalizar Pedido
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
