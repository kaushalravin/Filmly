import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "./Navbar.jsx";
import HorizontalMovie from "./horizontalMovie.jsx";
import "../styles/friendsandfamily.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";
const PAGE_SIZE = 6;

export default function FriendsAndFamily() {
  const [movies, setMovies]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [message, setMessage]       = useState("");
  const [visibleCount, setVisible]  = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;

    async function fetchFriendsMovies() {
      try {
        setLoading(true);
        setMessage("");

        const response      = await axios.get(`${VITE_BACKEND_BASE}/api/friends/movies`);
        const friendBuckets = response?.data?.data || {};
        const groupedMovies = {};

        Object.entries(friendBuckets).forEach(([friendName, friendMovies]) => {
          friendMovies.forEach((movie) => {
            const key = String(movie.tmdbId || movie.movieId);
            if (!groupedMovies[key]) {
              groupedMovies[key] = {
                movieId:    movie.movieId,
                tmdbId:     movie.tmdbId,
                title:      movie.title,
                posterPath: movie.posterPath,
                overview:   movie.overview,
                reviews:    [],
              };
            }
            groupedMovies[key].reviews.push({
              friendName,
              rating:  movie.rating,
              comment: movie.comment,
            });
          });
        });

        if (!cancelled) {
          const movieList = Object.values(groupedMovies);
          setMovies(movieList);
          if (movieList.length === 0) setMessage("No movies watched by friends yet.");
        }
      } catch (error) {
        console.error("Error fetching friends' movies:", error);
        if (!cancelled) {
          setMovies([]);
          setMessage("Failed to fetch friends' movies. Please try again later.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFriendsMovies();
    return () => { cancelled = true; };
  }, []);

  const visibleMovies = movies.slice(0, visibleCount);
  const hasMore       = visibleCount < movies.length;

  return (
    <main className="filmly-friendsandfamily-page">
      <Navbar />
      <div className="filmly-friendsandfamily-glow filmly-friendsandfamily-glow-left" />
      <div className="filmly-friendsandfamily-glow filmly-friendsandfamily-glow-right" />

      <section className="filmly-friendsandfamily-shell">
        <header className="filmly-friendsandfamily-head">
          <span className="filmly-friendsandfamily-eyebrow">Friends and family</span>
          <h1>Movies watched by your friends.</h1>
          <p>See what your friends have reviewed, all in one place.</p>
        </header>

        {loading  && <div className="filmly-friendsandfamily-status">Loading watched movies...</div>}
        {!loading && message && <div className="filmly-friendsandfamily-status error">{message}</div>}

        {!loading && !message && visibleMovies.length > 0 && (
          <>
            <div className="filmly-friendsandfamily-list">
              {visibleMovies.map((movie) => (
                <HorizontalMovie key={movie.tmdbId || movie.movieId} movie={movie} />
              ))}
            </div>

            {/* ── Pagination controls ── */}
            <div className="filmly-load-more-row">
              {hasMore && (
                <button
                  type="button"
                  className="filmly-load-more-btn"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                >
                  Load more ({visibleCount}/{movies.length} shown)
                </button>
              )}
              {visibleCount > PAGE_SIZE && (
                <button
                  type="button"
                  className="filmly-load-more-btn ghost"
                  onClick={() => setVisible(PAGE_SIZE)}
                >
                  Show less
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}