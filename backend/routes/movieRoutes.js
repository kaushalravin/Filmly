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

module.exports=router;