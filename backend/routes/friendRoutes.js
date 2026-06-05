const express = require('express');
const friendModel = require('../models/friends');
const userModel = require('../models/users');
const userActivityModel = require('../models/userActivity');
const reviewModel = require('../models/reviews');
const wrapAsync = require('../utilities/wrapAsync.js');
const AppError = require('../utilities/AppError');
const { isLoggedIn } = require('../validators/authMiddlewares');

const router = express.Router();

//sending request to another user
router.post('/api/friends/request/:touserId', isLoggedIn, wrapAsync(async (req, res) => {
    const { touserId } = req.params;
    const fromUserId = req.user.id;

    if (fromUserId === touserId) {
        throw new AppError("You cannot send friend request to yourself", 400);
    }

    let isexisting = await userModel.exists({ _id: touserId });
    if (!isexisting) {
        throw new AppError("User not found", 404);
    }

    isexisting = await friendModel.exists({
        $or: [
            { fromUserId, toUserId: touserId },
            { fromUserId: touserId, toUserId: fromUserId }
        ]
    });
    if (isexisting) {
        throw new AppError("Friend request already sent", 400);
    }

    const friendRequest = await friendModel.create({
        fromUserId,
        toUserId: touserId
    });

    await userModel.findByIdAndUpdate(touserId, {
        $inc: { friendRequestsCount: 1 }
    });

    res.status(201).json({
        message: "Friend request sent successfully"
    });
}));

//accepting friend request

router.patch('/api/friends/accept/:requestId', isLoggedIn, wrapAsync(async (req, res) => {
    const { requestId } = req.params;
    const userId = req.user.id;

    const friendRequest = await friendModel.findById(requestId);

    if (!friendRequest) {
        throw new AppError("Friend request not found", 404);
    }

    if (friendRequest.toUserId.toString() !== userId) {
        throw new AppError("You are not authorized to accept this friend request", 403);
    }

    if (friendRequest.status !== 'pending') {
        throw new AppError("Friend request already processed", 400);
    }

    friendRequest.status = 'accepted';
    await friendRequest.save();
    await userModel.findByIdAndUpdate(friendRequest.fromUserId, {
        $inc: { friendCount: 1 }
    });
    await userModel.findByIdAndUpdate(friendRequest.toUserId, {
        $inc: { friendCount: 1, friendRequestsCount: -1 }
    });
    res.status(200).json({
        message: "Friend request accepted successfully"
    });

}));

//to reject friend request
router.post('/api/friends/reject/:requestId', isLoggedIn, wrapAsync(async (req, res) => {
    const { requestId } = req.params;
    const userId = req.user.id;

    const friendRequest = await friendModel.findById(requestId);

    if (!friendRequest) {
        throw new AppError("Friend request not found", 404);
    }

    if (friendRequest.toUserId.toString() !== userId) {
        throw new AppError("You are not authorized to reject this friend request", 403);
    }

    if (friendRequest.status !== 'pending') {
        throw new AppError("Friend request already processed", 400);
    }

    friendRequest.status = 'rejected';
    await friendRequest.save();
    await userModel.findByIdAndUpdate(friendRequest.toUserId, {
        $inc: { friendRequestsCount: -1 }
    });
    res.status(200).json({
        message: "Friend request rejected successfully"
    });
}));

//to see friends list of user
router.get('/api/friends', isLoggedIn, wrapAsync(async (req, res) => {
    const user = req.user.id;
    const friends = await friendModel.find({
        $or: [
            { fromUserId: user, status: 'accepted' },
            { toUserId: user, status: 'accepted' }
        ]
    }).populate('fromUserId', 'username email').populate('toUserId', 'username email');
    res.status(200).json({
        message: "Friends retrieved successfully",
        data: friends
    });
}));

//to see pending friend requests
router.get('/api/friends/requests', isLoggedIn, wrapAsync(async (req, res) => {
    const user = req.user.id;
    const friendRequests = await friendModel.find({
        toUserId: user,
        status: 'pending'
    }).populate('fromUserId', 'username');
    res.status(200).json({
        message: "Pending friend requests retrieved successfully",
        data: friendRequests
    });
}));

//to unfriend a user
router.delete('/api/friends/unfriend/:friendId', isLoggedIn, wrapAsync(async (req, res) => {
    const { friendId } = req.params;
    const userId = req.user.id;
    const friend = await friendModel.findById(friendId);

    if (!friend) {
        throw new AppError("Friend not found", 404);
    }
    if (friend.fromUserId.toString() !== userId && friend.toUserId.toString() !== userId) {
        throw new AppError("You are not authorized to unfriend this user", 403);
    }
    await friendModel.findByIdAndDelete(friendId);
    await userModel.findByIdAndUpdate(friend.fromUserId, {
        $inc: { friendCount: -1 }
    });
    await userModel.findByIdAndUpdate(friend.toUserId, {
        $inc: { friendCount: -1 }
    });
    res.status(200).json({
        message: "Friend removed successfully"
    });
}));

