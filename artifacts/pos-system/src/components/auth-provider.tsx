import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@workspace/api-client-react";
import { PageLoader } from "@/components/PageLoader";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user?: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(getStoredToken);
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    },
  });

  useEffect(() => {
    const handlePermissionsRefresh = () => {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    };
    window.addEventListener("pos-permissions-updated", handlePermissionsRefresh);
    return () => window.removeEventListener("pos-permissions-updated", handlePermissionsRefresh);
  }, [queryClient]);

  useEffect(() => {
    // If the server returns an explicit authentication error (401/403)
    if (error && token) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pos_token");
        localStorage.removeItem("pos_token");
      }
      setToken(null);
      queryClient.setQueryData(getGetMeQueryKey(), null);
      if (location !== "/login") {
        setLocation("/login");
      }
    }
  }, [error, token, location, setLocation, queryClient]);

  const login = (newToken: string, newUser?: User) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pos_token", newToken);
      localStorage.setItem("pos_token", newToken);
    }
    setToken(newToken);
    if (newUser) {
      queryClient.setQueryData(getGetMeQueryKey(), newUser);
    }
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pos_token");
      localStorage.removeItem("pos_token");
    }
    setToken(null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading: !!token && isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function ProtectedRoute({ children, requireAdmin = false, requireDeveloper = false }: { children: React.ReactNode; requireAdmin?: boolean; requireDeveloper?: boolean }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const role = (user?.role as string) || "";
  const isDev = role === "developer" || user?.username?.toLowerCase() === "developer";
  
  // Strict admin/manager check for system configuration and user management
  const isStrictAdmin =
    role === "admin" ||
    role === "manager" ||
    role === "مدير" ||
    role === "general_manager" ||
    role === "مدير عام" ||
    role === "مدير عام النظام" ||
    role === "مدير عام الشركة" ||
    Boolean((user as any)?.is_system_admin) ||
    user?.username === "admin" ||
    isDev;
  
  // General staff check (any authenticated staff member)
  const isStaff = Boolean(user) || isStrictAdmin;

  const storedToken = getStoredToken();

  useEffect(() => {
    if (!storedToken && !isLoading) {
      setLocation("/login");
      return;
    }
    
    if (!isLoading && user) {
      const path = location || (typeof window !== "undefined" ? window.location.pathname : "");
      const isPosOnlyUser =
        !isStrictAdmin &&
        ((user as any).perm_pos_only !== undefined
          ? Boolean((user as any).perm_pos_only)
          : role === "cashier" || role === "كاشير" || (user as any)?.default_screen === "pos");
      const isPosAllowedPath =
        path === "/pos" ||
        path === "/shifts" ||
        path === "/tables" ||
        path === "/";

      if (requireDeveloper || path.startsWith("/licenses")) {
        if (!isDev) {
          setLocation(isPosOnlyUser ? "/pos" : "/dashboard");
          return;
        }
      }

      if (isPosOnlyUser && !isPosAllowedPath) {
        setLocation("/pos");
        return;
      }

      if (requireAdmin && !isStaff) {
        setLocation(isPosOnlyUser ? "/pos" : "/dashboard");
      }
    }
  }, [user, isLoading, storedToken, location, requireAdmin, requireDeveloper, isDev, isStrictAdmin, isStaff, setLocation]);

  if (!storedToken) {
    return null;
  }

  if (isLoading || !user) {
    return <PageLoader message="جاري التحقق من الصلاحيات وتجهيز بيئة العمل..." />;
  }

  const path = location || (typeof window !== "undefined" ? window.location.pathname : "");

  const hasAccess = 
    (!(requireDeveloper || path.startsWith("/licenses")) || isDev) && 
    (!requireAdmin || isStaff);

  if (!hasAccess) {
    return <PageLoader message="جاري التحويل للصفحة المصرحة." />;
  }

  return <>{children}</>;
}
