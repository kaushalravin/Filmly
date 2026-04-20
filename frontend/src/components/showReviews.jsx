import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ReviewCard, { getAuthorId } from "./ReviewCard.jsx";
import "../styles/reviewCard.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function ShowReviews({ tmdbId, refreshKey = 0, onEditReview }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [currentUserId, setCurrentUserId] = useState("");

    useEffect(() => {
        let cancelled = false;

        const fetchReviews = async () => {
            try {
                setLoading(true);
                setMessage("");

                const [reviewsResponse, meResponse] = await Promise.all([
                    axios.get(`${VITE_BACKEND_BASE}/api/${tmdbId}/reviews`),
                    axios.get(`${VITE_BACKEND_BASE}/api/me`).catch(() => null),
                ]);

                if (cancelled) return;

                setReviews(Array.isArray(reviewsResponse.data?.data) ? reviewsResponse.data.data : []);
                setCurrentUserId(meResponse?.data?.data?.user?.id || meResponse?.data?.data?.user?._id || "");
            } catch (error) {
                if (!cancelled) {
                    setMessage("Error fetching reviews");
                    setReviews([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchReviews();

        return () => {
            cancelled = true;
        };
    }, [tmdbId, refreshKey]);

    const normalizedReviews = useMemo(() => reviews.map((review) => ({
        ...review,
        isOwner: Boolean(currentUserId) && currentUserId === getAuthorId(review),
    })), [currentUserId, reviews]);

    const updateReviewInState = (reviewId, updatedFields) => {
        setReviews((currentReviews) => currentReviews.map((review) => {
            const currentReviewId = review?._id || review?.id;
            if (String(currentReviewId) !== String(reviewId)) {
                return review;
            }

            return {
                ...review,
                ...updatedFields,
            };
        }));
    };

    const removeReviewFromState = (reviewId) => {
        setReviews((currentReviews) => currentReviews.filter((review) => String(review?._id || review?.id) !== String(reviewId)));
    };

    const handleEdit = async (review) => {
        if (onEditReview) {
            onEditReview(review);
        }
    };

    const handleDelete = async (review) => {
        const reviewId = review?._id || review?.id;
        if (!reviewId) return;

        const shouldDelete = window.confirm("Delete this review?");
        if (!shouldDelete) return;

        try {
            const response = await axios.delete(`${VITE_BACKEND_BASE}/api/reviews/${reviewId}`);

            if (response.data?.success) {
                removeReviewFromState(reviewId);
            }
        } catch (error) {
            console.error("Error deleting review:", error);
            window.alert(error?.response?.data?.message || "Failed to delete review");
        }
    };

    return (
        <section className="filmly-review-list-section">
            <div className="filmly-review-list-header">
                <span className="filmly-review-eyebrow">Posted reviews</span>
                <h2>Community takes</h2>
            </div>

            {loading && <div className="filmly-review-status">Loading reviews...</div>}
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
        </section>
    );

}