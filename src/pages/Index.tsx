import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PackageCheck, Search } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import CartDrawer from "@/components/CartDrawer";
import CustomerAuthDialog from "@/components/CustomerAuthDialog";
import ProductCard from "@/components/ProductCard";
import StoreHeader from "@/components/StoreHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductFilter = "all" | "promo" | "available";

const Index = () => {
  const { config, categories, products } = useStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [customerAuthOpen, setCustomerAuthOpen] = useState(false);
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
  const productFilters = [
    { id: "all" as const, label: config.filterAllLabel, visible: config.showFilterAll },
    { id: "promo" as const, label: config.filterPromoLabel, visible: config.showFilterPromo },
    { id: "available" as const, label: config.filterAvailableLabel, visible: config.showFilterAvailable },
  ].filter(item => item.visible && item.label.trim());

  useEffect(() => {
    if (filter === "promo" && !config.showFilterPromo) setFilter("all");
    if (filter === "available" && !config.showFilterAvailable) setFilter("all");
  }, [config.showFilterAvailable, config.showFilterPromo, filter]);

  useEffect(() => {
    if (!config.showCategoryFilter) setCategoryFilter("all");
  }, [config.showCategoryFilter]);

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader onCartOpen={() => setCartOpen(true)} onCustomerAuthOpen={() => setCustomerAuthOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCustomerAuthOpen={() => setCustomerAuthOpen(true)} />
      <CustomerAuthDialog open={customerAuthOpen} onOpenChange={setCustomerAuthOpen} />

      {promoCount > 0 && config.showFilterPromo && (
        <div className="bg-secondary py-2 text-center">
          <p className="text-sm font-bold text-secondary-foreground md:text-base">
            {config.filterPromoLabel} especiais disponiveis hoje. Aproveite enquanto durar o estoque.
          </p>
        </div>
      )}

      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-muted-foreground">{availableCount} produtos disponiveis para pedido</p>
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

        {productFilters.length > 0 && (
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2">
            {productFilters.map(item => (
              <Button
                key={item.id}
                variant={filter === item.id ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        )}

        {visibleCategories.length > 0 && config.showCategoryFilter && (
          <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2">
            <Button variant={categoryFilter === "all" ? "secondary" : "outline"} size="sm" className="shrink-0" onClick={() => setCategoryFilter("all")}>
              {config.categoryAllLabel}
            </Button>
            {visibleCategories.map(category => (
              <Button
                key={category.id}
                variant={categoryFilter === category.id ? "secondary" : "outline"}
                size="sm"
                className="shrink-0"
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
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

    </div>
  );
};

export default Index;
