import { Link } from "react-router-dom";
import { CakeSlice, LogOut, ReceiptText, ShoppingCart, UserRound } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";

interface StoreHeaderProps {
  onCartOpen: () => void;
  onCustomerAuthOpen: () => void;
}

const StoreHeader = ({ onCartOpen, onCustomerAuthOpen }: StoreHeaderProps) => {
  const { config, cartCount } = useStore();
  const { customer, logoutCustomer } = useCustomerAuth();
  const match = config.name.match(/^(.*?)(vizio)$/i);
  const prefixName = match?.[1]?.trim();
  const scriptName = match?.[2] || config.name;
  const hasBanner = Boolean(config.bannerImage);
  const customerName = customer?.nome.trim() || "Cliente";

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
          {customer ? (
            <>
              <div className="hidden max-w-[260px] items-center gap-2 rounded-full bg-primary-foreground/12 px-3 py-2 text-sm font-bold sm:flex">
                <UserRound className="h-4 w-4" />
                <span className="min-w-0 truncate">{customerName}</span>
                <button className="text-primary-foreground/80 hover:text-primary-foreground" onClick={logoutCustomer} aria-label="Sair da conta">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
              <Button variant="ghost" className="gap-2 px-2 text-primary-foreground hover:bg-primary-foreground/20" asChild>
                <Link to="/meus-pedidos">
                  <ReceiptText className="h-5 w-5" />
                  <span className="hidden md:inline">Meus pedidos</span>
                </Link>
              </Button>
              <Button variant="ghost" className="max-w-36 gap-2 px-2 text-primary-foreground hover:bg-primary-foreground/20 sm:hidden" onClick={logoutCustomer} aria-label="Sair da conta">
                <UserRound className="h-5 w-5" />
                <span className="min-w-0 truncate text-xs font-bold">{customerName.split(" ")[0] || customerName}</span>
              </Button>
            </>
          ) : (
            <Button variant="ghost" className="gap-2 text-primary-foreground hover:bg-primary-foreground/20" onClick={onCustomerAuthOpen}>
              <UserRound className="h-5 w-5" />
              <span className="hidden sm:inline">Entrar</span>
            </Button>
          )}
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
