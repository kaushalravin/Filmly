import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import AddReview from "./AddReview.jsx";
import ShowReviews from "./showReviews.jsx";
import UpdatePopup from "./UpdatePopup.jsx";
import "../styles/Movie.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";
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

const TMDB_IMAGE_BASE_W185 = "https://image.tmdb.org/t/p/w185";

const mapPersonCard = (person) => ({
    name: person?.name || "Unknown",
    posterPath: person?.posterPath || person?.profile_path || "",
    character: person?.character || person?.job || "",
});

const getPersonImage = (posterPath) => {
    if (!posterPath) return "";
    return `${TMDB_IMAGE_BASE_W185}${posterPath}`;
};

export default function Movie({ tmdbId: propTmdbId }) {
    const navigate = useNavigate();
    const { tmdbid: routeTmdbIdLower, tmdbId: routeTmdbIdCamel } = useParams();

    const tmdbId = propTmdbId || routeTmdbIdLower || routeTmdbIdCamel;
    const [movie, setMovie] = useState(null);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);
    const [showAllPeople, setShowAllPeople] = useState(false);
    const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
    const [selectedReview, setSelectedReview] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchMovieDetails() {
            if (!tmdbId) {
                setMsg("Movie id is missing.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setMsg("");
                const response = await axios.get(`${VITE_BACKEND_BASE}/api/movie/${tmdbId}`);

                if (!cancelled) {
                    setMovie(response.data?.data || null);
                }
            } catch (err) {
                console.error("Failed to fetch movie details:", err);
                if (!cancelled) {
                    setMsg("Failed to fetch movie details");
                    setMovie(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchMovieDetails();

        return () => {
            cancelled = true;
        };
    }, [tmdbId]);

    const posterUrl = useMemo(() => {
        if (!movie?.posterPath) return "";
        return `${TMDB_IMAGE_BASE}${movie.posterPath}`;
    }, [movie?.posterPath]);

    const normalizedMovie = useMemo(() => {
        if (!movie) return null;

        const castSource = Array.isArray(movie.cast) ? movie.cast : [];

        return {
            tmdbId: movie.tmdbId || "--",
            title: movie.title || "Untitled",
            overview: movie.overview || "No overview is available for this movie yet.",
            genres: Array.isArray(movie.genres) ? movie.genres.map(mapGenreLabel) : [],
            releaseDate: movie.releaseDate || null,
            popularity: Number(movie.popularity || 0),
            trailerUrl: movie.trailerUrl || movie.trailer_url || "",
            updatedAt: movie.updatedAt || null,
            embeddingSize: Array.isArray(movie.embedding) ? movie.embedding.length : 0,
            cast: castSource.map(mapPersonCard),
        };
    }, [movie]);

    const formatDate = (value) => {
        if (!value) return "--";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
        });
    };

    const previewCast = useMemo(() => normalizedMovie?.cast.slice(0, 6) || [], [normalizedMovie?.cast]);
    const peopleToShow = showAllPeople ? [...(normalizedMovie?.cast || [])] : [...previewCast];

    const handleReviewPopupSave = (updatedReview) => {
        setSelectedReview(null);
        setReviewRefreshKey((prev) => prev + 1);
    };

    const handleReviewPopupClose = () => {
        setSelectedReview(null);
    };

    return (
        <>
        <main className="filmly-movie-page">
            <Navbar />

            <div className="filmly-movie-glow filmly-movie-glow-left" />
            <div className="filmly-movie-glow filmly-movie-glow-right" />

            <section className="filmly-movie-shell">
                <header className="filmly-movie-header">
                    <button type="button" className="filmly-movie-back" onClick={() => navigate("/dashboard")}>Back to dashboard</button>
                    <span className="filmly-movie-eyebrow">Movie details</span>
                </header>

                {loading && <div className="filmly-movie-status">Loading movie details...</div>}

                {!loading && msg && <div className="filmly-movie-status error">{msg}</div>}

                {!loading && !msg && normalizedMovie && (
                    <article className="filmly-movie-feature-card">
                        <div className="filmly-movie-copy">
                            <h1>{normalizedMovie.title}</h1>

                            <div className="filmly-movie-meta-row">
                                <span>{normalizedMovie.releaseDate ? String(normalizedMovie.releaseDate).slice(0, 4) : "TBA"}</span>
                                <span>Popularity {normalizedMovie.popularity.toFixed(0)}</span>
                                <span>TMDB {normalizedMovie.tmdbId}</span>
                            </div>

                            <p>{normalizedMovie.overview}</p>

                            {normalizedMovie.genres.length > 0 && (
                                <div className="filmly-movie-tags">
                                    {normalizedMovie.genres.map((genre, index) => (
                                        <span key={`${genre}-${index}`} className="filmly-movie-tag">
                                            {genre}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <section className="filmly-movie-attributes">
                                <div className="filmly-movie-attribute-card">
                                    <span>Release date</span>
                                    <strong>{formatDate(normalizedMovie.releaseDate)}</strong>
                                </div>
                                <div className="filmly-movie-attribute-card">
                                    <span>Genres</span>
                                    <strong>{normalizedMovie.genres.length > 0 ? normalizedMovie.genres.join(", ") : "--"}</strong>
                                </div>
                                <div className="filmly-movie-attribute-card">
                                    <span>Updated at</span>
                                    <strong>{formatDate(normalizedMovie.updatedAt)}</strong>
                                </div>
                                <div className="filmly-movie-attribute-card">
                                    <span>Embedding size</span>
                                    <strong>{normalizedMovie.embeddingSize}</strong>
                                </div>
                                <div className="filmly-movie-attribute-card">
                                    <span>Genres count</span>
                                    <strong>{normalizedMovie.genres.length}</strong>
                                </div>
                            </section>

                            {normalizedMovie.trailerUrl && (
                                <a className="filmly-movie-trailer" href={normalizedMovie.trailerUrl} target="_blank" rel="noreferrer">
                                    Watch trailer
                                </a>
                            )}
                        </div>

                        <div className="filmly-movie-poster-wrap">
                            {posterUrl ? (
                                <img src={posterUrl} alt={normalizedMovie.title} className="filmly-movie-poster" loading="lazy" />
                            ) : (
                                <div className="filmly-movie-poster placeholder">No poster available</div>
                            )}
                        </div>
                    </article>
                )}

                {!loading && !msg && normalizedMovie && peopleToShow.length > 0 && (
                    <section className="filmly-people-section">
                        <div className="filmly-people-header">
                            <div>
                                <span className="filmly-movie-eyebrow">Cast</span>
                                <h2>{showAllPeople ? "Full cast" : "Preview row"}</h2>
                            </div>

                            <button
                                type="button"
                                className="filmly-people-toggle"
                                onClick={() => setShowAllPeople((prev) => !prev)}
                            >
                                <span className="filmly-people-toggle-icon">{showAllPeople ? "▲" : "▼"}</span>
                                <span>{showAllPeople ? "Show less" : "Show more"}</span>
                            </button>
                        </div>

                        <div className={`filmly-people-grid ${showAllPeople ? "expanded" : "collapsed"}`}>
                            {peopleToShow.map((person, index) => (
                                <article key={`${person.name}-${person.character}-${index}`} className="filmly-person-card">
                                    <div className="filmly-person-avatar-wrap">
                                        {getPersonImage(person.posterPath) ? (
                                            <img
                                                className="filmly-person-avatar"
                                                src={getPersonImage(person.posterPath)}
                                                alt={person.name}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="filmly-person-avatar placeholder">
                                                <span>{person.name.slice(0, 1).toUpperCase()}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="filmly-person-copy">
                                        <h3>{person.name}</h3>
                                        <p>{person.character || "Crew"}</p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
            </section>

            <div className="filmly-movie-review-wrap">
                <AddReview tmdbId={tmdbId} onReviewAdded={() => setReviewRefreshKey((prev) => prev + 1)} />
                <ShowReviews tmdbId={tmdbId} refreshKey={reviewRefreshKey} onEditReview={setSelectedReview} />
            </div>
        </main>

        {selectedReview && (
            <UpdatePopup
                review={selectedReview}
                onClose={handleReviewPopupClose}
                onSave={handleReviewPopupSave}
            />
        )}
        </>
    );
}