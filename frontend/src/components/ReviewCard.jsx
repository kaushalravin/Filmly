import { useEffect, useRef, useState } from "react";
import "../styles/reviewCard.css";

const getAuthorId = (review) => review?.userId?._id || review?.userId?.id || review?.userId || "";

export default function ReviewCard({ review, isOwner = false, onEdit, onDelete }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const rating = Number(review?.rating ?? 0);
    const username = review?.userId?.username || review?.username || "Anonymous";
    const content = review?.comment || review?.content || "No review content provided.";

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const handleEdit = () => {
        setMenuOpen(false);
        if (onEdit) onEdit(review);
    };

    const handleDelete = () => {
        setMenuOpen(false);
        if (onDelete) onDelete(review);
    };

    return (
        <article className="filmly-review-card">
            <div className="filmly-review-card-top" ref={menuRef}>
                <div className="filmly-review-card-author">
                    <span className="filmly-review-card-name">{username}</span>
                    <span className="filmly-review-card-rating">{rating}/10</span>
                </div>

                {isOwner && (
                    <div className="filmly-review-card-menu-wrap">
                        <button
                            type="button"
                            className="filmly-review-card-menu-button"
                            onClick={() => setMenuOpen((prev) => !prev)}
                            aria-label="Review options"
                            aria-expanded={menuOpen}
                        >
                            <span />
                            <span />
                            <span />
                        </button>

                        {menuOpen && (
                            <div className="filmly-review-card-menu" role="menu" aria-label="Review actions">
                                <button type="button" className="filmly-review-card-menu-item" onClick={handleEdit} role="menuitem">
                                    Update
                                </button>
                                <button type="button" className="filmly-review-card-menu-item danger" onClick={handleDelete} role="menuitem">
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <p className="filmly-review-card-content">{content}</p>
        </article>
    );
}

export { getAuthorId };