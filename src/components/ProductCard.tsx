import { useEffect, useState } from "react";
import { Package, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
import { Product } from "@/types/store";
import { useStore } from "@/context/StoreContext";
import { getProductPrice, hasPromotionalPrice } from "@/lib/pricing";
import { getProductRatingSummary, type ProductRatingSummary } from "@/lib/ratings";
import { Button } from "@/components/ui/button";

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const ProductCard = ({ product }: { product: Product }) => {
  const { addToCart, cart, categories } = useStore();
  const [ratingSummary, setRatingSummary] = useState<ProductRatingSummary>({ average: 0, count: 0 });
  const isSoldOut = product.stock === 0;
  const category = categories.find(item => item.id === product.categoryId);
  const cartItem = cart.find(item => item.product.id === product.id);
  const cartQuantity = cartItem?.quantity ?? 0;
  const productPrice = getProductPrice(product);
  const showPromotionalPrice = hasPromotionalPrice(product);

  useEffect(() => {
    let isMounted = true;

    getProductRatingSummary(product.id)
      .then(summary => {
        if (isMounted) setRatingSummary(summary);
      })
      .catch(error => {
        console.error("Erro ao carregar avaliacao do produto:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [product.id]);

  const handleBuy = () => {
    if (cartQuantity >= product.stock) {
      toast.error("Estoque maximo no carrinho", {
        description: `${product.name} ja esta com ${product.stock} un. no carrinho.`,
      });
      return;
    }

    addToCart(product);
    toast.success("Item adicionado ao carrinho", {
      description: `${product.name} - ${formatPrice(productPrice)}`,
    });
  };

  return (
    <article className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm ring-1 ring-transparent transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:ring-primary/10">
      {(product.isPromo || showPromotionalPrice) && (
        <div className="absolute left-3 top-3 z-10 animate-pulse-promo">
          <span className="inline-flex items-center gap-1 rounded-full bg-promo px-3 py-1 text-xs font-bold uppercase tracking-wide text-promo-foreground shadow-lg">
            <Star className="h-3 w-3 fill-current" /> Oferta
          </span>
        </div>
      )}

      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,hsl(var(--secondary)/0.35),transparent_42%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--primary)/0.08))] text-primary">
            <Package className="h-14 w-14" />
            <span className="text-sm font-semibold text-muted-foreground">Imagem do produto</span>
          </div>
        )}
        {isSoldOut && <div className="absolute inset-0 flex items-center justify-center bg-background/75 text-sm font-bold text-destructive">Esgotado</div>}
      </div>

      <div className="space-y-2 p-3 sm:space-y-3 sm:p-4">
        <div>
          {category && (
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">{category.name}</p>
          )}
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-tight text-card-foreground sm:min-h-14 sm:text-lg">{product.name}</h3>
          {ratingSummary.count > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs font-bold text-primary">
              <span className="flex items-center gap-0.5" aria-label={`Media ${ratingSummary.average.toFixed(1)} de 5 estrelas`}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className={index < Math.round(ratingSummary.average) ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5 text-muted-foreground/40"}
                  />
                ))}
              </span>
              <span className="text-muted-foreground">{ratingSummary.average.toFixed(1)} ({ratingSummary.count})</span>
            </div>
          )}
          <p className="mt-1 line-clamp-2 min-h-9 text-xs text-muted-foreground sm:min-h-10 sm:text-sm">{product.description}</p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            {showPromotionalPrice && (
              <span className="block text-xs font-semibold text-muted-foreground line-through sm:text-sm">
                {formatPrice(product.price)}
              </span>
            )}
            <span className="block text-base font-extrabold text-primary sm:text-2xl">{formatPrice(productPrice)}</span>
          </div>
          <span className="flex w-fit shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            <Package className="h-3 w-3" /> {product.stock > 0 ? `${product.stock} un.` : "sem estoque"}
          </span>
        </div>

        <div className="pt-1">
          <Button
            className="w-full gap-2 font-semibold"
            size="sm"
            disabled={isSoldOut}
            onClick={handleBuy}
          >
            <ShoppingCart className="h-4 w-4" /> Comprar
          </Button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
