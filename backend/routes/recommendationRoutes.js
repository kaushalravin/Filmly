const express=require('express');
const axios=require('axios');
const movieModel=require('../models/movies');
const userModel=require('../models/users');
const reviewModel=require('../models/reviews');
const wrapAsync=require('../utilities/wrapAsync.js');
const AppError=require('../utilities/AppError');
const isLoggedIn=require('../validators/authMiddlewares').isLoggedIn;
const { GoogleGenerativeAI } = require('@google/generative-ai');


const router=express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
if (!AI_SERVICE_URL) {
    throw new Error('AI service URL is not configured in backend/.env');
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

const GENRE_KEYWORDS = {
    action: '28',
    adventure: '12',
    animation: '16',
    comedy: '35',
    crime: '80',
    documentary: '99',
    drama: '18',
    family: '10751',
    fantasy: '14',
    history: '36',
    horror: '27',
    music: '10402',
    mystery: '9648',
    romance: '10749',
    'rom-com': '10749',
    romcom: '10749',
    sciencefiction: '878',
    'science fiction': '878',
    sci: '878',
    sci_fi: '878',
    scifi: '878',
    thriller: '53',
    war: '10752',
    western: '37',
};

const normalizeQuery = (query) => String(query || '').toLowerCase().replace(/[^a-z0-9\s_-]/g, ' ').replace(/\s+/g, ' ').trim();

const getQueryGenreBoosts = (query) => {
    const normalized = normalizeQuery(query);
    const tokens = new Set(normalized.split(' ').filter(Boolean));
    const boosts = new Set();

    if (GENRE_KEYWORDS[normalized]) {
        boosts.add(GENRE_KEYWORDS[normalized]);
    }

    for (const token of tokens) {
        if (GENRE_KEYWORDS[token]) {
            boosts.add(GENRE_KEYWORDS[token]);
        }
    }

    return boosts;
};

const rerankSemanticMovies = (movies, query) => {
    const queryText = normalizeQuery(query);
    const queryGenres = getQueryGenreBoosts(query);

    return movies
        .map((movie, index) => {
            const title = normalizeQuery(movie.title);
            const overview = normalizeQuery(movie.overview);
            const genres = Array.isArray(movie.genres) ? movie.genres.map(String) : [];

            const titleMatch = title.includes(queryText) ? 3 : 0;
            const keywordOverlap = queryText
                .split(' ')
                .filter(Boolean)
                .reduce((score, token) => score + (title.includes(token) || overview.includes(token) ? 0.35 : 0), 0);
            const genreMatch = genres.reduce((score, genreId) => score + (queryGenres.has(genreId) ? 2.5 : 0), 0);

            return {
                movie,
                score: (movies.length - index) + titleMatch + keywordOverlap + genreMatch,
            };
        })
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.movie);
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
        k:25
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
        // convert Mongoose documents to plain objects so added properties serialize in JSON
        let orderedMovies = movieIds.map((movieId) => movieMap.get(movieId.toString())).filter(Boolean);
        orderedMovies = orderedMovies.map(m => (m && typeof m.toObject === 'function') ? m.toObject() : m).slice(0, 12);

        // Pre-fill null explanation so frontend knows it's pending
        orderedMovies = orderedMovies.map(m => ({ ...m, explanation: null }));

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

router.post('/api/recommendations/explain', isLoggedIn, express.json(), wrapAsync(async (req, res) => {
    const { movieIds } = req.body;
    if (!Array.isArray(movieIds) || movieIds.length === 0) {
        throw new AppError("movieIds array is required", 400);
    }

    const user = await userModel.findById(req.user.id).populate('favorites').populate('watchlater');
    if (!user) {
        throw new AppError("User not found", 404);
    }

    const movies = await movieModel.find({ _id: { $in: movieIds } });
    const movieMap = new Map(movies.map((movie) => [movie._id.toString(), movie]));
    const orderedMovies = movieIds.map((id) => movieMap.get(id.toString())).filter(Boolean);

    if (orderedMovies.length === 0) {
        return res.json({ success: true, data: [] });
    }

    const profileSummary = await buildProfileSummary(user);
    const candidates = buildCandidatesPayload(orderedMovies, new Map());

    const promptPayload = {
        user_profile: profileSummary,
        candidates
    };

    try {
        const explanations = await callLLMExplain(promptPayload);
        return res.json({
            success: true,
            data: explanations
        });
    } catch (error) {
        console.error('[recommendations/explain] Gemini reasoning failed', error?.message || error);
        throw new AppError("Failed to generate explanations", 502);
    }
}));

router.get('/api/more-like-this/:tmdbId',isLoggedIn,wrapAsync(async(req,res)=>{
    const {tmdbId}=req.params;
    const movie=await movieModel.findOne({tmdbId:tmdbId});

    if(!movie){
        throw new AppError("Movie not found",404);
    }

    const embedding=movie.embedding;
    if(!Array.isArray(embedding) || embedding.length === 0){
        throw new AppError("Movie does not have a valid embedding",400);
    }

    const recommedations=await axios.post(`${AI_SERVICE_URL}/recommend`,{
        embedding:embedding,
        k:10
    },{timeout:5000});
    if(!recommedations || !recommedations.data || !Array.isArray(recommedations.data.results)){
        throw new AppError("Failed to fetch recommendations",502);
     }

    const movieIds=recommedations.data.results
        .map((e)=>e.movie_id)
        .filter((movieId) => movieId && movieId.toString() !== movie._id.toString()); 

    if(movieIds.length){
        const movies=await movieModel.find({_id:{$in:movieIds}});
        const movieMap = new Map(movies.map((movie) => [movie._id.toString(), movie]));
        const orderedMovies = movieIds.map((movieId) => movieMap.get(movieId.toString())).filter(Boolean);
        return res.json({
            success:true,
            data:orderedMovies
        });
     }
}));

//semantic search
router.get('/api/semantic-search',isLoggedIn,wrapAsync(async(req,res)=>{
    const {query}=req.query;
    if(!query || typeof query !== 'string' || query.trim() === ''){
        throw new AppError("Query is required",400);
    }

    const embeddingsResponse=await axios.post(`${AI_SERVICE_URL}/analyze`,{
        text:query
    },{timeout:5000});

    if(!embeddingsResponse || !embeddingsResponse.data || !Array.isArray(embeddingsResponse.data.embedding)){   
        throw new AppError("Failed to generate embedding for the query",502);   
    }

    const embedding=embeddingsResponse.data.embedding;
    const recommedations=await axios.post(`${AI_SERVICE_URL}/recommend`,{
        embedding:embedding,
        k:30
    },{timeout:5000});

    if(!recommedations || !recommedations.data || !Array.isArray(recommedations.data.results)){
        throw new AppError("Failed to fetch recommendations",502);
     }

    const movieIds=recommedations.data.results
        .map((e)=>e.movie_id)
        .filter(Boolean);

    if(movieIds.length){
        const movies=await movieModel.find({_id:{$in:movieIds}});
        const movieMap = new Map(movies.map((movie) => [movie._id.toString(), movie]));
        const orderedMovies = movieIds.map((movieId) => movieMap.get(movieId.toString())).filter(Boolean);
        const rerankedMovies = rerankSemanticMovies(orderedMovies, query);
        return res.json({
            success:true,
            data:rerankedMovies.slice(0, 20)
        });
     }

    return res.json({
        success:true,
        data:[]
    });

}))

// helper: truncate text
const truncate = (text, n = 200) => {
    if (!text) return '';
    return text.length > n ? text.substring(0, n - 1) + '…' : text;
};

const buildProfileSummary = async (user) => {
    // favorites and watchlater are populated by caller when possible
    const favorites = Array.isArray(user.favorites) ? user.favorites : [];
    const watchlater = Array.isArray(user.watchlater) ? user.watchlater : [];

    const allReviews = await reviewModel.find({ userId: user._id }).populate('movieId').sort({ _id: -1 });
    const recentReviews = allReviews.slice(0, 5).map((review) => ({
        movieTitle: review.movieId ? review.movieId.title : undefined,
        genres: Array.isArray(review.movieId?.genres) ? review.movieId.genres.slice(0, 3) : [],
        rating: review.rating,
        comment: truncate(review.comment, 80)
    }));

    const reviewByMovieId = new Map(
        allReviews
            .filter((review) => review.movieId)
            .map((review) => [review.movieId._id.toString(), review])
    );

    const favoriteMovies = favorites
        .map((movie) => {
            const linkedReview = reviewByMovieId.get(getMongoIdString(movie));

            return {
                title: movie.title,
                genres: Array.isArray(movie.genres) ? movie.genres.slice(0, 3) : [],
                rating: linkedReview?.rating ?? null
            };
        })
        .sort((left, right) => {
            const leftRating = typeof left.rating === 'number' ? left.rating : -1;
            const rightRating = typeof right.rating === 'number' ? right.rating : -1;
            return rightRating - leftRating;
        })
        .slice(0, 5);

    // top genres: count genres in favorites + reviewed movies
    const genreCounts = {};
    const addGenresFrom = (movie) => {
        if (!movie || !Array.isArray(movie.genres)) return;
        for (const g of movie.genres) {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        }
    };

    for (const f of favorites) addGenresFrom(f);
    for (const r of allReviews) if (r.movieId) addGenresFrom(r.movieId);

    const topGenres = Object.entries(genreCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(e=>e[0]);

    return {
        topGenres,
        favorites: favoriteMovies,
        watchlater: watchlater.slice(0, 5).map(m => m.title).filter(Boolean),
        recentReviews
    };
};

const buildCandidatesPayload = (candidates, recommendResultsMap) => {
    return candidates.map((movie) => {
        const id = movie._id ? movie._id.toString() : movie._id;
        return {
            id,
            title: movie.title,
            year: movie.releaseDate ? (new Date(movie.releaseDate)).getFullYear() : undefined,
            genres: movie.genres || [],
            cast: (movie.cast || []).slice(0, 3).map(c => c.name).filter(Boolean),
            overview: truncate(movie.overview, 120)
        };
    });
};

const formatDateInTimeZone = (date, timeZone) => {
    try {
        return date.toLocaleString('en-US', { timeZone });
    } catch (error) {
        return date.toISOString();
    }
};

const callLLMExplain = async (promptPayload) => {
    if (!GEMINI_API_KEY) {
        throw new AppError('GEMINI_API_KEY is not configured in environment', 500);
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const timeZone = process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const now = Date.now();
    const today = formatDateInTimeZone(new Date(now), timeZone);
    const yesterday = formatDateInTimeZone(new Date(now - 24 * 60 * 60 * 1000), timeZone);
    const dayBeforeYesterday = formatDateInTimeZone(new Date(now - 2 * 24 * 60 * 60 * 1000), timeZone);

    const prompt = `
You are a recommendation reasoning engine for a movie app.

Your job is to convert the provided user profile and candidate movies into a STRICT JSON array.

You MUST follow these rules:

1. Return ONLY valid JSON. No explanation, no extra text.
2. Each item must have: id, reason, signals.
3. reason must be a short explanation (1-2 sentences) of why the user would like the movie, based ONLY on the provided data.
4. signals must be a short array of the strongest matching signals (e.g. ["Action", "Tom Cruise"]).
5. Do not invent actors, genres, or preferences that are not present in the input.
6. You MUST return an explanation for EVERY candidate movie in the list below. Do not drop any movies.

Today is ${today} (${timeZone}).
Yesterday is ${yesterday}.
Day before yesterday is ${dayBeforeYesterday}.

User profile:
${JSON.stringify(promptPayload.user_profile, null, 2)}

Candidates:
${JSON.stringify(promptPayload.candidates, null, 2)}

Return JSON in EXACTLY this format:

[
  {
    "id": "string",
    "reason": "string",
    "signals": ["string"]
  }
]
`;

    console.log('[recommend/explain] Using Gemini client', {
        model: GEMINI_MODEL,
        candidateCount: (promptPayload?.candidates || []).length,
        topGenres: promptPayload?.user_profile?.topGenres,
        candidates: (promptPayload?.candidates || []).slice(0, 5).map((candidate) => ({ id: candidate.id, title: candidate.title }))
    });

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiText = response.text();
        console.log('[recommend/explain] Gemini raw text preview', aiText.substring(0, 1000));

        const first = aiText.indexOf('[');
        const last = aiText.lastIndexOf(']');
        if (first !== -1 && last !== -1 && last > first) {
            const sub = aiText.substring(first, last + 1);
            const parsed = JSON.parse(sub);
            console.log('[recommend/explain] parsed explanations count', Array.isArray(parsed) ? parsed.length : 0);
            console.log('[recommend/explain] first explanations', Array.isArray(parsed) ? parsed.slice(0, 3) : parsed);
            return parsed;
        }

        console.log('[recommend/explain] Gemini response could not be parsed', aiText.substring(0, 1000));
        throw new AppError('Gemini did not return valid JSON explanations', 502);
    } catch (err) {
        const message = (err && err.message) ? err.message : String(err);
        if (/fetch failed/i.test(message)) {
            throw new AppError('Failed to reach Google Gemini API (fetch failed). Check internet access/firewall/proxy and ensure Node 18+.', 503);
        }

        throw new AppError(`Gemini request failed: ${message}`, 502);
    }
};

// POST explain endpoint: body can include { tmdbId } to explain movie-based candidates, otherwise user-based
router.post('/api/recommend/explain', isLoggedIn, wrapAsync(async (req, res) => {
    const { tmdbId } = req.body || {};

    const user = await userModel.findById(req.user.id).populate('favorites').populate('watchlater');
    if (!user) throw new AppError('User not found', 404);

    // determine candidate movie ids
    let recommedations;
    if (tmdbId) {
        const movie = await movieModel.findOne({ tmdbId: tmdbId });
        if (!movie) throw new AppError('Movie not found', 404);
        if (!Array.isArray(movie.embedding) || movie.embedding.length === 0) throw new AppError('Movie embedding missing', 400);

        recommedations = await axios.post(`${AI_SERVICE_URL}/recommend`, { embedding: movie.embedding, k: 20 }, { timeout: 7000 });
    } else {
        if (!Array.isArray(user.profile_embedding) || user.profile_embedding.length === 0) {
            throw new AppError('User profile embedding is empty. Rebuild the profile embedding first.', 400);
        }
        recommedations = await axios.post(`${AI_SERVICE_URL}/recommend`, { embedding: user.profile_embedding, k: 30 }, { timeout: 7000 });
    }

    if (!recommedations || !recommedations.data || !Array.isArray(recommedations.data.results)) {
        throw new AppError('Failed to fetch recommendations', 502);
    }

    const results = recommedations.data.results;
    const movieIds = results.map(r => r.movie_id).filter(Boolean);
    if (movieIds.length === 0) return res.json({ success: true, data: [] });

    const movies = await movieModel.find({ _id: { $in: movieIds } });
    const movieMap = new Map(movies.map(m => [m._id.toString(), m]));
    const orderedMovies = movieIds.map(id => movieMap.get(id.toString())).filter(Boolean);

    // build profile summary and candidates payload
    const profileSummary = await buildProfileSummary(user);
    const recommendMap = new Map(results.map(r => [getMongoIdString(r.movie_id), r.score || r.similarity || null]));
    const candidates = buildCandidatesPayload(orderedMovies, recommendMap);

    const promptPayload = {
        user_profile: profileSummary,
        candidates,
        instructions: `For each candidate return an object {id, score, reason, signals}. Score must be between 0.0 and 1.0. Reason must be 1-2 concise sentences citing one concrete signal from the provided fields. Output a JSON array only.`
    };

    let explanations = [];
    try {
        explanations = await callLLMExplain(promptPayload);
    } catch (err) {
        // on LLM failure, return candidates without explanations but don't crash
        return res.json({ success: true, data: orderedMovies.map((m, i) => ({ movie: m, explanation: null })) });
    }

    // merge explanations with movies
    const explMap = new Map(explanations.map(e => [String(e.id), e]));
    const merged = orderedMovies.map((m) => ({ movie: m, explanation: explMap.get(getMongoIdString(m._id)) || null }));

    return res.json({ success: true, data: merged });
}));

//hero page route
router.get('/api/hero',isLoggedIn,wrapAsync(async(req,res)=>{
    const userid=req.id;

    const user=await userModel.find({userId:userid});
    let genres=user.genre_preferences;

    let arr=[];
    for(let i=0;i<genres.length;i++){
        let movies=await movieModel.find({genres:genres[i]}).limit(5);
        arr.push(...movies);
    }
}));

module.exports=router;
