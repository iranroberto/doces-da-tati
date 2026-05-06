import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const AdminLogin = () => {
  const { login } = useStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      navigate("/admin/dashboard");
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/20 px-4">
      <Card className="w-full max-w-sm rounded-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-xl">Painel Admin</CardTitle>
          <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Sparkles className="h-3 w-3" /> doce da tati
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-sm text-destructive">Senha incorreta</p>}
            <Button type="submit" className="w-full font-semibold">Entrar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
