import { useEffect, useState } from "react";
import "../styles/Navbar.css";

const NAV_ITEMS = ["Profile", "Recent watches", "Recommendations", "Friends and family"];

export default function Navbar({ onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

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
            className="filmly-navbar-item logout"
            onClick={() => {
              setIsOpen(false);
              onLogout?.();
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
