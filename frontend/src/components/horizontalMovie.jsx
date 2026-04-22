import { useNavigate } from "react-router-dom";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export default function HorizontalMovie({ movie }) {
  const navigate = useNavigate();
  const posterUrl = movie?.posterPath ? `${TMDB_IMAGE_BASE}${movie.posterPath}` : "";
  const movieId = movie?.tmdbId || movie?.movieId;
  const reviews = Array.isArray(movie?.reviews) ? movie.reviews : [];

  return (
    <article className="filmly-horizontal-movie-card">
      <div className="filmly-horizontal-movie-poster-wrap">
        {posterUrl ? (
          <img className="filmly-horizontal-movie-poster" src={posterUrl} alt={movie?.title || "Movie poster"} loading="lazy" />
        ) : (
          <div className="filmly-horizontal-movie-poster placeholder">No poster</div>
        )}
      </div>

      <div className="filmly-horizontal-movie-content">
        <div className="filmly-horizontal-movie-header">
          <h2 className="filmly-horizontal-movie-title">{movie?.title || "Untitled"}</h2>
          {reviews.length > 0 && (
            <span className="filmly-horizontal-movie-count">
              {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </span>
          )}
        </div>

        <p className="filmly-horizontal-movie-description">{movie?.overview || "No description available."}</p>

        {reviews.length > 0 && (
          <div className="filmly-horizontal-reviews">
            <h3>Reviews from friends</h3>
            <div className="filmly-horizontal-review-list">
              {reviews.map((review, index) => (
                <div key={`${review.friendName}-${index}`} className="filmly-horizontal-review-item">
                  <div className="filmly-horizontal-review-top">
                    <span className="filmly-horizontal-review-name">{review.friendName}</span>
                    {review.rating !== undefined && review.rating !== null && review.rating !== "" && (
                      <span className="filmly-horizontal-review-rating">{review.rating}/10</span>
                    )}
                  </div>
                  {review.comment ? (
                    <p className="filmly-horizontal-review-comment">{review.comment}</p>
                  ) : (
                    <p className="filmly-horizontal-review-comment muted">No review text provided.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="filmly-horizontal-view-details"
          onClick={() => {
            if (!movieId) return;
            navigate(`/movie/${movieId}`);
          }}
        >
          View details
        </button>
      </div>
    </article>
  );
}