import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import Navbar from "./Navbar.jsx";
import MovieCard from "./MovieCard.jsx";
import { mapGenreLabel } from "./MovieCard.jsx";
import "../styles/dashboard.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TRENDING_PAGE_SIZE = 20;

export default function Dashboard() {
  const [summary, setSummary]               = useState(null);
  const [trending, setTrending]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [msg, setMsg]                       = useState("");
  const [trendingHasMore, setTrendingHasMore] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(false);

  const loadingRef   = useRef(false);   // guard against overlapping fetches
  const sentinelRef  = useRef(null);
  const pageRef      = useRef(1);       // always in sync with trendingPage

  /* ── Load one page of trending movies ──────────────────────────────── */
  const loadTrending = useCallback(async (page) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setTrendingLoading(true);
    try {
      const res = await axios.get(
        `${VITE_BACKEND_BASE}/api/trending?page=${page}&limit=${TRENDING_PAGE_SIZE}`
      );
      const movies = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.results)
          ? res.data.results
          : [];
      const total = Math.max(1, Number(res.data?.totalPages || 1));
      setTrending((prev) => (page === 1 ? movies : [...prev, ...movies]));
      setTrendingHasMore(page < total || movies.length === TRENDING_PAGE_SIZE);
      pageRef.current = page + 1;
    } catch (err) {
      console.error("Failed to load trending:", err);
      setTrendingHasMore(false);
    } finally {
      loadingRef.current = false;
      setTrendingLoading(false);
    }
  }, []);

  /* ── Fetch dashboard summary + initial trending on mount ────────────── */
  useEffect(() => {
    let cancelled = false;
    async function fetchSummary() {
      try {
        setLoading(true);
        setMsg("");
        const summaryResponse = await axios.get(
          `${VITE_BACKEND_BASE}/api/dashboard-summary`,
          { withCredentials: true }
        );
        if (!cancelled) setSummary(summaryResponse.data?.data || null);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        if (!cancelled) setMsg("Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSummary();
    loadTrending(1);
    return () => { cancelled = true; };
  }, [loadTrending]);

  /* ── IntersectionObserver: load next page when sentinel enters view ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !trendingHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          loadTrending(pageRef.current);
        }
      },
      { rootMargin: "200px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [trendingHasMore, loadTrending]);

  /* ── Derived values ─────────────────────────────────────────────────── */
  const spotlightMovie     = trending[0];
  const spotlightGenres    = Array.isArray(spotlightMovie?.genres)
    ? spotlightMovie.genres.map(mapGenreLabel).filter(Boolean)
    : [];
  const spotlightYear       = spotlightMovie?.releaseDate ? spotlightMovie.releaseDate.slice(0, 4) : "TBA";
  const spotlightPopularity = Number(spotlightMovie?.popularity || 0).toFixed(0);
  const topGenres           = summary?.topGenres || [];
  const favoriteMovies      = (summary?.favoriteMovies || []).slice(0, 5);
  const recentReviews       = (summary?.recentReviews  || []).slice(0, 5);
  const recentActivity      = (summary?.recentActivity || []).slice(0, 5);
  const totals              = summary?.totals || {};
  const username            = summary?.username || "";
  const tasteSummary        = summary?.tasteSummary || "We're learning your patterns and shaping a smarter, more personal dashboard.";
  const formatGenreName     = (genre) => mapGenreLabel(genre?.genre ?? genre?.name ?? genre);
  const leadingGenre        = topGenres[0] ? formatGenreName(topGenres[0]) : "Your movie taste";
  const tasteLines = [
    tasteSummary,
    topGenres[0]
      ? `${leadingGenre} is your strongest signal right now.`
      : "Keep rating and saving movies to reveal your strongest signal.",
    `You've logged ${totals.reviews ?? 0} reviews, ${totals.favorites ?? 0} favorites, and ${totals.watchlater ?? 0} watch-later picks.`,
  ];

  return (
    <main className="filmly-dashboard-page">
      <Navbar />
      <div className="filmly-dashboard-glow filmly-dashboard-glow-left" />
      <div className="filmly-dashboard-glow filmly-dashboard-glow-right" />

      <section className="filmly-dashboard-shell">
        <section className="filmly-dashboard-hero">
          <div className="filmly-dashboard-hero-copy">
            <span className="filmly-dashboard-eyebrow">Personal cinema</span>
            <h1>{username ? `Welcome back, ${username}` : "Welcome back"}</h1>
            <p>{tasteSummary}</p>
          </div>

          <div className="filmly-dashboard-hero-panel">
            <span className="filmly-dashboard-spotlight-label">Taste summary</span>
            <h2>{leadingGenre}</h2>
            <div className="filmly-dashboard-taste-summary-lines" aria-label="Taste summary">
              {tasteLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="filmly-dashboard-meta-row">
              <span>{summary?.generatedAt ? "Updated recently" : "Loading taste profile"}</span>
              <span>{summary?.averageRating != null ? `${summary.averageRating.toFixed(1)}/10 avg` : ""}</span>
            </div>
          </div>
        </section>

        <section className="filmly-dashboard-stats-grid">
          <article className="filmly-dashboard-stat accent-blue"><span>Favorites</span><strong>{totals.favorites ?? 0}</strong></article>
          <article className="filmly-dashboard-stat accent-gold"><span>Watch later</span><strong>{totals.watchlater ?? 0}</strong></article>
          <article className="filmly-dashboard-stat accent-emerald"><span>Reviews</span><strong>{totals.reviews ?? 0}</strong></article>
          <article className="filmly-dashboard-stat accent-purple"><span>Avg rating</span><strong>{summary?.averageRating != null ? summary.averageRating.toFixed(1) : "0.0"}</strong></article>
        </section>

        <section className="filmly-dashboard-feature-grid">
          <article className="filmly-dashboard-panel">
            <div className="filmly-dashboard-section-head compact">
              <div>
                <span className="filmly-dashboard-eyebrow">Top genres</span>
                <h2>Your strongest signals</h2>
              </div>
              <p>Built from favorites and recent reviews.</p>
            </div>

            <div className="filmly-dashboard-genre-list">
              {topGenres.length > 0 ? topGenres.map((genre) => (
                <div key={genre.genre} className="filmly-dashboard-genre-item">
                  <div>
                    <strong>{formatGenreName(genre)}</strong>
                    <span>{genre.count} mentions</span>
                  </div>
                  <div className="filmly-dashboard-genre-meter">
                    <span style={{ width: `${Math.min(100, 28 + genre.count * 18)}%` }} />
                  </div>
                </div>
              )) : (
                <div className="filmly-dashboard-status">Add favorites and reviews to unlock your taste map.</div>
              )}
            </div>
          </article>

          <article className="filmly-dashboard-panel">
            <div className="filmly-dashboard-section-head compact">
              <div>
                <span className="filmly-dashboard-eyebrow">Favorites</span>
                <h2>Your five-star stack</h2>
              </div>
              <p>Movies you keep returning to, ranked by your own activity.</p>
            </div>

            <div className="filmly-dashboard-strip">
              {favoriteMovies.length > 0 ? favoriteMovies.map((movie) => (
                <article key={movie.id || movie.tmdbId || movie.title} className="filmly-dashboard-mini-card">
                  <div className="filmly-dashboard-poster mini placeholder">
                    {movie.posterPath ? <img className="filmly-dashboard-poster mini" src={`${TMDB_IMAGE_BASE}${movie.posterPath}`} alt={movie.title} loading="lazy" /> : <span>No poster</span>}
                  </div>
                  <div>
                    <h3>{movie.title || movie.movieTitle}</h3>
                    <p>{movie.rating != null ? `${movie.rating}/10 from you` : "No rating yet"}</p>
                  </div>
                </article>
              )) : (
                <div className="filmly-dashboard-status">Your favorite movies will appear here once you start saving them.</div>
              )}
            </div>
          </article>
        </section>

        <section className="filmly-dashboard-dual-grid">
          <article className="filmly-dashboard-panel">
            <div className="filmly-dashboard-section-head compact">
              <div>
                <span className="filmly-dashboard-eyebrow">Recent reviews</span>
                <h2>What you thought lately</h2>
              </div>
              <p>The latest rating notes from your profile.</p>
            </div>

            <div className="filmly-dashboard-list">
              {recentReviews.length > 0 ? recentReviews.map((review) => (
                <article key={review.reviewId || `${review.movieTitle}-${review.createdAt}`} className="filmly-dashboard-list-item">
                  <div className="filmly-dashboard-poster list placeholder">
                    {review.posterPath ? <img className="filmly-dashboard-poster list" src={`${TMDB_IMAGE_BASE}${review.posterPath}`} alt={review.movieTitle} loading="lazy" /> : <span>No poster</span>}
                  </div>
                  <div className="filmly-dashboard-list-copy">
                    <div className="filmly-dashboard-list-topline">
                      <h3>{review.movieTitle}</h3>
                      <span>{review.rating}/10</span>
                    </div>
                    <p>{review.comment || "No review text added."}</p>
                    <div className="filmly-dashboard-list-meta">
                      <span>{(review.genres || []).slice(0, 2).map(mapGenreLabel).join(" • ") || "Genre pending"}</span>
                      <span>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Recently"}</span>
                    </div>
                  </div>
                </article>
              )) : (
                <div className="filmly-dashboard-status">Write a few reviews and we'll turn them into a richer profile.</div>
              )}
            </div>
          </article>

          <article className="filmly-dashboard-panel">
            <div className="filmly-dashboard-section-head compact">
              <div>
                <span className="filmly-dashboard-eyebrow">Activity</span>
                <h2>Fresh moves</h2>
              </div>
              <p>Favorite and watch-later actions from your library.</p>
            </div>

            <div className="filmly-dashboard-activity-list">
              {recentActivity.length > 0 ? recentActivity.map((activity) => (
                <article key={activity.id || `${activity.movieTitle}-${activity.createdAt}`} className="filmly-dashboard-activity-item">
                  <div className="filmly-dashboard-activity-icon">🎬</div>
                  <div>
                    <strong>{activity.movieTitle || "Untitled movie"}</strong>
                    <p>{String(activity.action || "Updated library").replace(/_/g, " ")}</p>
                  </div>
                  <span>{activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : "Recently"}</span>
                </article>
              )) : (
                <div className="filmly-dashboard-status">Your latest saves and removals will show up here automatically.</div>
              )}
            </div>
          </article>
        </section>

        <section className="filmly-dashboard-section">
          <section className="filmly-spotlight-card">
            <div className="filmly-spotlight-copy">
              <span className="filmly-dashboard-eyebrow">Spotlight</span>
              <h2>{spotlightMovie?.title || "Trending now"}</h2>
              <p>{spotlightMovie?.overview || "Your top title appears here once the API responds."}</p>
              <div className="filmly-spotlight-meta">
                <div className="filmly-spotlight-meta-item">
                  <span>Year</span>
                  <strong>{spotlightYear}</strong>
                </div>
                <div className="filmly-spotlight-meta-item">
                  <span>Popularity</span>
                  <strong>{spotlightPopularity}</strong>
                </div>
                <div className="filmly-spotlight-meta-item">
                  <span>Rank</span>
                  <strong>#1</strong>
                </div>
              </div>
              {spotlightGenres.length > 0 && (
                <div className="filmly-dashboard-chip-row">
                  {spotlightGenres.slice(0, 3).map((genre) => (
                    <span key={genre} className="filmly-dashboard-chip">{genre}</span>
                  ))}
                </div>
              )}
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

          {/* ── Trending grid with infinite scroll ── */}
          {msg && !loading && <div className="filmly-dashboard-status error">{msg}</div>}

          {!loading && !msg && trending.length === 0 && !trendingLoading && (
            <div className="filmly-dashboard-status">No trending movies found right now.</div>
          )}

          <div className="filmly-dashboard-grid">
            {trending.map((movie, index) => (
              <MovieCard
                key={`${movie.tmdbId || movie.id || movie.title || "movie"}-${index}`}
                movie={movie}
                index={index}
              />
            ))}
          </div>

          {/* Spinner shown while fetching a new page */}
          {trendingLoading && (
            <div className="filmly-trending-loader">
              <span className="filmly-trending-spinner" />
              <span>Loading more movies…</span>
            </div>
          )}

          {/* Invisible sentinel — IntersectionObserver triggers here */}
          {trendingHasMore && <div ref={sentinelRef} className="filmly-trending-sentinel" aria-hidden="true" />}

          {!trendingHasMore && trending.length > 0 && (
            <div className="filmly-dashboard-status" style={{ marginTop: "2rem" }}>
              You've reached the end of this week's trending list.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}