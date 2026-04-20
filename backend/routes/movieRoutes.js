const express=require('express');
const axios=require('axios');
const movieModel=require('../models/movies');
const wrapAsync=require('../utilities/wrapAsync');
const AppError=require('../utilities/AppError');

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
                crew: (e.credits?.crew || []).map((member) => ({
                    name: member.name,
                    posterPath: member.profile_path,
                    character: member.job || member.department || ""
                })),
                trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(e.title + " official trailer")}`
            };
    

    await movieModel.insertOne(movie, { ordered: false });

    res.json({
        success:true,
        data: movie
    });

}));


module.exports=router;