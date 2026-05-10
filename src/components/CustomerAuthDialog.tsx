import { useEffect, useState } from "react";
import { LogIn, MapPin, Phone, UserRound, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomerAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CustomerAuthDialog = ({ open, onOpenChange }: CustomerAuthDialogProps) => {
  const { loginByPhone, createCustomer } = useCustomerAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [companyUnit, setCompanyUnit] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      return;
    }

    setMode("login");
  }, [open]);

  const handlePhoneChange = (value: string) => setPhone(formatPhone(value));

  const submitLogin = async () => {
    setIsSubmitting(true);
    try {
      const success = await loginByPhone(phone);
      if (success) onOpenChange(false);
    } catch (error) {
      console.error("Erro ao entrar como cliente:", error);
      toast.error("Nao foi possivel entrar agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRegister = async () => {
    setIsSubmitting(true);
    try {
      const success = await createCustomer({
        nome: name,
        telefone: phone,
        empresa_unidade: companyUnit,
      });

      if (success) onOpenChange(false);
    } catch (error) {
      console.error("Erro ao cadastrar cliente:", error);
      toast.error("Nao foi possivel criar a conta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-lg p-0">
        <div className="border-b border-border bg-primary px-5 py-5 text-primary-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {mode === "login" ? <LogIn className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}
              {mode === "login" ? "Entrar rapido" : "Criar conta"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 rounded-lg border border-border bg-muted p-1">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("login")}
            >
              Entrar
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("register")}
            >
              Criar conta
            </Button>
          </div>

          {mode === "register" && (
            <>
              <div>
                <Label>Nome completo</Label>
                <div className="relative mt-1">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={name} onChange={event => setName(event.target.value)} className="pl-9" placeholder="Seu nome" />
                </div>
              </div>

              <div>
                <Label>Empresa/Unidade</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={companyUnit} onChange={event => setCompanyUnit(event.target.value)} className="pl-9" placeholder="Loja, quiosque ou setor" />
                </div>
              </div>
            </>
          )}

          <div>
            <Label>WhatsApp</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={phone}
                onChange={event => handlePhoneChange(event.target.value)}
                inputMode="tel"
                className="pl-9"
                placeholder="(21) 99999-9999"
              />
            </div>
          </div>

          <Button
            className="h-11 w-full gap-2 text-base font-bold"
            disabled={isSubmitting}
            onClick={mode === "login" ? submitLogin : submitRegister}
          >
            {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserRoundPlus className="h-4 w-4" />}
            {isSubmitting ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>

          {mode === "login" ? (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("register")}>
              Criar conta
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>
              Ja tenho cadastro
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerAuthDialog;