//to search an user
router.post('/api/friends/search', isLoggedIn, wrapAsync(async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.trim() === '') {
        throw new AppError("Invalid username", 400);
    }
    const currentUserId = req.user.id;
    const matchedUsers = await userModel.find({
        _id: { $ne: currentUserId },
        username: { $regex: username.trim(), $options: 'i' }
    }).select('username email friendCount');

    const matchedIds = matchedUsers.map((user) => user._id);
    const relations = await friendModel.find({
        $or: [
            { fromUserId: currentUserId, toUserId: { $in: matchedIds } },
            { fromUserId: { $in: matchedIds }, toUserId: currentUserId }
        ]
    }).select('fromUserId toUserId status');

    const relationMap = new Map();
    relations.forEach((relation) => {
        const otherId = relation.fromUserId.toString() === currentUserId
            ? relation.toUserId.toString()
            : relation.fromUserId.toString();
        relationMap.set(otherId, relation.status);
    });

    const users = matchedUsers.map((user) => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        friendCount: user.friendCount,
        status: relationMap.get(user._id.toString()) || 'none',
    }));
    res.status(200).json({
        message: "Users retrieved successfully",
        data: users
    });
}));

//to view the profile of one of their friend
// :friendId is the Friendship document _id (not the friend's user _id)
router.get('/api/friends/profile/:friendId', isLoggedIn, wrapAsync(async (req, res) => {
    const { friendId } = req.params;
    const userId = req.user.id;

    // Fetch the friendship document
    const friendship = await friendModel.findById(friendId);
    if (!friendship) {
        throw new AppError("Friend not found", 404);
    }
    if (friendship.fromUserId.toString() !== userId && friendship.toUserId.toString() !== userId) {
        throw new AppError("You are not authorized to view this friend's profile", 403);
    }

    // Resolve the actual friend's user ID from the friendship document
    const friendUserId = friendship.fromUserId.toString() === userId
        ? friendship.toUserId
        : friendship.fromUserId;

    // Fetch friend's user info with populated favorites and watchlater
    const friend_info = await userModel
        .findById(friendUserId)
        .populate('favorites')
        .populate('watchlater');

    if (!friend_info) {
        throw new AppError("Friend user not found", 404);
    }

    // Map favorites to plain objects so serialisation is predictable
    const favorites = (friend_info.favorites || [])
        .filter(Boolean)
        .map((movie) => ({
            _id:        movie._id,
            tmdbId:     movie.tmdbId,
            title:      movie.title,
            posterPath: movie.posterPath,
            overview:   movie.overview,
            genres:     movie.genres,
            releaseDate: movie.releaseDate,
        }));

    // Map watchlater the same way
    const watchlater = (friend_info.watchlater || [])
        .filter(Boolean)
        .map((movie) => ({
            _id:        movie._id,
            tmdbId:     movie.tmdbId,
            title:      movie.title,
            posterPath: movie.posterPath,
            overview:   movie.overview,
            genres:     movie.genres,
            releaseDate: movie.releaseDate,
        }));

    // Fetch friend's activity (most recent 10)
    const rawActivity = await userActivityModel
        .find({ userId: friendUserId })
        .sort({ _id: -1 })
        .limit(10);

    const friend_activity = rawActivity.map((entry) => ({
        _id:        entry._id,
        action:     entry.action,
        movieTitle: entry.movieTitle,
        posterPath: entry.posterPath,
        tmdbId:     entry.tmdbId,
        createdAt:  entry.createdAt || (entry._id && typeof entry._id.getTimestamp === 'function' ? entry._id.getTimestamp() : null),
    }));

    // Fetch friend's recent reviews — populate movieId to get title + poster
    const rawReviews = await reviewModel
        .find({ userId: friendUserId })
        .populate('movieId', 'title posterPath tmdbId genres')
        .sort({ _id: -1 })
        .limit(5);

    const recentreviews = rawReviews.map((review) => ({
        _id:        review._id,
        rating:     review.rating,
        comment:    review.comment,
        createdAt:  review.createdAt || (review._id && typeof review._id.getTimestamp === 'function' ? review._id.getTimestamp() : null),
        movieTitle: review.movieId?.title      || '',
        posterPath: review.movieId?.posterPath || '',
        tmdbId:     review.movieId?.tmdbId     || null,
        genres:     review.movieId?.genres     || [],
    }));

    res.json({
        success: true,
        message: "Friend profile retrieved successfully",
        data: {
            username:      friend_info.username,
            email:         friend_info.email,
            friendCount:   friend_info.friendCount,
            favorites,
            watchlater,
            friend_activity,
            recentreviews,
        }
    });
}));

module.exports = router;