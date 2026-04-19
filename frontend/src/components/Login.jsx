import { useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/login.css";
import { clearAuthCache, setAuthToken } from "../utilities/auth";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [formData, setFormData] = useState({
        username: "",
        password: "",
    });
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData((prev) => {
            return { ...prev, [e.target.name]: e.target.value };
        });
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage("");
        setIsSubmitting(true);
        try {
            const res = await axios.post(`${VITE_BACKEND_BASE}/api/login`, formData);
            if (res.data.success) {
                clearAuthCache();
                const token = res?.data?.data?.token;
                if (token) setAuthToken(token);
                const fromPath = location.state?.from?.pathname;
                navigate("/dashboard", { replace: true });
            }
        } catch (error) {
            console.error("Login failed:", error);
            setMessage(
                error?.response?.data?.message ||
                error?.response?.data?.error?.message ||
                "Login failed"
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleNavigate = () => {
        navigate("/auth/signup");
    };

    return (
        <main className="filmly-login-page">
            <div className="filmly-login-glow filmly-login-glow-left" />
            <div className="filmly-login-glow filmly-login-glow-right" />

            <section className="filmly-login-shell">
                <aside className="filmly-brand-panel">
                    <div className="filmly-badge">FILMLY</div>
                    <h1>Enter the conversation behind every frame.</h1>
                    <p>
                        A social hub for movie lovers to discover, debate, review, and share the films shaping culture.
                    </p>

                    <ul className="filmly-feature-list">
                        <li>Build your watchlist with cinematic picks.</li>
                        <li>Follow creators, critics, and fan communities.</li>
                        <li>Join live discussions after every release.</li>
                    </ul>
                </aside>

                <section className="filmly-form-panel">
                    <header className="filmly-form-header">
                        <h2>Welcome back</h2>
                        <p>Sign in to continue your Filmly feed.</p>
                    </header>

                    {message && (
                        <div className="filmly-alert-box" role="alert">
                            <span>{message}</span>
                            <button
                                type="button"
                                className="filmly-alert-close"
                                onClick={() => setMessage("")}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="filmly-login-form">
                        <label htmlFor="username" className="filmly-label">Username</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            className="filmly-input"
                            placeholder="your.username"
                        />

                        <label htmlFor="password" className="filmly-label">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            className="filmly-input"
                            placeholder="Enter your password"
                        />

                        <button type="submit" className="filmly-btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Signing in..." : "Sign in"}
                        </button>
                    </form>

                    <div className="filmly-divider" />

                    <button type="button" className="filmly-btn-secondary" onClick={handleNavigate}>
                        Create new account
                    </button>
                </section>
            </section>
        </main>
    );
}