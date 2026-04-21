import { useNavigate } from "react-router-dom";
import "../styles/recentCard.css";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export default function RecentCard({ review, index }) {
  const navigate = useNavigate();
  const movieId = review?.movieId?._id || review?.movieId?.id || review?.movieId;
  const tmdbId = review?.movieId?.tmdbId || review?.tmdbId;
  const posterUrl = review?.movieId?.posterPath ? `${TMDB_IMAGE_BASE}${review.movieId.posterPath}` : "";
  const rating = Number(review?.rating ?? 0);
  const username = review?.userId?.username || review?.username || "You";
  const watchedDate = review?.createdAt ? new Date(review.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }) : "Recently";

  return (
    <article className="filmly-recent-card">
      <div className="filmly-recent-poster-wrap">
        {posterUrl ? (
          <img className="filmly-recent-poster" src={posterUrl} alt={review?.movieId?.title || "Movie poster"} loading="lazy" />
        ) : (
          <div className="filmly-recent-poster placeholder">
            <span>No poster</span>
          </div>
        )}
        <div className="filmly-recent-chip">#{index + 1}</div>
      </div>

      <div className="filmly-recent-content">
        <div className="filmly-recent-title-row">
          <h3>{review?.movieId?.title || "Untitled"}</h3>
          <span className="filmly-recent-meta">{watchedDate}</span>
        </div>

        <div className="filmly-recent-rating">
          <span className="filmly-recent-rating-label">Your rating:</span>
          <span className="filmly-recent-rating-value">{rating}/10</span>
        </div>

        <p className="filmly-recent-comment">{review?.comment || "No review provided."}</p>

        <div className="filmly-recent-footer">
          <span className="filmly-recent-username">Reviewed by {username}</span>
          <button
            type="button"
            className="filmly-recent-link"
            onClick={() => {
              if (!tmdbId) return;
              navigate(`/movie/${tmdbId}`);
            }}
          >
            View movie
          </button>
        </div>
      </div>
    </article>
  );
}
