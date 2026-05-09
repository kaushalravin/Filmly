const reviewModel = require("../models/reviews");
const userModel = require("../models/users");

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

        // Fetch all reviews for this user with their embeddings
        const reviews = await reviewModel.find({ userId: userId });

        if (reviews.length === 0) {
            // If user has no reviews, set profile_embedding to empty array
            user.profile_embedding = [];
            await user.save();
            console.log(`No reviews found for user ${userId}. Profile embedding set to empty array.`);
            return user;
        }

        // Filter reviews that have embeddings
        const reviewsWithEmbeddings = reviews.filter(review => review.embedding && review.embedding.length > 0);

        if (reviewsWithEmbeddings.length === 0) {
            // If no reviews have embeddings, set profile_embedding to empty array
            user.profile_embedding = [];
            await user.save();
            console.log(`No reviews with embeddings found for user ${userId}. Profile embedding set to empty array.`);
            return user;
        }

        // Compute the average embedding
        const embeddingDimension = reviewsWithEmbeddings[0].embedding.length;
        const averageEmbedding = new Array(embeddingDimension).fill(0);

        // Sum all embeddings
        for (let review of reviewsWithEmbeddings) {
            for (let i = 0; i < embeddingDimension; i++) {
                averageEmbedding[i] += review.embedding[i];
            }
        }

        // Divide by the number of reviews to get average
        for (let i = 0; i < embeddingDimension; i++) {
            averageEmbedding[i] /= reviewsWithEmbeddings.length;
        }

        // Update the user's profile_embedding
        user.profile_embedding = averageEmbedding;
        await user.save();
        console.log(`Profile embedding computed and saved for user ${userId} (${reviewsWithEmbeddings.length} reviews used).`);

        console.log(`Profile embedding computed and saved for user ${userId} (${reviewsWithEmbeddings.length} reviews used).`);
        return user;
    } catch (error) {
        console.error(`Error rebuilding user profile for user ${userId}:`, error.message);
        throw error;
    }
}

module.exports = rebuildUserProfile;