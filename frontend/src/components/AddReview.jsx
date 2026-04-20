import { useMemo, useState } from "react";
import axios from "axios";
import "../styles/AddReview.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function AddReview({ tmdbId, onReviewAdded }) {
    const [formData, setFormData] = useState({ rating: 8, content: "" });
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const ratingLabel = useMemo(() => {
        const rating = Number(formData.rating || 0);
        if (rating >= 9) return "Outstanding";
        if (rating >= 8) return "Excellent";
        if (rating >= 6) return "Good";
        if (rating >= 4) return "Mixed";
        return "Not for me";
    }, [formData.rating]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((old) => ({
            ...old,
            [name]: name === "rating" ? Number(value) : value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!tmdbId) {
            setMessage("Missing movie id.");
            return;
        }

        if (!formData.content.trim()) {
            setMessage("Please write a review before submitting.");
            return;
        }

        try {
            setIsSubmitting(true);
            setMessage("");

            const response = await axios.post(`${VITE_BACKEND_BASE}/api/${tmdbId}/reviews`, {
                rating: Number(formData.rating),
                content: formData.content.trim(),
            });

            if (response.data?.success) {
                setMessage("Review added successfully");
                setFormData({ rating: 8, content: "" });
                if (onReviewAdded) {
                    onReviewAdded();
                }
            } else {
                setMessage("Failed to add review");
            }
        } catch (error) {
            console.error("Error adding review:", error);
            setMessage(error?.response?.data?.message || "An error occurred while adding the review");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="filmly-review-section">
            <div className="filmly-review-header">
                <div>
                    <span className="filmly-review-eyebrow">Reviews</span>
                    <h2>Add your review</h2>
                </div>
                <p>Share your review with the community</p>
            </div>

            {message && (
                <div className="filmly-review-status" role="status">
                    {message}
                </div>
            )}

            <form className="filmly-review-form" onSubmit={handleSubmit}>
                <div className="filmly-review-range-wrap">
                    <label className="filmly-review-label" htmlFor="rating">
                        Rating <span>{ratingLabel}</span>
                    </label>
                    <input
                        type="range"
                        id="rating"
                        name="rating"
                        min="1"
                        max="10"
                        step="1"
                        value={formData.rating}
                        onChange={handleChange}
                        className="filmly-review-range"
                    />

                    <div className="filmly-review-rating-row">
                        <span>1</span>
                        <strong>{formData.rating}</strong>
                        <span>10</span>
                    </div>
                </div>

                <label className="filmly-review-label" htmlFor="content">
                    Review
                </label>
                <textarea
                    id="content"
                    name="content"
                    rows="5"
                    placeholder="Write what you liked, what missed, and whether you'd recommend it."
                    value={formData.content}
                    onChange={handleChange}
                    className="filmly-review-textarea"
                />

                <button type="submit" className="filmly-review-submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit review"}
                </button>
            </form>
        </section>
    );
}