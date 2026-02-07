import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

interface User {
  id: number;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { data: userData, isLoading: isUserLoading } = trpc.customAuth.me.useQuery(
    undefined,
    {
      enabled: !!token,
      retry: false,
    }
  );
  
  const logoutMutation = trpc.customAuth.logout.useMutation();
  
  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);
  
  // Update user when userData changes
  useEffect(() => {
    if (userData) {
      setUser(userData);
    }
  }, [userData]);
  
  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('auth_token', newToken);
  };
  
  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('auth_token');
    }
  };
  
  const value: AuthContextType = {
    user,
    isLoading: isLoading || isUserLoading,
    isAuthenticated: !!user,
    login,
    logout,
    token,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
