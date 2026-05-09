const express=require('express');
const axios=require('axios');
const reviewModel=require('../models/reviews');
const movieModel=require('../models/movies');
const friendModel=require('../models/friends');
const wrapAsync=require('../utilities/wrapAsync.js');
const AppError=require('../utilities/AppError');
const rebuildUserProfile=require('../utilities/rebuildUserProfile');
const { isLoggedIn } = require('../validators/authMiddlewares');
const { validateReview } = require('../validators/reviewMiddlewares');

const router=express.Router();
const path=require('path');



router.post('/api/:tmdbId/reviews',isLoggedIn,validateReview,wrapAsync(async(req,res)=>{
    const {rating,content} =req.body;
    const {tmdbId}=req.params;

    console.log('[reviews] create request received for tmdbId:', tmdbId);
    
    const movie = await movieModel.findOne({tmdbId:tmdbId});
    
    if(!movie){
        throw new AppError("Movie not found",404);
    }

    const review = await reviewModel.create({
        userId:req.user.id,
        movieId:movie._id,
        rating,
        comment:content,
    });

    const aiServiceUrl = process.env.AI_SERVICE_URL;
    if (!aiServiceUrl) {
        throw new AppError('AI service URL is not configured', 500);
    }

    console.log('[reviews] sending text to AI service:', `${aiServiceUrl}/analyze`);

    let result;
    try {
        result = await axios.post(`${aiServiceUrl}/analyze`, {
            text: content
        });
    } catch (error) {
        console.error('[reviews] AI service request failed:', error?.response?.data || error.message);
        throw new AppError('Failed to generate embedding', 502);
    }

    if(result && result.data && result.data.embedding){
        review.embedding=result.data.embedding;
        await review.save();
        console.log('Embedding generated and saved for review:', review._id.toString());
        // Rebuild user profile embedding
        await rebuildUserProfile(req.user.id);
    }else{
        console.log('embeddings not generated');
        return res.json({
            success:false,
            message:"Review added but failed to generate embedding"
        })
    }

    return res.json({
        success:true,
        message:"Review added successfully"
    });
}));

router.get('/api/:tmdbId/reviews',wrapAsync(async(req,res)=>{
    const {tmdbId}=req.params;
    const movie=await movieModel.findOne({tmdbId:tmdbId});

    if(!movie){
        throw new AppError("Movie not found",404);
    }   

    const reviews=await reviewModel.find({movieId:movie._id}).populate('userId','username');

    res.json({
        success:true,
        data:reviews
    });
}));

router.patch('/api/reviews/:reviewId',isLoggedIn,validateReview,wrapAsync(async(req,res)=>{
    const {reviewId}=req.params;
    const {rating,content}=req.body;
    const review = await reviewModel.findById(reviewId);

    if(!review){
        throw new AppError("Review not found",404);
    }

    if (review.userId.toString() !== req.user.id) {
        throw new AppError("You are not authorized", 403);
    }
    

    const updatedReview = await reviewModel.findByIdAndUpdate(
        reviewId,
        {rating,comment:content},
        {new:true}
    ).populate('userId','username');
    
    // Rebuild user profile embedding
    await rebuildUserProfile(req.user.id);

    res.json({
        success:true,
        data:updatedReview,
        message:"Review updated successfully"
    });
}));

router.delete('/api/reviews/:reviewId',isLoggedIn,wrapAsync(async(req,res)=>{
    const {reviewId}=req.params;
    const review=await reviewModel.findById(reviewId);

    if(!review){
        throw new AppError("Review not found",404);
    }

    if (review.userId.toString() !== req.user.id) {
        throw new AppError("You are not authorized", 403);
    }   

    await reviewModel.findByIdAndDelete(reviewId);

    await rebuildUserProfile(req.user.id);

    res.json({
        success:true,
        message:"Review deleted successfully"
    });
}))

router.get('/api/recent',isLoggedIn,wrapAsync(async(req,res)=>{
    let user=req.user;
    const reviews=await reviewModel.find({userId:user.id})
        .populate('movieId','tmdbId title posterPath releaseDate overview genres')
        .populate('userId','username')
        .sort({createdAt:-1})
        .limit(10);

    res.json({
        success:true,
        data:reviews
    });
}))

// Get all movies watched by friends
router.get('/api/friends/movies',isLoggedIn,wrapAsync(async(req,res)=>{
    const userId = req.user.id;
    
    // Get all accepted friends
    const friends = await friendModel.find({
        $or:[
            {fromUserId:userId,status:'accepted'},
            {toUserId:userId,status:'accepted'}
        ]
    });

    // Extract friend IDs
    const friendIds = friends.map(friend => {
        return friend.fromUserId.toString() === userId 
            ? friend.toUserId.toString() 
            : friend.fromUserId.toString();
    });

    if(friendIds.length === 0){
        return res.json({
            success:true,
            message:"No friends yet",
            data:[]
        });
    }

    // Get all reviews from friends
    const reviews = await reviewModel.find({userId:{$in:friendIds}})
        .populate('movieId','tmdbId title posterPath releaseDate overview genres')
        .populate('userId','username')
        .sort({createdAt:-1});

    // Group movies by friend (optional - for better UX)
    const moviesByFriend = {};
    reviews.forEach(review => {
        const friendUsername = review.userId.username;
        if(!moviesByFriend[friendUsername]){
            moviesByFriend[friendUsername] = [];
        }
        moviesByFriend[friendUsername].push({
            movieId:review.movieId._id,
            tmdbId:review.movieId.tmdbId,
            title:review.movieId.title,
            posterPath:review.movieId.posterPath,
            overview:review.movieId.overview,
            genres:review.movieId.genres,
            rating:review.rating,
            comment:review.comment
        });
    });

    res.json({
        success:true,
        data:moviesByFriend,
        totalMovies:reviews.length
    });
}))

module.exports = router;
