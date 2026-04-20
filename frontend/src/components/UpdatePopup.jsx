import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "../styles/UpdatePopup.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function UpdatePopup({ review, onClose, onSave }) {
    const [rating, setRating] = useState(Number(review?.rating ?? 8));
    const [content, setContent] = useState(String(review?.comment || review?.content || ""));
    const [message, setMessage] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape" && onClose) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    const ratingLabel = useMemo(() => {
        if (rating >= 9) return "Outstanding";
        if (rating >= 8) return "Excellent";
        if (rating >= 6) return "Good";
        if (rating >= 4) return "Mixed";
        return "Not for me";
    }, [rating]);

    const reviewId = review?._id || review?.id;

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!reviewId) {
            setMessage("Missing review id.");
            return;
        }

        if (!content.trim()) {
            setMessage("Review content is required.");
            return;
        }

        try {
            setIsSaving(true);
            setMessage("");

            const response = await axios.patch(`${VITE_BACKEND_BASE}/api/reviews/${reviewId}`, {
                rating: Number(rating),
                content: content.trim(),
            });

            if (response.data?.success) {
                if (onSave) {
                    onSave(response.data.data || {
                        ...review,
                        rating: Number(rating),
                        comment: content.trim(),
                    });
                }
                return;
            }

            setMessage("Failed to update review");
        } catch (error) {
            console.error("Error updating review:", error);
            setMessage(error?.response?.data?.message || "Failed to update review");
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackdropClick = (event) => {
        if (event.target === event.currentTarget && onClose) {
            onClose();
        }
    };

    return (
        <div className="filmly-update-popup-backdrop" onClick={handleBackdropClick} role="presentation">
            <section className="filmly-update-popup" aria-modal="true" role="dialog" aria-labelledby="update-review-title">
                <div className="filmly-update-popup-header">
                    <div>
                        <span className="filmly-update-popup-eyebrow">Edit review</span>
                        <h2 id="update-review-title">Update your review</h2>
                    </div>

                    <button type="button" className="filmly-update-popup-close" onClick={onClose} aria-label="Close update dialog">
                        ×
                    </button>
                </div>

                {message && <div className="filmly-update-popup-status">{message}</div>}

                <form className="filmly-update-popup-form" onSubmit={handleSubmit}>
                    <label className="filmly-update-popup-label" htmlFor="update-rating">
                        Rating <span>{ratingLabel}</span>
                    </label>

                    <input
                        id="update-rating"
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={rating}
                        onChange={(event) => setRating(Number(event.target.value))}
                        className="filmly-update-popup-range"
                    />

                    <div className="filmly-update-popup-rating-row">
                        <span>1</span>
                        <strong>{rating}</strong>
                        <span>10</span>
                    </div>

                    <label className="filmly-update-popup-label" htmlFor="update-content">
                        Review
                    </label>

                    <textarea
                        id="update-content"
                        rows="6"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        className="filmly-update-popup-textarea"
                    />

                    <div className="filmly-update-popup-actions">
                        <button type="button" className="filmly-update-popup-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="filmly-update-popup-primary" disabled={isSaving}>
                            {isSaving ? "Saving..." : "Update review"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}