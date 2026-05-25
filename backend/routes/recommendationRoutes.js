const express=require('express');
const axios=require('axios');
const movieModel=require('../models/movies');
const userModel=require('../models/users');
const reviewModel=require('../models/reviews');
const wrapAsync=require('../utilities/wrapAsync.js');
const AppError=require('../utilities/AppError');
const isLoggedIn=require('../validators/authMiddlewares').isLoggedIn;


const router=express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
if (!AI_SERVICE_URL) {
    throw new Error('AI service URL is not configured in backend/.env');
}

const getMongoIdString = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value._id) {
        return value._id.toString();
    }

    return value.toString();
};

router.get('/api/recommendations',isLoggedIn,wrapAsync(async(req,res)=>{
    const user = await userModel.findById(req.user.id).populate('favorites').populate('watchlater');

    if(!user){
        throw new AppError("User not found",404);
    }

    if (!Array.isArray(user.profile_embedding) || user.profile_embedding.length === 0) {
        throw new AppError('User profile embedding is empty. Rebuild the profile embedding first.', 400);
    }

    const recommedations=await axios.post(`${AI_SERVICE_URL}/recommend`,{
        embedding:user.profile_embedding,
        k:10
    },{timeout:5000});

    if(!recommedations || !recommedations.data || !Array.isArray(recommedations.data.results)){
        throw new AppError("Failed to fetch recommendations",502);
     }

    const reviewedMovies = await reviewModel.find({ userId: req.user.id }).select('movieId');

    const seenMovieIds = new Set([
        ...(Array.isArray(user.favorites) ? user.favorites : []),
        ...(Array.isArray(user.watchlater) ? user.watchlater : []),
        ...reviewedMovies.map((review) => review.movieId),
    ].map(getMongoIdString).filter(Boolean));

    const movieIds=recommedations.data.results
        .map((e)=>e.movie_id)
        .filter((movieId) => movieId && !seenMovieIds.has(movieId.toString()));

    if(movieIds.length){
        const movies=await movieModel.find({_id:{$in:movieIds}});
        const movieMap = new Map(movies.map((movie) => [movie._id.toString(), movie]));
        const orderedMovies = movieIds.map((movieId) => movieMap.get(movieId.toString())).filter(Boolean);
        return res.json({
            success:true,
            data:orderedMovies
        });
     }

    return res.json({
        success:true,
        data:[]
    });
}));

module.exports=router;