const express=require('express');
const reviewModel=require('../models/reviews');
const movieModel=require('../models/movies');
const wrapAsync=require('../utilities/wrapAsync.js');
const AppError=require('../utilities/AppError');
const { isLoggedIn } = require('../validators/authMiddlewares');
const { validateReview } = require('../validators/reviewMiddlewares');

const router=express.Router();

router.post('/api/:tmdbId/reviews',isLoggedIn,validateReview,wrapAsync(async(req,res)=>{
    const {rating,content} =req.body;
    const {tmdbId}=req.params;

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

    res.json({
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
module.exports = router;
