import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { clearAuthToken } from "../utilities/auth";
import Navbar from "./Navbar.jsx";
import MovieCard from "./MovieCard.jsx";
import "../styles/dashboard.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export default function Dashboard() {
  const navigate = useNavigate();
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchTrending() {
      try {
        setLoading(true);
        setMsg("");
        const response = await axios.get(`${VITE_BACKEND_BASE}/api/trending`);

        if (!cancelled) {
          setTrending(response.data?.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch trending movies:", err);
        if (!cancelled) {
          setMsg("Failed to fetch trending data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTrending();

    return () => {
      cancelled = true;
    };
  }, []);

  const featuredMovies = trending.slice(0, 6);

  const spotlightMovie = featuredMovies[0];

  const handleLogout = async () => {
    try {
      await axios.post(`${VITE_BACKEND_BASE}/api/logout`);
    } catch (error) {
      // User should still be logged out on client even if server token is expired/invalid.
      console.warn("Logout request failed, clearing local session:", error?.response?.status || error?.message);
    } finally {
      clearAuthToken();
      navigate("/auth/login", { replace: true });
    }
  };

  return (
    <main className="filmly-dashboard-page">
      <Navbar onLogout={handleLogout} />
      <div className="filmly-dashboard-glow filmly-dashboard-glow-left" />
      <div className="filmly-dashboard-glow filmly-dashboard-glow-right" />

      <section className="filmly-dashboard-shell">
        <section className="filmly-spotlight-card">
          <div className="filmly-spotlight-copy">
            <span className="filmly-dashboard-eyebrow">Spotlight</span>
            <h2>{spotlightMovie?.title || "Trending now"}</h2>
            <p>{spotlightMovie?.overview || "Your top title appears here once the API responds."}</p>
          </div>

          <div className="filmly-spotlight-media">
            {spotlightMovie?.posterPath ? (
              <img
                className="filmly-spotlight-poster"
                src={`${TMDB_IMAGE_BASE}${spotlightMovie.posterPath}`}
                alt={spotlightMovie.title}
                loading="lazy"
              />
            ) : (
              <div className="filmly-spotlight-poster placeholder">
                <span>No poster</span>
              </div>
            )}
          </div>
        </section>

        <section className="filmly-dashboard-section">
          <div className="filmly-dashboard-section-head">
            <div>
              <span className="filmly-dashboard-eyebrow">Trending now</span>
              <h2>Top picks.</h2>
            </div>
            <p>Poster, year, and popularity at a glance.</p>
          </div>

          {loading && <div className="filmly-dashboard-status">Loading trending movies...</div>}
          {msg && !loading && <div className="filmly-dashboard-status error">{msg}</div>}

          {!loading && !msg && featuredMovies.length === 0 && (
            <div className="filmly-dashboard-status">No trending movies found right now.</div>
          )}

          <div className="filmly-dashboard-grid">
            {featuredMovies.map((movie, index) => {
              return (
                <MovieCard
                  key={`${movie.tmdbId || movie.id || movie.title || "movie"}-${index}`}
                  movie={movie}
                  index={index}
                />
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}