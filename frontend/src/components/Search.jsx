import axios from "axios";
import { useState } from "react";
import Navbar from "./Navbar.jsx";
import MovieCard from "./MovieCard.jsx";
import "../styles/Search.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function Search() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = searchTerm.trim();

    if (!query) {
      setHasSearched(false);
      setSearchResults([]);
      setMessage("Type a movie title to search.");
      return;
    }

    try {
      setLoading(true);
      setHasSearched(true);
      setMessage("");

      const response = await axios.get(`${VITE_BACKEND_BASE}/api/search`, {
        params: {
          searchItem: query,
        },
      });

      setSearchResults(response?.data?.data || []);
    } catch (error) {
      console.error("Error fetching search results:", error);
      setSearchResults([]);
      setMessage("Failed to fetch search results. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="filmly-search-page">
      <Navbar />
      <div className="filmly-search-glow filmly-search-glow-left" />
      <div className="filmly-search-glow filmly-search-glow-right" />

      <section className="filmly-search-shell">
        <section className="filmly-search-head">
          <div>
            <span className="filmly-search-eyebrow">Discover</span>
            <h1>Search movies.</h1>
            <p>Find titles and explore details instantly.</p>
          </div>

          <form className="filmly-search-form" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Try Dune, Interstellar, Parasite..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search movies"
            />
            <button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </section>

        {message && <div className="filmly-search-status error">{message}</div>}
        {loading && <div className="filmly-search-status">Loading search results...</div>}

        {!loading && hasSearched && !message && searchResults.length === 0 && (
          <div className="filmly-search-status">No movies found. Try another keyword.</div>
        )}

        <section className="filmly-search-results">
          <div className="filmly-search-results-head">
            <h2>Results</h2>
            {hasSearched && !loading && <span>{searchResults.length} found</span>}
          </div>

          <div className="filmly-search-grid">
            {searchResults.map((movie, index) => (
              <MovieCard
                key={`${movie.tmdbId || movie.id || movie.title || "movie"}-${index}`}
                movie={movie}
                index={index}
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
