import { Link } from "react-router-dom";
import { CakeSlice, ShoppingCart } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";

interface StoreHeaderProps {
  onCartOpen: () => void;
}

const StoreHeader = ({ onCartOpen }: StoreHeaderProps) => {
  const { config, cartCount } = useStore();
  const match = config.name.match(/^(.*?)(vizio)$/i);
  const prefixName = match?.[1]?.trim();
  const scriptName = match?.[2] || config.name;
  const hasBanner = config.showBanner && config.bannerImage;

  return (
    <header
      className="sticky top-0 z-40 border-b border-primary-foreground/15 bg-primary bg-cover text-primary-foreground shadow-lg"
      style={hasBanner ? {
        backgroundImage: `linear-gradient(90deg, hsl(var(--primary) / 0.82), hsl(var(--primary) / 0.54)), url(${config.bannerImage})`,
        backgroundPosition: `${config.bannerPositionX}% ${config.bannerPositionY}%`,
        minHeight: `${config.bannerHeight}px`,
      } : undefined}
    >
      <div className={hasBanner ? "container mx-auto flex min-h-[inherit] items-center justify-between px-4 py-6" : "container mx-auto flex items-center justify-between px-4 py-5"}>
        <Link to="/" className="flex min-w-0 items-center gap-4 md:gap-5">
          {config.logo ? (
            <img src={config.logo} alt={config.name} className="h-24 w-24 rounded-full border-4 border-primary-foreground bg-primary-foreground object-cover shadow-xl md:h-32 md:w-32" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary-foreground bg-primary-foreground text-primary shadow-xl md:h-32 md:w-32">
              <CakeSlice className="h-10 w-10 md:h-14 md:w-14" />
            </span>
          )}
          {config.showHeaderName && (
            <div className="min-w-0 overflow-visible py-2">
              <h1 className="flex min-w-0 flex-col overflow-visible drop-shadow-sm">
                {prefixName && (
                  <span className="font-logoSerif text-xl font-semibold uppercase leading-none tracking-[0.22em] sm:text-2xl md:text-4xl">
                    {prefixName}
                  </span>
                )}
                <span className="overflow-visible font-logo text-5xl font-normal leading-[1.05] tracking-normal sm:text-6xl md:text-8xl">
                  {scriptName}
                </span>
              </h1>
            </div>
          )}
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
