import { useEffect, useState } from "react";
import axios from "axios";
import HorizontalMovie from "./horizontalMovie.jsx";
import "../styles/favorites.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchFavorites() {
      try {
        setLoading(true);
        setMessage("");

        const response = await axios.get(`${VITE_BACKEND_BASE}/api/favorites`);

        if (!cancelled) {
          setFavorites(response?.data?.data || []);
          if ((response?.data?.data || []).length === 0) {
            setMessage("No favorites added yet.");
          }
        }
      } catch (error) {
        console.error("Error fetching favorites:", error);
        if (!cancelled) {
          setFavorites([]);
          setMessage("Failed to load favorites.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchFavorites();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="filmly-profile-section filmly-favorites-section">
      {loading && <div className="filmly-profile-status">Loading favorites...</div>}
      {!loading && message && <div className="filmly-profile-status">{message}</div>}

      {!loading && !message && favorites.length > 0 && (
        <div className="filmly-favorites-list">
          {favorites.map((movie, index) => (
            <HorizontalMovie key={`${movie.tmdbId || movie.id || movie.title || "favorite"}-${index}`} movie={movie} />
          ))}
        </div>
      )}
    </section>
  );
}