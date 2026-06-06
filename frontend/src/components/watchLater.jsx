import { useEffect, useState } from "react";
import axios from "axios";
import MovieCard from "./MovieCard.jsx";
import "../styles/favorites.css";
import "../styles/watchLater.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";
const INITIAL_VISIBLE   = 4;

export default function WatchLater() {
  const [watchLater, setWatchLater] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [message, setMessage]       = useState("");
  const [showAll, setShowAll]       = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchWatchLater() {
      try {
        setLoading(true);
        setMessage("");
        const response = await axios.get(`${VITE_BACKEND_BASE}/api/watchLater`);
        if (!cancelled) {
          setWatchLater(response?.data?.data || []);
          if ((response?.data?.data || []).length === 0) setMessage("No watch later movies yet.");
        }
      } catch (error) {
        console.error("Error fetching watch later movies:", error);
        if (!cancelled) {
          setWatchLater([]);
          setMessage("Failed to load watch later movies.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWatchLater();
    return () => { cancelled = true; };
  }, []);

  const visible = showAll ? watchLater : watchLater.slice(0, INITIAL_VISIBLE);
  const hasMore = watchLater.length > INITIAL_VISIBLE;

  return (
    <section className="filmly-profile-section filmly-watchlater-section">
      {loading  && <div className="filmly-profile-status">Loading watch later movies...</div>}
      {!loading && message && <div className="filmly-profile-status">{message}</div>}

      {!loading && !message && watchLater.length > 0 && (
        <>
          <div className="filmly-watchlater-grid">
            {visible.map((movie, index) => (
              <MovieCard
                key={`${movie.tmdbId || movie.id || movie.title || "watchlater"}-${index}`}
                movie={movie}
                index={index}
              />
            ))}
          </div>

          {hasMore && (
            <div className="filmly-load-more-row">
              <button
                type="button"
                className="filmly-load-more-btn"
                onClick={() => setShowAll((s) => !s)}
              >
                {showAll
                  ? `Show less`
                  : `View more (${watchLater.length - INITIAL_VISIBLE} more)`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}