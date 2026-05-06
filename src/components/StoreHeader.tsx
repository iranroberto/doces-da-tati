import { Link } from "react-router-dom";
import { CakeSlice, ShoppingCart } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";

interface StoreHeaderProps {
  onCartOpen: () => void;
}

const StoreHeader = ({ onCartOpen }: StoreHeaderProps) => {
  const { config, cartCount } = useStore();

  return (
    <header className="sticky top-0 z-40 border-b border-primary-foreground/15 bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-4">
          {config.logo ? (
            <img src={config.logo} alt={config.name} className="h-16 w-16 rounded-full border-4 border-primary-foreground bg-primary-foreground object-cover shadow-lg md:h-20 md:w-20" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary-foreground bg-primary-foreground text-primary shadow-lg md:h-20 md:w-20">
              <CakeSlice className="h-8 w-8 md:h-10 md:w-10" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl tracking-wide drop-shadow-sm md:text-5xl">{config.name}</h1>
            <p className="hidden text-sm font-semibold opacity-95 sm:block md:text-base">doces, bolos e salgados por encomenda</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-primary-foreground/20" onClick={onCartOpen} aria-label="Abrir carrinho">
            <ShoppingCart className="h-6 w-6" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-xs font-bold text-secondary-foreground">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default StoreHeader;
