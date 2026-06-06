import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "./Navbar.jsx";
import "../styles/friendProfile.css";

const VITE_BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function PosterCard({ movie, label }) {
  const title = movie?.title || movie?.movieTitle || "Untitled";
  const poster = movie?.posterPath || movie?.poster_path || "";
  return (
    <article className="fp-mini-card">
      <div className="fp-poster-wrap">
        {poster ? (
          <img
            className="fp-poster"
            src={`${TMDB_IMAGE_BASE}${poster}`}
            alt={title}
            loading="lazy"
          />
        ) : (
          <div className="fp-poster placeholder">
            <span>No poster</span>
          </div>
        )}
      </div>
      <div className="fp-mini-card-copy">
        <h3>{title}</h3>
        {label && <p>{label}</p>}
      </div>
    </article>
  );
}

function ActivityItem({ activity }) {
  const action = String(activity?.action || "").replace(/_/g, " ");
  const date = activity?.createdAt
    ? new Date(activity.createdAt).toLocaleDateString()
    : "Recently";
  return (
    <article className="fp-activity-item">
      <div className="fp-activity-icon">🎬</div>
      <div>
        <strong>{activity?.movieTitle || "Untitled movie"}</strong>
        <p>{action}</p>
      </div>
      <span>{date}</span>
    </article>
  );
}

function ReviewItem({ review }) {
  // Backend now sends flat fields: movieTitle, posterPath (no nested movieId)
  const title  = review?.movieTitle  || "Untitled";
  const poster = review?.posterPath  || "";
  const date   = review?.createdAt
    ? new Date(review.createdAt).toLocaleDateString()
    : "Recently";
  return (
    <article className="fp-list-item">
      <div className="fp-poster-wrap list">
        {poster ? (
          <img
            className="fp-poster list"
            src={`${TMDB_IMAGE_BASE}${poster}`}
            alt={title}
            loading="lazy"
          />
        ) : (
          <div className="fp-poster list placeholder">
            <span>No poster</span>
          </div>
        )}
      </div>
      <div className="fp-list-copy">
        <div className="fp-list-topline">
          <h3>{title}</h3>
          <span>{review?.rating != null ? `${review.rating}/10` : "—"}</span>
        </div>
        <p>{review?.comment || "No review text added."}</p>
        <span className="fp-list-meta">{date}</span>
      </div>
    </article>
  );
}

export default function FriendProfile() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      try {
        setLoading(true);
        setError("");
        const response = await axios.get(
          `${VITE_BACKEND_BASE}/api/friends/profile/${friendId}`,
          { withCredentials: true }
        );
        if (!cancelled) {
          setProfile(response.data?.data || null);
        }
      } catch (err) {
        console.error("Failed to fetch friend profile:", err);
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              "Failed to load this friend's profile."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [friendId]);

  const username = profile?.username || "Friend";
  const favorites = (profile?.favorites || []).slice(0, 5);
  const watchlater = (profile?.watchlater || []).slice(0, 5);
  const activities = (profile?.friend_activity || []).slice(0, 8);
  const reviews = profile?.recentreviews || [];
  const friendCount = profile?.friendCount ?? 0;

  return (
    <main className="fp-page">
      <Navbar />
      <div className="fp-glow fp-glow-left" />
      <div className="fp-glow fp-glow-right" />

      <section className="fp-shell">
        {/* ── Back button ─────────────────────────────────────── */}
        <button
          type="button"
          className="fp-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ← Back
        </button>

        {/* ── Loading / Error states ──────────────────────────── */}
        {loading && (
          <div className="fp-status">Loading profile…</div>
        )}
        {!loading && error && (
          <div className="fp-status error">{error}</div>
        )}

        {!loading && !error && profile && (
          <>
            {/* ── Hero ─────────────────────────────────────────── */}
            <section className="fp-hero">
              <div className="fp-hero-copy">
                <span className="fp-eyebrow">Friend profile</span>
                <h1>{username}</h1>
                <p>
                  {username}'s movie library — their favorites, watch-later
                  picks, activity and recent reviews all in one place.
                </p>
              </div>

              <div className="fp-hero-panel">
                <span className="fp-eyebrow">Quick stats</span>
                <h2>{username}</h2>
                <div className="fp-stats-mini">
                  <div className="fp-stat-mini">
                    <span>Favorites</span>
                    <strong>{profile?.favorites?.length ?? 0}</strong>
                  </div>
                  <div className="fp-stat-mini">
                    <span>Watch later</span>
                    <strong>{profile?.watchlater?.length ?? 0}</strong>
                  </div>
                  <div className="fp-stat-mini">
                    <span>Reviews</span>
                    <strong>{reviews.length}</strong>
                  </div>
                  <div className="fp-stat-mini">
                    <span>Friends</span>
                    <strong>{friendCount}</strong>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Feature grid: Favorites + Watch later ─────────── */}
            <section className="fp-feature-grid">
              {/* Favorites */}
              <article className="fp-panel">
                <div className="fp-section-head compact">
                  <div>
                    <span className="fp-eyebrow">Favorites</span>
                    <h2>{username}'s five-star stack</h2>
                  </div>
                  <p>Movies they keep returning to.</p>
                </div>
                <div className="fp-strip">
                  {favorites.length > 0 ? (
                    favorites.map((movie) => (
                      <PosterCard
                        key={movie._id || movie.tmdbId || movie.title}
                        movie={movie}
                      />
                    ))
                  ) : (
                    <div className="fp-status inline">
                      No favorites added yet.
                    </div>
                  )}
                </div>
              </article>

              {/* Watch later */}
              <article className="fp-panel">
                <div className="fp-section-head compact">
                  <div>
                    <span className="fp-eyebrow">Watch later</span>
                    <h2>On their radar</h2>
                  </div>
                  <p>Movies they plan to watch.</p>
                </div>
                <div className="fp-strip">
                  {watchlater.length > 0 ? (
                    watchlater.map((movie) => (
                      <PosterCard
                        key={movie._id || movie.tmdbId || movie.title}
                        movie={movie}
                      />
                    ))
                  ) : (
                    <div className="fp-status inline">
                      No watch-later picks yet.
                    </div>
                  )}
                </div>
              </article>
            </section>

            {/* ── Dual grid: Reviews + Activity ─────────────────── */}
            <section className="fp-dual-grid">
              {/* Recent reviews */}
              <article className="fp-panel">
                <div className="fp-section-head compact">
                  <div>
                    <span className="fp-eyebrow">Recent reviews</span>
                    <h2>What {username} thought lately</h2>
                  </div>
                  <p>Their latest rating notes.</p>
                </div>
                <div className="fp-list">
                  {reviews.length > 0 ? (
                    reviews.map((review) => (
                      <ReviewItem
                        key={review._id || review.createdAt}
                        review={review}
                      />
                    ))
                  ) : (
                    <div className="fp-status inline">No reviews yet.</div>
                  )}
                </div>
              </article>

              {/* Activity */}
              <article className="fp-panel">
                <div className="fp-section-head compact">
                  <div>
                    <span className="fp-eyebrow">Activity</span>
                    <h2>Fresh moves</h2>
                  </div>
                  <p>Their recent library actions.</p>
                </div>
                <div className="fp-activity-list">
                  {activities.length > 0 ? (
                    activities.map((activity) => (
                      <ActivityItem
                        key={activity._id || activity.createdAt}
                        activity={activity}
                      />
                    ))
                  ) : (
                    <div className="fp-status inline">No recent activity.</div>
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
