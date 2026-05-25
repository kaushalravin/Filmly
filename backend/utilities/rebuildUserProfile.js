const reviewModel = require("../models/reviews");
const userModel = require("../models/users");
const movieModel = require("../models/movies");

/**
 * Rebuilds the user's profile embedding by computing the average of all their review embeddings
 * @param {string} userId - The ID of the user
 * @returns {Promise<Object>} Updated user object with new profile_embedding
 */
async function rebuildUserProfile(userId) {
    try {
        const user = await userModel.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }

        const reviews = await reviewModel.find({ userId });
        const favoriteMovieIds = Array.isArray(user.favorites) ? user.favorites : [];
        const watchLaterMovieIds = Array.isArray(user.watchlater) ? user.watchlater : [];

        const favoriteMovies = favoriteMovieIds.length > 0
            ? await movieModel.find({ _id: { $in: favoriteMovieIds } })
            : [];
        const watchLaterMovies = watchLaterMovieIds.length > 0
            ? await movieModel.find({ _id: { $in: watchLaterMovieIds } })
            : [];

        const weightedVectors = [];

        // Reviews contribute weight 1.
        for (const review of reviews) {
            if (!review.embedding || review.embedding.length === 0) {
                continue;
            }

            weightedVectors.push({ embedding: review.embedding, weight: 1 });
        }

        // Favorites contribute weight 2 using the movie embedding.
        for (const movie of favoriteMovies) {
            if (!movie.embedding || movie.embedding.length === 0) {
                continue;
            }

            weightedVectors.push({ embedding: movie.embedding, weight: 2 });
        }

        // Watch later contributes half weight using the movie embedding.
        for (const movie of watchLaterMovies) {
            if (!movie.embedding || movie.embedding.length === 0) {
                continue;
            }

            weightedVectors.push({ embedding: movie.embedding, weight: 0.5 });
        }

        if (weightedVectors.length === 0) {
            user.profile_embedding = [];
            await user.save();
            console.log(`No usable embeddings found for user ${userId}. Profile embedding set to empty array.`);
            return user;
        }

        const embeddingDimension = weightedVectors[0].embedding.length;
        const profileEmbedding = new Array(embeddingDimension).fill(0);
        let totalWeight = 0;

        for (const vector of weightedVectors) {
            if (vector.embedding.length !== embeddingDimension) {
                continue;
            }

            for (let i = 0; i < embeddingDimension; i++) {
                profileEmbedding[i] += vector.embedding[i] * vector.weight;
            }
            totalWeight += vector.weight;
        }

        if (totalWeight === 0) {
            user.profile_embedding = [];
            await user.save();
            console.log(`No compatible embeddings found for user ${userId}. Profile embedding set to empty array.`);
            return user;
        }

        for (let i = 0; i < embeddingDimension; i++) {
            profileEmbedding[i] /= totalWeight;
        }

        user.profile_embedding = profileEmbedding;
        await user.save();
        console.log(
            `Profile embedding computed and saved for user ${userId} (${reviews.length} reviews, ${favoriteMovies.length} favorites, ${watchLaterMovies.length} watch later; favorites weighted 2x, watch later weighted 0.5x).`
        );
        return user;
    } catch (error) {
        console.error(`Error rebuilding user profile for user ${userId}:`, error.message);
        throw error;
    }
}

module.exports = rebuildUserProfile;