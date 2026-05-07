import { Package, ShoppingCart, Star } from "lucide-react";
import { Product } from "@/types/store";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const ProductCard = ({ product }: { product: Product }) => {
  const { addToCart, categories } = useStore();
  const isSoldOut = product.stock === 0;
  const category = categories.find(item => item.id === product.categoryId);

  return (
    <article className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm ring-1 ring-transparent transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:ring-primary/10">
      {product.isPromo && (
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

      <div className="space-y-3 p-4">
        <div>
          {category && (
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">{category.name}</p>
          )}
          <h3 className="line-clamp-2 min-h-14 text-lg font-bold leading-tight text-card-foreground">{product.name}</h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{product.description}</p>
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
          <span className="text-2xl font-extrabold text-primary">{formatPrice(product.price)}</span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            <Package className="h-3 w-3" /> {product.stock > 0 ? `${product.stock} un.` : "sem estoque"}
          </span>
        </div>

        <div className="pt-1">
          <Button
            className="w-full gap-2 font-semibold"
            size="sm"
            disabled={isSoldOut}
            onClick={() => addToCart(product)}
          >
            <ShoppingCart className="h-4 w-4" /> Comprar
          </Button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
