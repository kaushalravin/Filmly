const express=require('express');
const axios=require('axios');
const movieModel=require('../models/movies');
const userModel=require('../models/users');
const userActivityModel=require('../models/userActivity');
const wrapAsync=require('../utilities/wrapAsync.js');
const AppError=require('../utilities/AppError');
const isLoggedIn=require('../validators/authMiddlewares').isLoggedIn;
const rebuildUserProfile=require('../utilities/rebuildUserProfile');

const router=express.Router();

const TMDB_TIMEOUT_MS = Number(process.env.TMDB_TIMEOUT_MS || 10000);

const getTmdbBaseUrl = () => {
    const baseUrl = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3/';
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

const fetchTmdb = async (path, params = {}) => {
    try {
        return await axios.get(`${getTmdbBaseUrl()}${path}`, {
            timeout: TMDB_TIMEOUT_MS,
            params: {
                api_key: process.env.TMDB_API_KEY,
                ...params,
            },
        });
    } catch (error) {
        console.error(`[tmdb] ${path} request failed:`, error?.code || error?.message);
        return null;
    }
};

router.get('/api/trending', wrapAsync(async (req, res) => {
    const page = Math.min(10, Math.max(1, parseInt(req.query.page, 10) || 1));
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const response = await fetchTmdb('trending/movie/week', { page });

    if (response && response.status === 200 && Array.isArray(response.data?.results)) {
        const finalMovies = response.data.results.map((e) => ({
            tmdbId: e.id,
            title: e.title,
            overview: e.overview,
            genres: (e.genre_ids || []).map(String),
            releaseDate: e.release_date,
            posterPath: e.poster_path,
            popularity: e.popularity,
        }));

        return res.json({
            success: true,
            data: finalMovies,
            page,
            totalPages: Math.min(response.data.total_pages || 1, 10),
            source: 'tmdb',
        });
    }

    console.warn('[trending] TMDB unavailable, falling back to paginated DB results.');

    const skip = (page - 1) * limit;
    const [totalCount, fallbackMovies] = await Promise.all([
        movieModel.countDocuments({}),
        movieModel
            .find({})
            .sort({ popularity: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const data = fallbackMovies.map((movie) => ({
        tmdbId: movie.tmdbId,
        title: movie.title,
        overview: movie.overview,
        genres: Array.isArray(movie.genres) ? movie.genres : [],
        releaseDate: movie.releaseDate,
        posterPath: movie.posterPath,
        popularity: movie.popularity,
    }));

    return res.json({
        success: true,
        data,
        page,
        totalPages,
        source: 'db-fallback',
    });
}));

router.get('/api/search',wrapAsync(async(req,res)=>{
   const searchItem=req.query.searchItem;
    if(!searchItem || typeof searchItem!=='string' || searchItem.trim()===''){
        throw new AppError("Invalid search query",400);
    }
    
    const response=await fetchTmdb('search/movie', {
        query: searchItem,
    });

    if(!response || response.status!==200 || !Array.isArray(response.data?.results)){
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

    let cachedMovie = await movieModel.findOne({tmdbId:tmdbId});

    // If cached movie exists and has a populated cast, it is healthy.
    if(cachedMovie && Array.isArray(cachedMovie.cast) && cachedMovie.cast.length > 0){
        return res.json({
            success:true,
            data:cachedMovie
        });
    }

    const response2 = await fetchTmdb(`movie/${tmdbId}`, {
        append_to_response: 'credits'
    });
    
    if(!response2 || response2.status!==200){
        if (cachedMovie) {
            return res.json({ success: true, data: cachedMovie }); // Fallback to cached if TMDB fails
        }
        throw new AppError("Failed to fetch movie details",500);
    }

    const e = response2.data;

    const movieUpdate = {
        tmdbId: e.id,
        title: e.title,
        overview: e.overview,
        // TMDB detail response uses "genres" array of objects, not genre_ids
        genres: (e.genres || []).map((g) => String(g.id || g)),
        posterPath: e.poster_path,
        releaseDate: e.release_date,
        popularity: e.popularity,
        cast: (e.credits?.cast || []).map((actor) => ({
            name: actor.name,
            posterPath: actor.profile_path,
            character: actor.character
        })),
        crew: (e.credits?.crew || []).map((member) => ({
            name: member.name,
            posterPath: member.profile_path,
            character: member.job
        })),
        trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(e.title + " official trailer")}`
    };

    if (cachedMovie) {
        // The movie exists but lacks cast/crew, so we heal the document.
        Object.assign(cachedMovie, movieUpdate);
        await cachedMovie.save();
        return res.json({ success: true, data: cachedMovie });
    }

    // Completely new movie, needs an embedding
    const aiServiceUrl = process.env.AI_SERVICE_URL;
    if (!aiServiceUrl) {
        throw new AppError('AI service URL is not configured', 500);
    }

    const embeddingText = [movieUpdate.title, movieUpdate.overview, movieUpdate.genres.join(', ')]
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

    movieUpdate.embedding = aiResponse.data.embedding;
    console.log('embedding has been created for the movie', movieUpdate.tmdbId);

    const newMovie = await movieModel.create(movieUpdate);

    res.json({
        success:true,
        data: newMovie
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
    await userActivityModel.create({
        userId: req.user.id,
        action: 'favorite_added',
        movieId: movie._id,
        movieTitle: movie.title,
        posterPath: movie.posterPath,
        tmdbId: movie.tmdbId,
    });
    await rebuildUserProfile(req.user.id);
    res.json({
        success:true,
        message:"Movie added to favorites successfully"
    });
}));

router.delete('/api/favorites/:tmdbId',isLoggedIn,wrapAsync(async(req,res)=>{
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

    const hadFavorite = user.favorites.some((favoriteId) => favoriteId.toString() === movie._id.toString());
    if(!hadFavorite){
        throw new AppError("Movie is not in favorites",400);
    }

    user.favorites = user.favorites.filter((favoriteId) => favoriteId.toString() !== movie._id.toString());
    await user.save();
    await userActivityModel.create({
        userId: req.user.id,
        action: 'favorite_removed',
        movieId: movie._id,
        movieTitle: movie.title,
        posterPath: movie.posterPath,
        tmdbId: movie.tmdbId,
    });
    await rebuildUserProfile(req.user.id);

    res.json({
        success:true,
        message:"Movie removed from favorites successfully"
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
    await userActivityModel.create({
        userId: req.user.id,
        action: 'watchlater_added',
        movieId: movie._id,
        movieTitle: movie.title,
        posterPath: movie.posterPath,
        tmdbId: movie.tmdbId,
    });
    await rebuildUserProfile(req.user.id);
    res.json({
        success:true,
        message:"Movie added to watch later successfully"
    });
}));

router.delete('/api/watchLater/:tmdbId',isLoggedIn,wrapAsync(async(req,res)=>{
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

    const hasWatchLater = user.watchlater.some((movieId) => movieId.toString() === movie._id.toString());
    if(!hasWatchLater){
        throw new AppError("Movie is not in watch later",400);
    }

    user.watchlater = user.watchlater.filter((movieId) => movieId.toString() !== movie._id.toString());
    await user.save();
    await userActivityModel.create({
        userId: req.user.id,
        action: 'watchlater_removed',
        movieId: movie._id,
        movieTitle: movie.title,
        posterPath: movie.posterPath,
        tmdbId: movie.tmdbId,
    });
    await rebuildUserProfile(req.user.id);

    res.json({
        success:true,
        message:"Movie removed from watch later successfully"
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