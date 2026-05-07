import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgePercent, Clock, MessageCircle, PackageCheck, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import CartDrawer from "@/components/CartDrawer";
import ProductCard from "@/components/ProductCard";
import StoreHeader from "@/components/StoreHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductFilter = "all" | "promo" | "available";

const Index = () => {
  const { config, categories, products } = useStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const visibleCategories = useMemo(() => categories.filter(category => category.isActive), [categories]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter(product => {
      const matchesSearch = !term || [product.name, product.description].some(value => value.toLowerCase().includes(term));
      const matchesCategory = categoryFilter === "all" || product.categoryId === categoryFilter;
      const matchesFilter =
        filter === "all" ||
        (filter === "promo" && product.isPromo) ||
        (filter === "available" && product.stock > 0);

      return matchesSearch && matchesCategory && matchesFilter;
    });
  }, [categoryFilter, filter, products, search]);

  const promoCount = products.filter(product => product.isPromo).length;
  const availableCount = products.filter(product => product.stock > 0).length;
  const whatsappUrl = config.whatsapp ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}` : "";

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader onCartOpen={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {promoCount > 0 && (
        <div className="bg-secondary py-2 text-center">
          <p className="text-sm font-bold text-secondary-foreground md:text-base">
            Ofertas especiais disponiveis hoje. Aproveite enquanto durar o estoque.
          </p>
        </div>
      )}

      <section className="border-b border-border bg-card">
        <div className="container mx-auto grid gap-3 px-4 py-4 md:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Pedido rapido</p>
              <p className="text-xs text-muted-foreground">Monte o carrinho e finalize em poucos cliques.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/30 text-secondary-foreground">
              <BadgePercent className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">{promoCount} ofertas ativas</p>
              <p className="text-xs text-muted-foreground">Produtos em destaque aparecem para voce.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Pix e WhatsApp</p>
              <p className="text-xs text-muted-foreground">Pagamento facilitado e atendimento direto.</p>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        <section className="mb-8 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3 w-3" /> Encomendas especiais
              </div>
              <h2 className="font-display text-2xl text-foreground md:text-3xl">
                Doces para festa, lembrancinhas e pedidos do dia
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Escolha seus produtos, gere Pix no carrinho ou chame pelo WhatsApp para combinar detalhes da encomenda.
              </p>
            </div>
            {whatsappUrl && (
              <Button className="gap-2 bg-green-600 font-bold text-white hover:bg-green-700" asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" /> Falar com a loja
                </a>
              </Button>
            )}
          </div>
        </section>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Cardapio</p>
            <h2 className="font-display text-3xl text-foreground">Nossos Produtos</h2>
            <p className="mt-1 text-sm text-muted-foreground">{availableCount} produtos disponiveis para pedido</p>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nome ou descricao"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            Todos
          </Button>
          <Button variant={filter === "promo" ? "default" : "outline"} size="sm" onClick={() => setFilter("promo")}>
            Ofertas
          </Button>
          <Button variant={filter === "available" ? "default" : "outline"} size="sm" onClick={() => setFilter("available")}>
            Disponiveis
          </Button>
        </div>

        {visibleCategories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Button variant={categoryFilter === "all" ? "secondary" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>
              Todas categorias
            </Button>
            {visibleCategories.map(category => (
              <Button
                key={category.id}
                variant={categoryFilter === category.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card py-20 text-center text-muted-foreground">
            <PackageCheck className="mx-auto mb-4 h-12 w-12" />
            <p className="text-lg">Nenhum produto cadastrado ainda.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card py-16 text-center text-muted-foreground">
            <Search className="mx-auto mb-4 h-10 w-10" />
            <p className="text-lg">Nenhum produto encontrado para sua busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <footer className="bg-muted py-6 text-center text-sm text-muted-foreground">
        <p>(c) {new Date().getFullYear()} {config.name} - Todos os direitos reservados</p>
        <Link to="/admin" className="mt-2 inline-block text-xs font-medium text-muted-foreground/80 hover:text-primary">
          Acesso restrito
        </Link>
      </footer>

      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-xl transition hover:scale-105 hover:bg-green-700"
          aria-label="Falar pelo WhatsApp"
        >
          <MessageCircle className="h-7 w-7" />
        </a>
      )}
    </div>
  );
};

export default Index;
