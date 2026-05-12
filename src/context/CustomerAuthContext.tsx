import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import type { Customer } from "@/types/store";

const CUSTOMER_SESSION_KEY = "customer_session";
const LOCAL_CUSTOMERS_KEY = "store_customers";

interface CustomerSession {
  token: string;
  customerId: string;
  telefone: string;
  createdAt: string;
}

interface CreateCustomerInput {
  nome: string;
  telefone: string;
  empresa_unidade: string;
}

interface CustomerAuthContextType {
  customer: Customer | null;
  isCustomerLoading: boolean;
  isLoggedIn: boolean;
  loginByPhone: (phone: string) => Promise<boolean>;
  createCustomer: (input: CreateCustomerInput) => Promise<boolean>;
  logoutCustomer: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

const loadLocalCustomers = (): Customer[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalCustomers = (customers: Customer[]) => {
  localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(customers));
};

const customerFromRow = (row: Record<string, unknown>): Customer => ({
  id: String(row.id),
  nome: String(row.nome ?? ""),
  telefone: String(row.telefone ?? ""),
  empresa_unidade: String(row.empresa_unidade ?? ""),
  status: String(row.status ?? "ativo") === "bloqueado" ? "bloqueado" : "ativo",
  criado_em: String(row.criado_em ?? new Date().toISOString()),
});

const makeToken = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const saveSession = (customer: Customer) => {
  const session: CustomerSession = {
    token: makeToken(),
    customerId: customer.id,
    telefone: customer.telefone,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
};

const loadSession = (): CustomerSession | null => {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearSession = () => localStorage.removeItem(CUSTOMER_SESSION_KEY);

const findLocalCustomerByPhone = (telefone: string) =>
  loadLocalCustomers().find(customer => customer.telefone === telefone) ?? null;

const findLocalCustomerBySession = (session: CustomerSession) =>
  loadLocalCustomers().find(customer => customer.id === session.customerId && customer.telefone === session.telefone)
  ?? findLocalCustomerByPhone(session.telefone);

const isMissingCustomersTableError = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "PGRST205" || code === "42P01";
};

const getCustomerSaveErrorMessage = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";

  if (code === "23505") return "Telefone ja cadastrado.";
  if (code === "23502") return "Preencha nome, local e WhatsApp.";
  if (code === "42501") return "Sem permissao para cadastrar cliente no banco.";
  if (code === "42P01") return "Tabela clientes nao existe no Supabase.";
  if (code === "42703") return "Coluna obrigatoria nao existe na tabela clientes.";
  if (message.toLowerCase().includes("failed to fetch")) return "Nao foi possivel conectar ao Supabase.";

  return "Nao foi possivel criar a conta.";
};

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isCustomerLoading, setIsCustomerLoading] = useState(isSupabaseConfigured);

  const fetchCustomerByPhone = useCallback(async (telefone: string) => {
    if (!supabase) return findLocalCustomerByPhone(telefone);

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("telefone", telefone)
      .maybeSingle();

    if (isMissingCustomersTableError(error)) return findLocalCustomerByPhone(telefone);
    if (error) throw error;
    return data ? customerFromRow(data) : null;
  }, []);

  const fetchCustomerBySession = useCallback(async (session: CustomerSession) => {
    if (!supabase) return findLocalCustomerBySession(session);

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("telefone", session.telefone)
      .maybeSingle();

    if (isMissingCustomersTableError(error)) return findLocalCustomerBySession(session);
    if (error) throw error;
    return data ? customerFromRow(data) : null;
  }, []);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setIsCustomerLoading(false);
      return;
    }

    let isMounted = true;
    fetchCustomerBySession(session)
      .then(savedCustomer => {
        if (!isMounted) return;

        if (savedCustomer) {
          setCustomer(savedCustomer);
        } else {
          clearSession();
        }
      })
      .catch(error => {
        console.error("Erro ao recuperar sessao do cliente:", error);
        clearSession();
      })
      .finally(() => {
        if (isMounted) setIsCustomerLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fetchCustomerBySession]);

  const loginByPhone = useCallback(async (phone: string) => {
    const telefone = normalizePhone(phone);

    if (!isValidPhone(telefone)) {
      toast.error("Informe um telefone valido.");
      return false;
    }

    const savedCustomer = await fetchCustomerByPhone(telefone);
    if (!savedCustomer) {
      toast.error("Telefone nao cadastrado");
      return false;
    }

    setCustomer(savedCustomer);
    saveSession(savedCustomer);
    toast.success(`Bem-vindo, ${savedCustomer.nome.split(" ")[0] || savedCustomer.nome}!`);
    return true;
  }, [fetchCustomerByPhone]);

  const createCustomer = useCallback(async (input: CreateCustomerInput) => {
    const nome = input.nome.trim();
    const telefone = normalizePhone(input.telefone);
    const empresaUnidade = input.empresa_unidade.trim();

    if (!nome || !empresaUnidade || !isValidPhone(telefone)) {
      toast.error("Preencha nome, local e WhatsApp valido.");
      return false;
    }

    const savedCustomer = await fetchCustomerByPhone(telefone);
    if (savedCustomer) {
      toast.error("Telefone ja cadastrado.");
      return false;
    }

    const nextCustomer: Customer = {
      id: makeToken(),
      nome,
      telefone,
      empresa_unidade: empresaUnidade,
      status: "ativo",
      criado_em: new Date().toISOString(),
    };

    const saveCustomerLocally = () => {
      const customers = loadLocalCustomers();
      saveLocalCustomers([...customers, nextCustomer]);
      setCustomer(nextCustomer);
      saveSession(nextCustomer);
    };

    if (supabase) {
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          nome,
          telefone,
          empresa_unidade: empresaUnidade,
          status: "ativo",
        })
        .select("*")
        .single();

      if (error) {
        if (isMissingCustomersTableError(error)) {
          console.warn("Tabela clientes nao encontrada no Supabase. Salvando cliente localmente.", error);
          saveCustomerLocally();
          toast.warning("Banco sem tabela clientes. Conta criada neste aparelho.");
          return true;
        }

        console.error("Erro do Supabase ao cadastrar cliente:", error);
        toast.error(getCustomerSaveErrorMessage(error));
        return false;
      }

      const createdCustomer = customerFromRow(data);
      setCustomer(createdCustomer);
      saveSession(createdCustomer);
    } else {
      saveCustomerLocally();
    }

    toast.success("Conta criada!");
    return true;
  }, [fetchCustomerByPhone]);

  const logoutCustomer = useCallback(() => {
    clearSession();
    setCustomer(null);
    toast.success("Voce saiu da conta.");
  }, []);

  const value = useMemo<CustomerAuthContextType>(() => ({
    customer,
    isCustomerLoading,
    isLoggedIn: Boolean(customer),
    loginByPhone,
    createCustomer,
    logoutCustomer,
  }), [createCustomer, customer, isCustomerLoading, loginByPhone, logoutCustomer]);

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
};
