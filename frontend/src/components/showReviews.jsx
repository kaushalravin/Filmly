import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ReviewCard, { getAuthorId } from "./ReviewCard.jsx";
import "../styles/reviewCard.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";
const PAGE_LIMIT = 5;

export default function ShowReviews({ tmdbId, refreshKey = 0, onEditReview }) {
    const [reviews, setReviews]           = useState([]);
    const [loading, setLoading]           = useState(true);
    const [loadingMore, setLoadingMore]   = useState(false);
    const [message, setMessage]           = useState("");
    const [currentUserId, setCurrentUserId] = useState("");
    const [page, setPage]                 = useState(1);
    const [totalPages, setTotalPages]     = useState(1);

    /* ── Initial load (and when movie / refreshKey changes) ──────────── */
    useEffect(() => {
        let cancelled = false;

        const fetchReviews = async () => {
            try {
                setLoading(true);
                setMessage("");
                setPage(1);
                setReviews([]);

                const [reviewsResponse, meResponse] = await Promise.all([
                    axios.get(
                        `${VITE_BACKEND_BASE}/api/${tmdbId}/reviews?page=1&limit=${PAGE_LIMIT}`
                    ),
                    axios.get(`${VITE_BACKEND_BASE}/api/me`).catch(() => null),
                ]);

                if (cancelled) return;

                setReviews(Array.isArray(reviewsResponse.data?.data) ? reviewsResponse.data.data : []);
                setTotalPages(reviewsResponse.data?.totalPages ?? 1);
                setCurrentUserId(
                    meResponse?.data?.data?.user?.id ||
                    meResponse?.data?.data?.user?._id ||
                    ""
                );
            } catch (error) {
                if (!cancelled) {
                    setMessage("Error fetching reviews");
                    setReviews([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchReviews();
        return () => { cancelled = true; };
    }, [tmdbId, refreshKey]);

    /* ── Load next page ──────────────────────────────────────────────── */
    const handleLoadMore = async () => {
        const nextPage = page + 1;
        try {
            setLoadingMore(true);
            const res = await axios.get(
                `${VITE_BACKEND_BASE}/api/${tmdbId}/reviews?page=${nextPage}&limit=${PAGE_LIMIT}`
            );
            const newReviews = Array.isArray(res.data?.data) ? res.data.data : [];
            setReviews((prev) => [...prev, ...newReviews]);
            setPage(nextPage);
            setTotalPages(res.data?.totalPages ?? totalPages);
        } catch (error) {
            console.error("Error loading more reviews:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    /* ── Helpers ─────────────────────────────────────────────────────── */
    const normalizedReviews = useMemo(
        () => reviews.map((review) => ({
            ...review,
            isOwner: Boolean(currentUserId) && currentUserId === getAuthorId(review),
        })),
        [currentUserId, reviews]
    );

    const updateReviewInState = (reviewId, updatedFields) => {
        setReviews((curr) =>
            curr.map((r) =>
                String(r?._id || r?.id) !== String(reviewId) ? r : { ...r, ...updatedFields }
            )
        );
    };

    const removeReviewFromState = (reviewId) => {
        setReviews((curr) =>
            curr.filter((r) => String(r?._id || r?.id) !== String(reviewId))
        );
    };

    const handleEdit   = (review) => { if (onEditReview) onEditReview(review); };
    const handleDelete = async (review) => {
        const reviewId = review?._id || review?.id;
        if (!reviewId) return;
        if (!window.confirm("Delete this review?")) return;
        try {
            const response = await axios.delete(`${VITE_BACKEND_BASE}/api/reviews/${reviewId}`);
            if (response.data?.success) removeReviewFromState(reviewId);
        } catch (error) {
            console.error("Error deleting review:", error);
            window.alert(error?.response?.data?.message || "Failed to delete review");
        }
    };

    const hasMore = page < totalPages;

    return (
        <section className="filmly-review-list-section">
            <div className="filmly-review-list-header">
                <span className="filmly-review-eyebrow">Posted reviews</span>
                <h2>Community takes</h2>
            </div>

            {loading  && <div className="filmly-review-status">Loading reviews...</div>}
            {!loading && message && <div className="filmly-review-status">{message}</div>}
            {!loading && !message && normalizedReviews.length === 0 && (
                <div className="filmly-review-status">No reviews yet. Be the first to post one.</div>
            )}

            {!loading && normalizedReviews.length > 0 && (
                <div className="filmly-review-list">
                    {normalizedReviews.map((review) => (
                        <ReviewCard
                            key={review._id || review.id}
                            review={review}
                            isOwner={review.isOwner}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* ── Load more button ── */}
            {!loading && hasMore && (
                <div className="filmly-load-more-row">
                    <button
                        type="button"
                        className="filmly-load-more-btn"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                    >
                        {loadingMore ? "Loading…" : `Load more reviews (${page}/${totalPages})`}
                    </button>
                </div>
            )}
        </section>
    );
}