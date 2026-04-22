import { useEffect, useState } from "react";
import axios from "axios";
import MovieCard from "./MovieCard.jsx";
import "../styles/favorites.css";
import "../styles/watchLater.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function WatchLater() {
  const [watchLater, setWatchLater] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchWatchLater() {
      try {
        setLoading(true);
        setMessage("");

        const response = await axios.get(`${VITE_BACKEND_BASE}/api/watchLater`);

        if (!cancelled) {
          setWatchLater(response?.data?.data || []);
          if ((response?.data?.data || []).length === 0) {
            setMessage("No watch later movies yet.");
          }
        }
      } catch (error) {
        console.error("Error fetching watch later movies:", error);
        if (!cancelled) {
          setWatchLater([]);
          setMessage("Failed to load watch later movies.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchWatchLater();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="filmly-profile-section filmly-watchlater-section">
      {loading && <div className="filmly-profile-status">Loading watch later movies...</div>}
      {!loading && message && <div className="filmly-profile-status">{message}</div>}

      {!loading && !message && watchLater.length > 0 && (
        <div className="filmly-watchlater-grid">
          {watchLater.map((movie, index) => (
            <MovieCard key={`${movie.tmdbId || movie.id || movie.title || "watchlater"}-${index}`} movie={movie} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}