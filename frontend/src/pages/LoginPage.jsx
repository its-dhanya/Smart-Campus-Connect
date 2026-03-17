import { useState } from "react";
import { api } from "../lib/api";

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState("admin@smartcampus.com");
  const [password, setPassword] = useState("12345678");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.post("/auth/login", { email, password });
      if (data.token) onLogin(data);
      else setError(data.message || "Login failed");
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand-icon">🎓</div>
          <div>
            <div className="login-wordmark">Smart Campus</div>
            <div className="login-tagline">Campus connect system</div>
          </div>
        </div>

        <div className="login-heading">Welcome back</div>
        <div className="login-sub">Sign in to your dashboard to continue</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@campus.edu"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px 18px", fontSize: 15, marginTop: 4 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Sign in →"}
          </button>
        </form>

        <div className="divider" />
        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--ink-3)" }}>
          admin@smartcampus.com · 12345678
        </p>
      </div>
    </div>
  );
}