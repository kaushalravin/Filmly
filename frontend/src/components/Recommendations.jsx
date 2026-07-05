import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Navbar from "./Navbar.jsx";
import MovieCard from "./MovieCard.jsx";
import "../styles/recommendations.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function Recommendations() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    useEffect(() => {
        let cancelled = false;

        const fetchExplanations = async (movieIds) => {
            try {
                const expResponse = await axios.post(`${VITE_BACKEND_BASE}/api/recommendations/explain`, { movieIds });
                if (!cancelled) {
                    const explanations = expResponse.data?.data || [];
                    const expMap = new Map(explanations.map(e => [String(e.id), e]));
                    
                    setMovies(prevMovies => prevMovies.map(movie => {
                        const explanation = expMap.get(String(movie._id));
                        if (explanation) {
                            return { ...movie, explanation };
                        }
                        // if failed, we stop showing skeleton by making it undefined
                        return movie.explanation === null ? { ...movie, explanation: undefined } : movie;
                    }));
                }
            } catch (error) {
                console.error("Error fetching explanations:", error);
                if (!cancelled) {
                    // Turn off loading skeletons on error
                    setMovies(prevMovies => prevMovies.map(movie => 
                        movie.explanation === null ? { ...movie, explanation: undefined } : movie
                    ));
                }
            }
        };

        const fetchRecommendations = async () => {
            try {
                setLoading(true);
                setMessage("");

                const response = await axios.get(`${VITE_BACKEND_BASE}/api/recommendations`);

                if (!cancelled) {
                    const loadedMovies = response.data?.data || [];
                    setMovies(loadedMovies);

                    if (loadedMovies.length > 0) {
                        const movieIds = loadedMovies.map(m => m._id);
                        fetchExplanations(movieIds);
                    }
                }
            } catch (error) {
                console.error("Error fetching recommendations:", error);
                if (!cancelled) {
                    setMessage(error?.response?.data?.message || "Unable to load recommendations right now.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchRecommendations();

        return () => {
            cancelled = true;
        };
    }, []);

    const visibleMovies = useMemo(() => movies.filter(Boolean), [movies]);

    return (
        <main className="filmly-recommendations-page">
            <Navbar />

            <div className="filmly-recommendations-glow filmly-recommendations-glow-left" />
            <div className="filmly-recommendations-glow filmly-recommendations-glow-right" />

            <section className="filmly-recommendations-shell">
                <header className="filmly-recommendations-header">
                    <div>
                        <span className="filmly-recommendations-eyebrow">For you</span>
                        <h1>Recommended movies</h1>
                        <p>Personalized picks powered by your profile embedding and FAISS similarity search.</p>
                    </div>

                    <div className="filmly-recommendations-count">
                        <strong>{visibleMovies.length}</strong>
                        <span>matches found</span>
                    </div>
                </header>

                {loading && <div className="filmly-recommendations-status">Loading recommendations...</div>}
                {message && !loading && <div className="filmly-recommendations-status error">{message}</div>}

                {!loading && !message && visibleMovies.length === 0 && (
                    <div className="filmly-recommendations-status">
                        No recommendations found yet. Add more reviews or rebuild the profile embedding.
                    </div>
                )}

                <section className="filmly-recommendations-grid" aria-label="Recommended movies">
                    {visibleMovies.map((movie, index) => (
                        <MovieCard
                            key={movie._id || movie.tmdbId || `${movie.title}-${index}`}
                            movie={movie}
                            index={index}
                            ctaLabel="Show"
                        />
                    ))}
                </section>
            </section>
        </main>
    );
}