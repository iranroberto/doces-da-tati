import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, ClipboardList, DollarSign, Image, LogOut, Package, Pencil, Plus, Save, Store, Tags, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Category, Product } from "@/types/store";
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

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const AdminDashboard = () => {
  const { config, setConfig, categories, setCategories, deleteCategory, products, setProducts, deleteProduct, logout, isAdmin, isLoading } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"dashboard" | "store" | "categories" | "products" | "orders" | "clients">("dashboard");

  const [storeName, setStoreName] = useState(config.name);
  const [whatsapp, setWhatsapp] = useState(config.whatsapp);
  const [pixKey, setPixKey] = useState(config.pixKey);
  const [pixReceiverName, setPixReceiverName] = useState(config.pixReceiverName);
  const [pixCity, setPixCity] = useState(config.pixCity);
  const [adminPw, setAdminPw] = useState(config.adminPassword);
  const [saveMessage, setSaveMessage] = useState("");
  const [storeFormDirty, setStoreFormDirty] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pImage, setPImage] = useState("");
  const [pCategoryId, setPCategoryId] = useState("");
  const [pPromo, setPPromo] = useState(false);
  const [pStock, setPStock] = useState("20");
  const [categoryName, setCategoryName] = useState("");
  const [categoryActive, setCategoryActive] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (storeFormDirty) return;

    setStoreName(config.name);
    setWhatsapp(config.whatsapp);
    setPixKey(config.pixKey);
    setPixReceiverName(config.pixReceiverName);
    setPixCity(config.pixCity);
    setAdminPw(config.adminPassword);
  }, [config, storeFormDirty]);

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
      setStoreFormDirty(false);
      setSaveMessage("Configuracoes salvas com sucesso!");
      toast.success("Configuracoes salvas!");
      window.setTimeout(() => setSaveMessage(""), 3500);
    } catch (error) {
      console.error("Erro ao salvar configuracoes da loja:", error);
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
    setPCategoryId(categories.find(category => category.isActive)?.id || "");
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
    setPCategoryId(p.categoryId);
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
      categoryId: pCategoryId,
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

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryActive(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryActive(category.isActive);
  };

  const saveCategory = async () => {
    const name = categoryName.trim();
    const id = editingCategory?.id || slugify(name);

    if (!name || !id) {
      toast.error("Informe o nome da categoria");
      return;
    }

    if (!editingCategory && categories.some(category => category.id === id)) {
      toast.error("Ja existe uma categoria com esse nome");
      return;
    }

    const categoryData: Category = { id, name, isActive: categoryActive };

    try {
      if (editingCategory) {
        await setCategories(categories.map(category => category.id === editingCategory.id ? categoryData : category));
        toast.success("Categoria atualizada!");
      } else {
        await setCategories([...categories, categoryData]);
        toast.success("Categoria adicionada!");
      }
      resetCategoryForm();
    } catch {
      toast.error("Nao foi possivel salvar a categoria no banco online");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      if (editingCategory?.id === id) resetCategoryForm();
      toast.success("Categoria excluida!");
    } catch {
      toast.error("Nao foi possivel excluir a categoria no banco online");
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

  const dashboardCards = [
    { label: "Pedidos hoje", value: "0", icon: ClipboardList },
    { label: "Faturamento", value: formatPrice(0), icon: DollarSign },
    { label: "Clientes", value: "0", icon: Users },
  ];

  const navItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
    { id: "products" as const, label: "Produtos", icon: Package },
    { id: "orders" as const, label: "Pedidos", icon: ClipboardList },
    { id: "clients" as const, label: "Clientes", icon: Users },
    { id: "store" as const, label: "Loja", icon: Store },
    { id: "categories" as const, label: "Categorias", icon: Tags },
  ];

  return (
    <div className="min-h-screen bg-[#220b00] text-[#f0d8c0]">
      <header className="bg-[#f0d8c0] text-[#481800] shadow-[0_14px_40px_rgba(72,24,0,0.18)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 md:flex-row md:items-start md:justify-between">
          <button className="w-fit font-display text-2xl font-bold" onClick={() => navigate("/")}>
            Doces <span className="text-[#a76b18]">Admin</span>
          </button>

          <nav className="grid w-full gap-2 sm:grid-cols-2 md:max-w-xl md:grid-cols-3">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = tab === item.id;

              return (
                <button
                  key={item.id}
                  className={isActive
                    ? "flex items-center gap-3 bg-[#d8c0a8]/75 px-5 py-3 text-sm font-bold text-[#481800]"
                    : "flex items-center gap-3 px-5 py-3 text-sm font-semibold text-[#603000] transition hover:bg-[#d8c0a8]/45"}
                  onClick={() => setTab(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <Button variant="ghost" size="sm" className="gap-2 text-lg font-bold text-[#603000] hover:bg-[#d8c0a8]/60 hover:text-[#481800]" onClick={handleLogout}>
            <LogOut className="h-5 w-5" /> Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {isLoading && (
          <div className="mb-4 border border-[#603000] bg-[#481800] px-3 py-2 text-sm font-semibold text-[#f0d8c0]">
            Carregando dados online...
          </div>
        )}

        {tab === "dashboard" && (
          <div className="space-y-10">
            <h1 className="font-display text-4xl text-[#f0d8c0]">Dashboard</h1>

            <div className="grid gap-6 md:grid-cols-3">
              {dashboardCards.map(card => {
                const Icon = card.icon;

                return (
                  <div key={card.label} className="rounded-[18px] border border-[#603000] bg-[#481800] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-semibold uppercase text-[#d8c0a8]">{card.label}</p>
                      <Icon className="h-9 w-9 text-[#d8c090]" />
                    </div>
                    <p className="mt-6 font-display text-4xl text-[#f0d8a8]">{card.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-[18px] border border-[#603000] bg-[#481800]">
              <div className="grid grid-cols-4 gap-4 border-b border-[#603000] px-5 py-4 text-sm font-bold uppercase text-[#f0d8a8]">
                <span>Pedido</span>
                <span>Cliente</span>
                <span>Total</span>
                <span>Status</span>
              </div>
              <div className="px-5 py-10 text-center text-sm text-[#d8c0a8]">
                Nenhum pedido ainda
              </div>
            </div>
          </div>
        )}

        {tab === "store" && (
          <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
            <Card className="rounded-lg">
              <CardHeader><CardTitle>Configuracoes da Loja</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome da Loja</Label>
                  <Input value={storeName} onChange={e => { setStoreFormDirty(true); setStoreName(e.target.value); }} />
                </div>
                <div>
                  <Label>Numero do WhatsApp (com DDD)</Label>
                  <Input placeholder="5511999999999" value={whatsapp} onChange={e => { setStoreFormDirty(true); setWhatsapp(e.target.value); }} />
                </div>
                <div>
                  <Label>Chave Pix</Label>
                  <Input placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatoria" value={pixKey} onChange={e => { setStoreFormDirty(true); setPixKey(e.target.value); }} />
                </div>
                <div>
                  <Label>Nome de quem recebe o Pix</Label>
                  <Input placeholder="DOCES DA TATI" value={pixReceiverName} onChange={e => { setStoreFormDirty(true); setPixReceiverName(e.target.value); }} />
                </div>
                <div>
                  <Label>Cidade do Pix</Label>
                  <Input placeholder="RIO DE JANEIRO" value={pixCity} onChange={e => { setStoreFormDirty(true); setPixCity(e.target.value); }} />
                </div>
                <div>
                  <Label>Senha do Admin</Label>
                  <Input type="password" value={adminPw} onChange={e => { setStoreFormDirty(true); setAdminPw(e.target.value); }} />
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

        {tab === "categories" && (
          <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card className="rounded-lg">
              <CardHeader><CardTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome da Categoria</Label>
                  <Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Ex.: Bolos" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={categoryActive} onCheckedChange={setCategoryActive} />
                  <Label>Categoria ativa</Label>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={saveCategory}><Save className="h-4 w-4" /> Salvar</Button>
                  {editingCategory && <Button variant="outline" onClick={resetCategoryForm}>Cancelar</Button>}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {categories.length === 0 ? (
                <Card className="rounded-lg">
                  <CardContent className="py-10 text-center text-muted-foreground">Nenhuma categoria cadastrada.</CardContent>
                </Card>
              ) : categories.map(category => {
                const productCount = products.filter(product => product.categoryId === category.id).length;

                return (
                  <Card key={category.id} className="rounded-lg">
                    <CardContent className="flex items-center gap-4 p-4">
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Tags className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold">{category.name}</p>
                          <span className={category.isActive ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700" : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"}>
                            {category.isActive ? "Ativa" : "Oculta"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{productCount} produto(s)</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" onClick={() => openEditCategory(category)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="text-destructive" onClick={() => handleDeleteCategory(category.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
                      <p className="text-xs text-muted-foreground">
                        {categories.find(category => category.id === p.categoryId)?.name || "Sem categoria"} - Estoque: {p.stock}
                      </p>
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

        {tab === "orders" && (
          <div className="space-y-6">
            <h1 className="font-display text-4xl text-[#f0d8c0]">Pedidos</h1>
            <div className="overflow-hidden rounded-[18px] border border-[#603000] bg-[#481800]">
              <div className="grid grid-cols-4 gap-4 border-b border-[#603000] px-5 py-4 text-sm font-bold uppercase text-[#f0d8a8]">
                <span>Pedido</span>
                <span>Cliente</span>
                <span>Total</span>
                <span>Status</span>
              </div>
              <div className="px-5 py-10 text-center text-sm text-[#d8c0a8]">
                Nenhum pedido ainda
              </div>
            </div>
          </div>
        )}

        {tab === "clients" && (
          <div className="space-y-6">
            <h1 className="font-display text-4xl text-[#f0d8c0]">Clientes</h1>
            <div className="overflow-hidden rounded-[18px] border border-[#603000] bg-[#481800]">
              <div className="grid grid-cols-3 gap-4 border-b border-[#603000] px-5 py-4 text-sm font-bold uppercase text-[#f0d8a8]">
                <span>Nome</span>
                <span>WhatsApp</span>
                <span>Pedidos</span>
              </div>
              <div className="px-5 py-10 text-center text-sm text-[#d8c0a8]">
                Nenhum cliente ainda
              </div>
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
            <div>
              <Label>Categoria</Label>
              <select
                value={pCategoryId}
                onChange={e => setPCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Sem categoria</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
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
