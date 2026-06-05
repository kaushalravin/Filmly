const express = require('express');
const axios = require('axios');
const movieModel = require('../models/movies');
const reviewModel = require('../models/reviews');
const userActivityModel = require('../models/userActivity');
const userModel = require('../models/users');
const wrapAsync = require('../utilities/wrapAsync.js');
const AppError = require('../utilities/AppError');
const isLoggedIn = require('../validators/authMiddlewares').isLoggedIn;
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const getMongoIdString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value._id) return value._id.toString();
    return value.toString();
};

const formatDateInTimeZone = (date, timeZone) => {
    try {
        return date.toLocaleString('en-US', { timeZone });
    } catch (error) {
        return date.toISOString();
    }
};

const truncate = (text, length = 180) => {
    if (!text) return '';
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

const buildTopGenres = (movies) => {
    const genreCounts = new Map();

    for (const movie of movies) {
        if (!movie || !Array.isArray(movie.genres)) continue;
        for (const genre of movie.genres) {
            const key = String(genre);
            genreCounts.set(key, (genreCounts.get(key) || 0) + 1);
        }
    }

    return Array.from(genreCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([genre, count]) => ({ genre, count }));
};

const summarizeTasteWithGemini = async ({ username, topGenres, averageRating, favoriteMovies, recentReviews }) => {
    if (!GEMINI_API_KEY) {
        return `${username} tends to favor ${topGenres.map((entry) => entry.genre).join(', ') || 'varied movies'} and averages ${averageRating.toFixed(1)}/10 across reviews.`;
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const timeZone = process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const today = formatDateInTimeZone(new Date(Date.now()), timeZone);

    const prompt = `
You are writing a short taste summary for a movie dashboard.

Rules:
1. Return only ONE sentence.
2. Keep it under 25 words.
3. Use only the provided data.
4. Mention the user's dominant movie taste, tone, or genre pattern.
5. Do not mention uncertainty.

Today: ${today}

User: ${username}
Top genres: ${JSON.stringify(topGenres)}
Average rating: ${averageRating.toFixed(1)}
Favorite movies: ${JSON.stringify(favoriteMovies)}
Recent reviews: ${JSON.stringify(recentReviews)}
`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        return text.replace(/\s+/g, ' ');
    } catch (error) {
        const message = error?.message || String(error);
        console.error('[dashboard-summary] Gemini taste summary failed:', message);
        return `${username} tends to favor ${topGenres.map((entry) => entry.genre).join(', ') || 'varied movies'} and averages ${averageRating.toFixed(1)}/10 across reviews.`;
    }
};

router.get('/api/dashboard-summary', isLoggedIn, wrapAsync(async (req, res) => {
    const user = await userModel.findById(req.user.id).populate('favorites').populate('watchlater');

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const reviews = await reviewModel.find({ userId: req.user.id })
        .populate('movieId', 'tmdbId title posterPath releaseDate overview genres popularity')
        .sort({ _id: -1 });

    const allReviewedMovies = reviews
        .map((review) => review.movieId)
        .filter(Boolean);

    const favoriteMovies = (Array.isArray(user.favorites) ? user.favorites : [])
        .map((movie) => {
            const linkedReview = reviews.find((review) => getMongoIdString(review.movieId) === getMongoIdString(movie));
            return {
                id: getMongoIdString(movie),
                tmdbId: movie.tmdbId,
                title: movie.title,
                posterPath: movie.posterPath,
                genres: Array.isArray(movie.genres) ? movie.genres.slice(0, 3) : [],
                rating: linkedReview?.rating ?? null,
                releaseDate: movie.releaseDate,
            };
        })
        .sort((left, right) => {
            const leftRating = typeof left.rating === 'number' ? left.rating : -1;
            const rightRating = typeof right.rating === 'number' ? right.rating : -1;
            return rightRating - leftRating;
        })
        .slice(0, 5);

    const recentReviews = reviews.slice(0, 10).map((review) => ({
        reviewId: review._id,
        movieId: review.movieId?._id,
        tmdbId: review.movieId?.tmdbId,
        movieTitle: review.movieId?.title,
        genres: Array.isArray(review.movieId?.genres) ? review.movieId.genres.slice(0, 3) : [],
        rating: review.rating,
        comment: truncate(review.comment, 160),
        posterPath: review.movieId?.posterPath,
        createdAt: review.createdAt,
    }));

    const activityEntries = await userActivityModel.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(10);

    const recentActivity = activityEntries.map((entry) => ({
        id: entry._id,
        action: entry.action,
        movieId: entry.movieId,
        movieTitle: entry.movieTitle,
        posterPath: entry.posterPath,
        tmdbId: entry.tmdbId,
        createdAt: entry.createdAt,
    }));

    const topGenres = buildTopGenres([
        ...favoriteMovies,
        ...allReviewedMovies,
    ]);

    const averageRating = reviews.length > 0
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
        : 0;

    const tasteSummary = await summarizeTasteWithGemini({
        username: user.username,
        topGenres,
        averageRating,
        favoriteMovies: favoriteMovies.map((movie) => ({
            title: movie.title,
            rating: movie.rating,
            genres: movie.genres,
        })),
        recentReviews: recentReviews.slice(0, 5).map((review) => ({
            movieTitle: review.movieTitle,
            rating: review.rating,
            genres: review.genres,
        })),
    });

    res.json({
        success: true,
        data: {
            username: user.username,
            topGenres,
            averageRating: Number(averageRating.toFixed(2)),
            favoriteMovies,
            recentReviews,
            recentActivity,
            tasteSummary,
            totals: {
                favorites: Array.isArray(user.favorites) ? user.favorites.length : 0,
                watchlater: Array.isArray(user.watchlater) ? user.watchlater.length : 0,
                reviews: reviews.length,
            },
            generatedAt: new Date().toISOString(),
        },
    });
}));

module.exports = router;