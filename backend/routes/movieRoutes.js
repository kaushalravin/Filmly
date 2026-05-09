const express=require('express');
const axios=require('axios');
const movieModel=require('../models/movies');
const userModel=require('../models/users');
const wrapAsync=require('../utilities/wrapAsync.js');
const AppError=require('../utilities/AppError');
const isLoggedIn=require('../validators/authMiddlewares').isLoggedIn;

const router=express.Router();

router.get('/api/trending',wrapAsync((async(req,res)=>{
    const response=await axios.get(`${process.env.TMDB_BASE_URL}trending/movie/week`,{
        params:{
            api_key:process.env.TMDB_API_KEY,
        }
    })

    if(!response || response.status!==200){
        throw new AppError("Failed to fetch trending movies",500);
    }

    const movies=response.data.results;
    let finalMovies=[];

    movies.map((e)=>{
        const toStore={};
        toStore.tmdbId=e.id;
        toStore.title=e.title;
        toStore.overview=e.overview;
        toStore.genres=(e.genre_ids || []).map(String);
        toStore.releaseDate=e.release_date;
        toStore.posterPath=e.poster_path;
        toStore.popularity=e.popularity;
        finalMovies.push(toStore);
    });

    res.json({
        success:true,
        data:finalMovies
    });
})));

router.get('/api/search',wrapAsync(async(req,res)=>{
   const searchItem=req.query.searchItem;
    if(!searchItem || typeof searchItem!=='string' || searchItem.trim()===''){
        throw new AppError("Invalid search query",400);
    }
    
    const response=await axios.get(`${process.env.TMDB_BASE_URL}search/movie`,{
        params:{
            api_key:process.env.TMDB_API_KEY,
            query:searchItem,
        }
    })

    if(!response || response.status!==200){
        throw new AppError("Failed to fetch search results",500);
    }

    const movies=response.data.results;
    let finalMovies=[];

    movies.map((e)=>{
        const toStore={};
        toStore.tmdbId=e.id;
        toStore.title=e.title;
        toStore.overview=e.overview;
        toStore.genres=(e.genre_ids || []).map(String);
        toStore.releaseDate=e.release_date;
        toStore.posterPath=e.poster_path;
        toStore.popularity=e.popularity;
        finalMovies.push(toStore);
    });

    res.json({
        success:true,
        data:finalMovies
    });
}));

router.get('/api/movie/:tmdbId',wrapAsync(async(req,res)=>{
    const tmdbId=req.params.tmdbId;

    if(!tmdbId || isNaN(tmdbId)){
        throw new AppError("Invalid TMDB ID",400);
    }

    const response1=await movieModel.findOne({tmdbId:tmdbId});

    if(response1){
        return res.json({
            success:true,
            data:response1
        });
    }

    const response2=await axios.get(`${process.env.TMDB_BASE_URL}movie/${tmdbId}`,{
        params:{
            api_key:process.env.TMDB_API_KEY,
            append_to_response:'credits'
        }
    });
    

    if(!response2 || response2.status!==200){
        throw new AppError("Failed to fetch movie details",500);
    }

    const e=response2.data;

    const movie = {
        tmdbId: e.id,
        title: e.title,
        overview: e.overview,
        genres: (e.genre_ids || []).map(String),
        posterPath: e.poster_path,
        releaseDate: e.release_date,
        popularity: e.popularity,
        cast: (e.credits?.cast || []).map((actor) => ({
            name: actor.name,
            posterPath: actor.profile_path,
            character: actor.character
        })),
        trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(e.title + " official trailer")}`
    };

    const aiServiceUrl = process.env.AI_SERVICE_URL;
    if (!aiServiceUrl) {
        throw new AppError('AI service URL is not configured', 500);
    }

    const embeddingText = [movie.title, movie.overview, movie.genres.join(', ')]
        .filter(Boolean)
        .join('. ');

    let aiResponse;
    try {
        aiResponse = await axios.post(`${aiServiceUrl}/analyze`, {
            text: embeddingText
        });
    } catch (error) {
        console.error('[movie] AI service request failed:', error?.response?.data || error.message);
        throw new AppError('Failed to add movie embeddings', 502);
    }

    if (!aiResponse?.data?.embedding) {
        throw new AppError('Failed to add movie embeddings', 502);
    }

    movie.embedding = aiResponse.data.embedding;
    console.log('embedding has been created for the movie', movie.tmdbId);

    await movieModel.create(movie);


    res.json({
        success:true,
        data: movie
    });

}));

//add to favorites
router.post('/api/favorites/:tmdbId',isLoggedIn,wrapAsync(async(req,res)=>{
    const {tmdbId}=req.params;

    if(!tmdbId || isNaN(tmdbId)){
        throw new AppError("Invalid TMDB ID",400);
    }

    const movie=await movieModel.findOne({tmdbId:tmdbId});

    if(!movie){
        throw new AppError("Movie not found",404);
    }
    
    const user=await userModel.findById(req.user.id);
    if(!user){
        throw new AppError("User not found",404);
    }
    
    if(user.favorites.includes(movie._id)){
        throw new AppError("Movie already in favorites",400);
    }

    user.favorites.push(movie._id);
    await user.save();
    res.json({
        success:true,
        message:"Movie added to favorites successfully"
    });
}));

//add to watch Later
router.post('/api/watchLater/:tmdbId',isLoggedIn,wrapAsync(async(req,res)=>{
    const {tmdbId}=req.params;
    if(!tmdbId || isNaN(tmdbId)){
        throw new AppError("Invalid TMDB ID",400);
    };

    const movie=await movieModel.findOne({tmdbId:tmdbId});
    if(!movie){
        throw new AppError("Movie not found",404);
    }

    const user=await userModel.findById(req.user.id);
    if(!user){
        throw new AppError("User not found",404);
    }
    
    if(user.watchlater.includes(movie._id)){
        throw new AppError("Movie already in watch later",400);
    }
    user.watchlater.push(movie._id);
    await user.save();
    res.json({
        success:true,
        message:"Movie added to watch later successfully"
    });
}));


//to get all the favorite movies of user
router.get('/api/favorites',isLoggedIn,wrapAsync(async(req,res)=>{
    const user=await userModel.findById(req.user.id);
    if(!user){
        throw new AppError("User not found",404);
    }
    const favorites=await movieModel.find({_id:{$in:user.favorites}});
    res.json({
        success:true,
        data:favorites
    });
}));

//to get all the watch later movies of user
router.get('/api/watchLater',isLoggedIn,wrapAsync(async(req,res)=>{
    const user=await userModel.findById(req.user.id);
    if(!user){
        throw new AppError("User not found",404);
    }
    const watchLater=await movieModel.find({_id:{$in:user.watchlater}});
    res.json({
        success:true,
        data:watchLater
    });
}));


module.exports=router;