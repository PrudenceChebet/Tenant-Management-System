import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

// Keeps track of who is logged in and shares it with every screen.

const USER_KEY = "tms.user";
const AuthContext = createContext(null);

const readCachedUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};
const cacheUser = (user) => {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
};

export function AuthProvider({ children }) {
  // Start with the saved user so the app opens instantly (and works offline).
  const [user, setUser] = useState(() => (getToken() ? readCachedUser() : null));

  const saveUser = useCallback((u) => {
    cacheUser(u);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    saveUser(null);
    // Remove cached API answers so the next person on this phone can't see them.
    if ("caches" in window) {
      await caches.delete("api-cache").catch(() => {});
      await caches.delete("photo-cache").catch(() => {});
    }
  }, [saveUser]);

  // Refresh the profile (e.g. the landlord just linked this tenant to a unit).
  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      saveUser(await api("/auth/me"));
    } catch (err) {
      if (!err.network && err.status === 401) logout();
    }
  }, [saveUser, logout]);

  useEffect(() => {
    refresh();
    const onLoggedOut = () => logout();
    window.addEventListener("tms:logged-out", onLoggedOut);
    return () => window.removeEventListener("tms:logged-out", onLoggedOut);
  }, [refresh, logout]);

  const login = async (email, password) => {
    const { token } = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(token);
    saveUser(await api("/auth/me"));
  };

  const register = async (form) => {
    const { token } = await api("/auth/register", { method: "POST", body: form });
    setToken(token);
    saveUser(await api("/auth/me"));
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
