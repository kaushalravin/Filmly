import "../styles/movieCard.css";
import { useNavigate } from "react-router-dom";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_GENRE_MAP = {
  "12": "Adventure",
  "16": "Animation",
  "18": "Drama",
  "27": "Horror",
  "28": "Action",
  "35": "Comedy",
  "36": "History",
  "37": "Western",
  "80": "Crime",
  "99": "Documentary",
  "878": "Science Fiction",
  "9648": "Mystery",
  "10402": "Music",
  "10749": "Romance",
  "10751": "Family",
  "53": "Thriller",
  "10752": "War",
  "10770": "TV Movie",
  "14": "Fantasy",
};

const mapGenreLabel = (genre) => {
  const key = String(genre).trim();
  return TMDB_GENRE_MAP[key] || key;
};

export default function MovieCard({ movie, index }) {
  const navigate = useNavigate();
  const posterUrl = movie?.posterPath ? `${TMDB_IMAGE_BASE}${movie.posterPath}` : "";
  const movieId = movie?.tmdbId || movie?.id;
  const movieGenres = Array.isArray(movie?.genres) ? movie.genres.map(mapGenreLabel).filter(Boolean) : [];

  return (
    <article className="filmly-movie-card">
      <div className="filmly-movie-poster-wrap">
        {posterUrl ? (
          <img className="filmly-movie-poster" src={posterUrl} alt={movie?.title || "Movie poster"} loading="lazy" />
        ) : (
          <div className="filmly-movie-poster placeholder">
            <span>No poster</span>
          </div>
        )}
        <div className="filmly-movie-chip">#{index + 1}</div>
      </div>

      <div className="filmly-movie-content">
        <div className="filmly-movie-title-row">
          <h3>{movie?.title || "Untitled"}</h3>
          <span className="filmly-movie-meta">{movie?.releaseDate ? movie.releaseDate.slice(0, 4) : "TBA"}</span>
        </div>

        <p className="filmly-movie-overview">{movie?.overview || "No description available."}</p>

        {movieGenres.length > 0 && (
          <div className="filmly-movie-genres" aria-label="Movie genres">
            {movieGenres.slice(0, 3).map((genre, genreIndex) => (
              <span key={`${genre}-${genreIndex}`} className="filmly-movie-genre-tag">
                {genre}
              </span>
            ))}
          </div>
        )}

        <div className="filmly-movie-footer">
          <span className="filmly-movie-popularity">Popularity {Number(movie?.popularity || 0).toFixed(0)}</span>
          <button
            type="button"
            className="filmly-movie-link"
            onClick={() => {
              if (!movieId) return;
              navigate(`/movie/${movieId}`);
            }}
          >
            View details
          </button>
        </div>
      </div>
    </article>
  );
}
