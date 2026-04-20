const express=require('express');
const reviewModel=require('../models/reviews');
const movieModel=require('../models/movies');
const wrapAsync=require('../utilities/wrapAsync');
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
}))

module.exports = router;
