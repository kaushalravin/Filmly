const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    action: {
        type: String,
        enum: ['favorite_added', 'favorite_removed', 'watchlater_added', 'watchlater_removed'],
        required: true,
    },
    movieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Movie',
        required: true,
    },
    movieTitle: {
        type: String,
        default: '',
    },
    posterPath: {
        type: String,
        default: '',
    },
    tmdbId: {
        type: Number,
        default: null,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('UserActivity', userActivitySchema);