import { useState, useEffect } from "react";
import LoginPage from "./pages/login/LoginPage.jsx";
import ChatPage from "./pages/dashboard/DashboardPage.jsx";
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

  if (token && user) {
    return (
      <ChatPage
        user={user}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  return (
    <LoginPage
      onLoginSuccess={handleLoginSuccess}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}
