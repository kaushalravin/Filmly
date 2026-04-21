import { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "./Navbar.jsx";
import RecentCard from "./RecentCard.jsx";
import "../styles/recents.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function Recents() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchRecents() {
      try {
        setLoading(true);
        setMsg("");
        const response = await axios.get(`${VITE_BACKEND_BASE}/api/recent`);

        if (!cancelled) {
          setReviews(response?.data?.data || []);
        }
      } catch (error) {
        console.error("Error fetching recent reviews:", error);
        if (!cancelled) {
          setMsg("Failed to fetch recent reviews. Please try again later.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRecents();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="filmly-recents-page">
      <Navbar />
      <div className="filmly-recents-glow filmly-recents-glow-left" />
      <div className="filmly-recents-glow filmly-recents-glow-right" />

      <section className="filmly-recents-shell">
        <section className="filmly-recents-head">
          <div>
            <span className="filmly-recents-eyebrow">Your activity</span>
            <h1>Recent watches.</h1>
            <p>Movies you've reviewed and rated recently.</p>
          </div>
        </section>

        {msg && <div className="filmly-recents-status error">{msg}</div>}
        {loading && <div className="filmly-recents-status">Loading recent reviews...</div>}

        {!loading && !msg && reviews.length === 0 && (
          <div className="filmly-recents-status">No recent reviews yet. Start watching and reviewing movies!</div>
        )}

        <section className="filmly-recents-results">
          <div className="filmly-recents-results-head">
            <h2>Reviews</h2>
            {!loading && !msg && <span>{reviews.length} found</span>}
          </div>

          <div className="filmly-recents-grid">
            {reviews.map((review, index) => (
              <RecentCard
                key={`${review._id || review.id || index}`}
                review={review}
                index={index}
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
