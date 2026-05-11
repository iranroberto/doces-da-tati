import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import type { Customer } from "@/types/store";

const CUSTOMER_SESSION_KEY = "customer_session";
const LOCAL_CUSTOMERS_KEY = "store_customers";
const DEFAULT_LIMIT = 20;

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
  limite: Number(row.limite ?? DEFAULT_LIMIT),
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

const getCustomerSaveErrorMessage = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

  if (code === "23505") return "Telefone ja cadastrado.";
  if (code === "23502") return "Preencha nome, loja e WhatsApp.";
  if (code === "42501") return "Sem permissao para cadastrar cliente no banco.";

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
      toast.error("Preencha nome, loja e WhatsApp valido.");
      return false;
    }

    if (!supabase && findLocalCustomerByPhone(telefone)) {
      toast.error("Telefone ja cadastrado.");
      return false;
    }

    const nextCustomer: Customer = {
      id: makeToken(),
      nome,
      telefone,
      empresa_unidade: empresaUnidade,
      status: "ativo",
      limite: DEFAULT_LIMIT,
      criado_em: new Date().toISOString(),
    };

    if (supabase) {
      const { error } = await supabase
        .from("clientes")
        .insert({
          nome: nextCustomer.nome,
          telefone: nextCustomer.telefone,
          empresa_unidade: nextCustomer.empresa_unidade,
          status: nextCustomer.status,
          limite: nextCustomer.limite,
          criado_em: nextCustomer.criado_em,
        });

      if (error) {
        console.error("Erro do Supabase ao cadastrar cliente:", error);
        toast.error(getCustomerSaveErrorMessage(error));
        return false;
      }

      setCustomer(nextCustomer);
      saveSession(nextCustomer);
    } else {
      const customers = loadLocalCustomers();
      saveLocalCustomers([...customers, nextCustomer]);
      setCustomer(nextCustomer);
      saveSession(nextCustomer);
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
