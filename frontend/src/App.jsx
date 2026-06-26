import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login/LoginPage.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import { getMe } from "./api.js";

const TOKEN_KEY = "auth_token";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("light");

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      });
  }, [token]);

  function handleLoginSuccess(t) {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  if (!token || !user) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  const commonProps = { user, onLogout: handleLogout, theme, toggleTheme };

  return (
    <Routes>
      <Route path="/" element={<DashboardPage {...commonProps} />} />
      <Route path="/admin" element={<AdminPage {...commonProps} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
