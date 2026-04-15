import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE;

export default function Signup() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
    });
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage("");
        setIsSubmitting(true);

        try {
            const res = await axios.post(`${VITE_BACKEND_BASE}/api/signup`, formData);
            if (res.data.success) {
                navigate("/auth/login", {
                    replace: true,
                    state: { message: "Account created successfully. Please sign in." },
                });
            }
        } catch (error) {
            console.error("Signup failed:", error);
            setMessage(
                error?.response?.data?.message ||
                error?.response?.data?.error?.message ||
                "Signup failed"
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleNavigate = () => {
        navigate("/auth/login");
    };

    return (
        <main className="filmly-login-page">
            <div className="filmly-login-glow filmly-login-glow-left" />
            <div className="filmly-login-glow filmly-login-glow-right" />

            <section className="filmly-login-shell">
                <aside className="filmly-brand-panel">
                    <div className="filmly-badge">FILMLY</div>
                    <h1>Join the movie social space built for real fans.</h1>
                    <p>
                        Create your Filmly profile to review movies, follow film communities, and keep up with what the world is watching.
                    </p>

                    <ul className="filmly-feature-list">
                        <li>Create a profile and build your identity.</li>
                        <li>Discover trends across genres and languages.</li>
                        <li>Start engaging with cinema-first conversations.</li>
                    </ul>
                </aside>

                <section className="filmly-form-panel">
                    <header className="filmly-form-header">
                        <h2>Create your account</h2>
                        <p>Sign up to start your Filmly journey.</p>
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

                        <label htmlFor="email" className="filmly-label">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="filmly-input"
                            placeholder="you@example.com"
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
                            placeholder="Create a password"
                        />

                        <button type="submit" className="filmly-btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Creating account..." : "Create account"}
                        </button>
                    </form>

                    <div className="filmly-divider" />

                    <button type="button" className="filmly-btn-secondary" onClick={handleNavigate}>
                        Already have an account? Sign in
                    </button>
                </section>
            </section>
        </main>
    );
}