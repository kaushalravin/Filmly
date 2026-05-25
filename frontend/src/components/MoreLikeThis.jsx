import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import MovieCard from "./MovieCard.jsx";
import "../styles/recommendations.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function MoreLikeThis({ tmdbId }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchMoreLikeThis() {
      if (!tmdbId) {
        setLoading(false);
        setMessage("Movie id is missing.");
        return;
      }

      try {
        setLoading(true);
        setMessage("");

        const response = await axios.get(`${VITE_BACKEND_BASE}/api/more-like-this/${tmdbId}`);
        const similarMovies = response.data?.data || [];

        if (!cancelled) {
          setMovies(similarMovies);
          if (similarMovies.length === 0) {
            setMessage("No similar movies found right now.");
          }
        }
      } catch (error) {
        console.error("Error fetching more like this:", error);
        if (!cancelled) {
          setMovies([]);
          setMessage(error?.response?.data?.message || "Failed to fetch similar movies.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMoreLikeThis();

    return () => {
      cancelled = true;
    };
  }, [tmdbId]);

  const visibleMovies = useMemo(() => movies.filter(Boolean), [movies]);

  return (
    <section className="filmly-recommendations-shell filmly-morelike-section">
      <header className="filmly-recommendations-header filmly-morelike-header">
        <div>
          <span className="filmly-recommendations-eyebrow">More like this</span>
          <h2>Similar picks</h2>
          <p>Movies close to this title based on embedding similarity from the FAISS index.</p>
        </div>
        <div className="filmly-recommendations-count">
          <strong>{visibleMovies.length}</strong>
          <span>results</span>
        </div>
      </header>

      {loading && <div className="filmly-recommendations-status">Loading similar movies...</div>}
      {message && !loading && <div className="filmly-recommendations-status">{message}</div>}

      {!loading && !message && visibleMovies.length > 0 && (
        <div className="filmly-recommendations-grid filmly-morelike-grid">
          {visibleMovies.map((movie, index) => (
            <MovieCard
              key={movie._id || movie.tmdbId || `${movie.title}-${index}`}
              movie={movie}
              index={index}
              ctaLabel="Show"
            />
          ))}
        </div>
      )}
    </section>
  );
}
