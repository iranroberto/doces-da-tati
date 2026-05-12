import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { StoreProvider } from "@/context/StoreContext";
import Index from "./pages/Index";
import Checkout from "./pages/Checkout";
import MyOrders from "./pages/MyOrders";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <StoreProvider>
          <CustomerAuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/meus-pedidos" element={<MyOrders />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CustomerAuthProvider>
        </StoreProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
