import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Image, LogOut, Package, Pencil, Plus, Save, Store, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Product } from "@/types/store";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const AdminDashboard = () => {
  const { config, setConfig, products, setProducts, deleteProduct, logout, isAdmin, isLoading } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"store" | "products">("store");

  const [storeName, setStoreName] = useState(config.name);
  const [whatsapp, setWhatsapp] = useState(config.whatsapp);
  const [pixKey, setPixKey] = useState(config.pixKey);
  const [pixReceiverName, setPixReceiverName] = useState(config.pixReceiverName);
  const [pixCity, setPixCity] = useState(config.pixCity);
  const [adminPw, setAdminPw] = useState(config.adminPassword);
  const [saveMessage, setSaveMessage] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pImage, setPImage] = useState("");
  const [pPromo, setPPromo] = useState(false);
  const [pStock, setPStock] = useState("20");

  useEffect(() => {
    setStoreName(config.name);
    setWhatsapp(config.whatsapp);
    setPixKey(config.pixKey);
    setPixReceiverName(config.pixReceiverName);
    setPixCity(config.pixCity);
    setAdminPw(config.adminPassword);
  }, [config]);

  if (!isAdmin) {
    navigate("/admin");
    return null;
  }

  const saveStoreSettings = async () => {
    try {
      await setConfig({
        ...config,
        name: storeName.trim(),
        whatsapp,
        pixKey: pixKey.trim(),
        pixReceiverName: pixReceiverName.trim() || "DOCES DA TATI",
        pixCity: pixCity.trim() || "RIO DE JANEIRO",
        adminPassword: adminPw || "bryan15",
      });
      setSaveMessage("Configuracoes salvas com sucesso!");
      toast.success("Configuracoes salvas!");
      window.setTimeout(() => setSaveMessage(""), 3500);
    } catch {
      toast.error("Nao foi possivel salvar no banco online");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await fileToBase64(file);
      try {
        await setConfig({ ...config, logo: b64 });
        toast.success("Logo atualizado!");
      } catch {
        toast.error("Nao foi possivel salvar a logo no banco online");
      }
    }
  };

  const removeLogo = async () => {
    try {
      await setConfig({ ...config, logo: "" });
      toast.success("Logo removida!");
    } catch {
      toast.error("Nao foi possivel remover a logo no banco online");
    }
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setPName("");
    setPPrice("");
    setPDesc("");
    setPImage("");
    setPPromo(false);
    setPStock("20");
    setDialogOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setPName(p.name);
    setPPrice(String(p.price));
    setPDesc(p.description);
    setPImage(p.image);
    setPPromo(p.isPromo);
    setPStock(String(p.stock));
    setDialogOpen(true);
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPImage(await fileToBase64(file));
  };

  const saveProduct = async () => {
    const price = Number(pPrice);

    if (!pName.trim() || !pPrice || Number.isNaN(price)) {
      toast.error("Preencha nome e preco corretamente");
      return;
    }

    const productData: Product = {
      id: editingProduct?.id || Date.now().toString(),
      name: pName.trim(),
      price,
      description: pDesc,
      image: pImage,
      isPromo: pPromo,
      stock: Math.max(0, parseInt(pStock, 10) || 0),
    };

    try {
      if (editingProduct) {
        await setProducts(products.map(p => p.id === editingProduct.id ? productData : p));
        toast.success("Produto atualizado!");
      } else {
        await setProducts([...products, productData]);
        toast.success("Produto adicionado!");
      }

      setDialogOpen(false);
    } catch {
      toast.error("Nao foi possivel salvar o produto no banco online");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success("Produto excluido!");
    } catch {
      toast.error("Nao foi possivel excluir o produto no banco online");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-lg md:text-xl">Painel Admin</h1>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-primary-foreground hover:bg-primary-foreground/20" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        {isLoading && (
          <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            Carregando dados online...
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          <Button variant={tab === "store" ? "default" : "outline"} className="gap-2" onClick={() => setTab("store")}>
            <Store className="h-4 w-4" /> Loja
          </Button>
          <Button variant={tab === "products" ? "default" : "outline"} className="gap-2" onClick={() => setTab("products")}>
            <Package className="h-4 w-4" /> Produtos ({products.length})
          </Button>
        </div>

        {tab === "store" && (
          <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
            <Card className="rounded-lg">
              <CardHeader><CardTitle>Configuracoes da Loja</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome da Loja</Label>
                  <Input value={storeName} onChange={e => setStoreName(e.target.value)} />
                </div>
                <div>
                  <Label>Numero do WhatsApp (com DDD)</Label>
                  <Input placeholder="5511999999999" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                </div>
                <div>
                  <Label>Chave Pix</Label>
                  <Input placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatoria" value={pixKey} onChange={e => setPixKey(e.target.value)} />
                </div>
                <div>
                  <Label>Nome de quem recebe o Pix</Label>
                  <Input placeholder="DOCES DA TATI" value={pixReceiverName} onChange={e => setPixReceiverName(e.target.value)} />
                </div>
                <div>
                  <Label>Cidade do Pix</Label>
                  <Input placeholder="RIO DE JANEIRO" value={pixCity} onChange={e => setPixCity(e.target.value)} />
                </div>
                <div>
                  <Label>Senha do Admin</Label>
                  <Input type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)} />
                </div>
                {saveMessage && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> {saveMessage}
                  </div>
                )}
                <Button className="w-full gap-2" onClick={saveStoreSettings}><Save className="h-4 w-4" /> Salvar</Button>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader><CardTitle>Logo da Loja</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Logo da Loja</Label>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                  {config.logo && <img src={config.logo} alt="Logo" className="mt-2 h-20 w-20 rounded-full border object-cover" />}
                  {config.logo && (
                    <Button variant="outline" className="mt-3 gap-2 text-destructive" onClick={removeLogo}>
                      <Trash2 className="h-4 w-4" /> Remover logo
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "products" && (
          <div className="space-y-4">
            <Button className="gap-2" onClick={openNewProduct}><Plus className="h-4 w-4" /> Novo Produto</Button>

            <div className="grid gap-4">
              {products.map(p => (
                <Card key={p.id} className="rounded-lg">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-primary"><Image className="h-6 w-6" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold">{p.name}</p>
                        {p.isPromo && <span className="rounded-full bg-promo px-2 py-0.5 text-xs text-promo-foreground">Oferta</span>}
                      </div>
                      <p className="text-sm font-bold text-primary">{formatPrice(p.price)}</p>
                      <p className="text-xs text-muted-foreground">Estoque: {p.stock}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" onClick={() => openEditProduct(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={pName} onChange={e => setPName(e.target.value)} /></div>
            <div><Label>Preco (R$)</Label><Input type="number" step="0.01" value={pPrice} onChange={e => setPPrice(e.target.value)} /></div>
            <div><Label>Descricao</Label><Textarea value={pDesc} onChange={e => setPDesc(e.target.value)} /></div>
            <div><Label>Estoque</Label><Input type="number" value={pStock} onChange={e => setPStock(e.target.value)} /></div>
            <div>
              <Label>Imagem</Label>
              <Input type="file" accept="image/*" onChange={handleProductImageUpload} />
              {pImage && <img src={pImage} alt="Preview" className="mt-2 h-32 w-full rounded-lg border object-cover" />}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pPromo} onCheckedChange={setPPromo} />
              <Label>Marcar como promocao</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveProduct}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
