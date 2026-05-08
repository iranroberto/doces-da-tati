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
      <div className="container mx-auto flex items-center justify-between px-4 py-5">
        <Link to="/" className="flex min-w-0 items-center gap-4 md:gap-5">
          {config.logo ? (
            <img src={config.logo} alt={config.name} className="h-24 w-24 rounded-full border-4 border-primary-foreground bg-primary-foreground object-cover shadow-xl md:h-32 md:w-32" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary-foreground bg-primary-foreground text-primary shadow-xl md:h-32 md:w-32">
              <CakeSlice className="h-10 w-10 md:h-14 md:w-14" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-logo text-4xl font-normal leading-none tracking-normal drop-shadow-sm sm:text-5xl md:text-7xl">{config.name}</h1>
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
