import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, api, clearTokens, getAccessToken, setTokens } from './api';

export type AppUser = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  wallet_balance?: number;
  virtual_account_number?: string | null;
  virtual_account_bank?: string | null;
  [key: string]: unknown;
};

type AuthResponse = {
  status: boolean;
  data: {
    access_token: string;
    refresh_token: string;
    user: AppUser;
  };
};

type AuthContextValue = {
  user: AppUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string, loginPin?: string) => Promise<void>;
  register: (input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    referral_code?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshUser() {
    try {
      const res = await api.get<{ status: boolean; data: AppUser }>('/auth/me');
      setUser(res.data);
    } catch {
      clearTokens();
      setUser(null);
    }
  }

  useEffect(() => {
    (async () => {
      if (getAccessToken()) {
        await refreshUser();
      }
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(identifier: string, password: string, loginPin?: string) {
    try {
      const res = await api.post<AuthResponse>(
        '/auth/login',
        { identifier, password, login_pin: loginPin },
        false
      );
      setTokens(res.data.access_token, res.data.refresh_token);
      setUser(res.data.user);
    } catch (err) {
      // LOGIN_PIN_REQUIRED means the password was correct but this account
      // has a 6-digit login PIN set - the caller (LoginPage) shows a PIN
      // field and calls login() again with it included.
      throw err instanceof ApiError ? err : new ApiError('Login failed', 500);
    }
  }

  async function register(input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    referral_code?: string;
  }) {
    const res = await api.post<AuthResponse>('/auth/register', input, false);
    setTokens(res.data.access_token, res.data.refresh_token);
    setUser(res.data.user);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
