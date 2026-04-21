import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { clearAuthToken } from "../utilities/auth";
import "../styles/Navbar.css";

const NAV_ITEMS = ["Profile", "Recent watches", "Recommendations", "Friends and family"];
const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post(`${VITE_BACKEND_BASE}/api/logout`);
    } catch (error) {
      console.warn("Logout request failed, clearing local session:", error?.response?.status || error?.message);
    } finally {
      clearAuthToken();
      navigate("/auth/login", { replace: true });
    }
  };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div className="filmly-navbar-root">
      <button
        type="button"
        className={`filmly-navbar-toggle ${isOpen ? "open" : ""}`}
        aria-label="Open navigation"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span />
      </button>

      <aside className={`filmly-navbar-drawer ${isOpen ? "open" : ""}`}>
        <nav className="filmly-navbar-menu" aria-label="Dashboard navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item} type="button" className="filmly-navbar-item" onClick={() => setIsOpen(false)}>
              {item}
            </button>
          ))}
          <button
            type="button"
            className="filmly-navbar-item"
            onClick={() => {
              setIsOpen(false);
              navigate("/search");
            }}
          >
            Search
          </button>
          <button
            type="button"
            className="filmly-navbar-item logout"
            onClick={async () => {
              setIsOpen(false);
              await handleLogout();
            }}
          >
            Logout
          </button>
        </nav>
      </aside>

      {isOpen && <button type="button" className="filmly-navbar-overlay" aria-label="Close menu" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
