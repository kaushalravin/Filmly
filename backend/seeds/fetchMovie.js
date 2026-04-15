const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const movieModel = require('../models/movies');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB connection successful!");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

async function fetchMovie(){
    const tmdbBaseUrl = process.env.TMDB_BASE_URL;
    const tmdbApiKey = process.env.TMDB_API_KEY;

    if (!tmdbBaseUrl || !tmdbApiKey) {
        throw new Error('TMDB_BASE_URL or TMDB_API_KEY is missing in backend/.env');
    }
    await movieModel.deleteMany({});

    const url = `${tmdbBaseUrl}discover/movie`;
    try{
        const [recentEnglishResponse, indianResponse, tamilResponse] = await Promise.all([
            axios.get(url, {
                params: {
                    api_key: tmdbApiKey,
                    with_original_language: 'en',
                    language: 'en-US',
                    sort_by: 'primary_release_date.desc',
                    include_adult: false,
                    'release_date.lte': new Date().toISOString().split('T')[0],
                    'vote_count.gte': 25,
                    page: 1
                }
            }),
            axios.get(url, {
                params: {
                    api_key: tmdbApiKey,
                    with_origin_country: 'IN',
                    region: 'IN',
                    language: 'en-IN',
                    sort_by: 'popularity.desc',
                    include_adult: false,
                    'vote_count.gte': 15,
                    page: 1
                }
            }),
            axios.get(url, {
                params: {
                    api_key: tmdbApiKey,
                    with_original_language: 'ta',
                    with_origin_country: 'IN',
                    region: 'IN',
                    language: 'ta-IN',
                    sort_by: 'primary_release_date.desc',
                    include_adult: false,
                    'release_date.lte': new Date().toISOString().split('T')[0],
                    'vote_count.gte': 10,
                    page: 1
                }
            })
        ]);

        const recentEnglishMovies = (recentEnglishResponse.data.results || []).slice(0, 20);
        const indianMovies = (indianResponse.data.results || []).slice(0, 20);
        const tamilMovies = (tamilResponse.data.results || []).slice(0, 20);

        if (recentEnglishMovies.length < 20 || indianMovies.length < 20 || tamilMovies.length < 20) {
            throw new Error('TMDB did not return enough movies to satisfy 20/20/20 split.');
        }

        const insertMovies = [];
        const combinedMovies = [...recentEnglishMovies, ...indianMovies, ...tamilMovies];
        const seenTmdbIds = new Set();

        combinedMovies.forEach((e) => {
            if (seenTmdbIds.has(e.id)) {
                return;
            }
            seenTmdbIds.add(e.id);

            const movie = {
                tmdbId: e.id,
                title: e.title,
                overview: e.overview,
                genres: (e.genre_ids || []).map(String),
                posterPath: e.poster_path,
                releaseDate: e.release_date,
                popularity: e.popularity
            };
            insertMovies.push(movie);
        });

        const res = await movieModel.insertMany(insertMovies, { ordered: false });
        console.log(
            `${res.length} movies inserted successfully from 60 fetched records (20 recent English + 20 Indian + 20 Tamil).`
        );
    }catch(err){
        if (err && err.code === 11000) {
            console.error('Duplicate movie(s) found due to unique tmdbId. Some records were skipped.');
            return;
        }
        console.error('Error fetching movie data:', err.message || err);
    }
}

fetchMovie();