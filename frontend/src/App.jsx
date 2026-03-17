import { useState, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/Admindashboard";
import StudentDashboard from "./pages/Studentdashboard";
import Layout from "./components/Layout";
import { AuthContext } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { useToast } from "./context/ToastContext";
import { requestFCMToken, onForegroundMessage } from "./lib/firebase";
import { api } from "./lib/api";

function AppInner() {
  const toast = useToast();

  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("scc_auth");
    return saved ? JSON.parse(saved) : null;
  });

  // Request FCM token once after login and save it to backend
  useEffect(() => {
    if (!auth) return;

    const setupFCM = async () => {
      try {
        const fcmToken = await requestFCMToken();
        if (!fcmToken) return;

        // Save token to backend so the server can send push notifications
        await api.saveFCMToken(auth.user.id, fcmToken, auth.token);
        console.log("FCM token saved to backend");
      } catch (err) {
        console.error("FCM setup failed:", err);
      }
    };

    setupFCM();
  }, [auth?.user?.id]);

  // Listen for foreground notifications (when app tab is open)
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || "Smart Campus";
      const body = payload.notification?.body || "New notification";
      // Show as a toast inside the app
      toast(`${title}: ${body}`, "info");
    });

    return () => unsubscribe();
  }, [auth]);

  const login = (data) => {
    const payload = { token: data.token, user: data.student };
    localStorage.setItem("scc_auth", JSON.stringify(payload));
    setAuth(payload);
  };

  const logout = () => {
    localStorage.removeItem("scc_auth");
    setAuth(null);
  };

  if (!auth) return <LoginPage onLogin={login} />;

  const isAdmin = ["SUPER_ADMIN", "TEACHER", "BUS_ADMIN", "LAUNDRY_ADMIN", "MESS_ADMIN"].includes(
    auth.user.role
  );

  return (
    <AuthContext.Provider value={{ ...auth, logout }}>
      <Layout>
        {isAdmin ? <AdminDashboard /> : <StudentDashboard />}
      </Layout>
    </AuthContext.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}