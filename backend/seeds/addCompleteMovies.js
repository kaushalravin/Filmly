const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const movieModel = require('../models/movies');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URL = process.env.MONGO_URL;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

const TARGET_SPLIT = {
  ta: 20,
  te: 20,
  en: 60,
};

const HTTP_TIMEOUT_MS = 30000;
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

function isRetryableError(error) {
  const code = error?.code;
  const status = error?.response?.status;

  if (code && RETRYABLE_CODES.has(code)) return true;
  if (typeof status === 'number' && (status === 429 || status >= 500)) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(requestFn, label, maxAttempts = 4) {
  let attempt = 1;

  while (attempt <= maxAttempts) {
    try {
      return await requestFn();
    } catch (error) {
      const retryable = isRetryableError(error);
      const code = error?.code || 'UNKNOWN';
      const status = error?.response?.status;
      const msg = error?.message || String(error);

      if (!retryable || attempt === maxAttempts) {
        throw new Error(`${label} failed (attempt ${attempt}/${maxAttempts}) - code:${code} status:${status || '-'} msg:${msg}`);
      }

      const backoffMs = 500 * (2 ** (attempt - 1));
      console.warn(
        `[seed] ${label} retry ${attempt}/${maxAttempts} after ${backoffMs}ms (code:${code} status:${status || '-'})`
      );
      await sleep(backoffMs);
      attempt += 1;
    }
  }
}

function assertEnv() {
  const missing = [];
  if (!MONGO_URL) missing.push('MONGO_URL');
  if (!TMDB_BASE_URL) missing.push('TMDB_BASE_URL');
  if (!TMDB_API_KEY) missing.push('TMDB_API_KEY');
  if (!AI_SERVICE_URL) missing.push('AI_SERVICE_URL');

  if (missing.length) {
    throw new Error(`Missing env variable(s): ${missing.join(', ')}`);
  }
}

async function fetchMoviesByLanguage(languageCode, targetCount) {
  const out = [];
  const seen = new Set();

  // Pull multiple pages until we get enough unique movies.
  for (let page = 1; page <= 10 && out.length < targetCount; page += 1) {
    const response = await requestWithRetry(
      () =>
        axios.get(`${TMDB_BASE_URL}discover/movie`, {
          timeout: HTTP_TIMEOUT_MS,
          params: {
            api_key: TMDB_API_KEY,
            with_original_language: languageCode,
            include_adult: false,
            sort_by: 'popularity.desc',
            'vote_count.gte': 30,
            language: 'en-US',
            page,
          },
        }),
      `TMDB discover ${languageCode} page ${page}`
    );

    const results = response?.data?.results || [];
    if (!results.length) break;

    for (const movie of results) {
      if (out.length >= targetCount) break;
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      out.push(movie);
    }
  }

  if (out.length < targetCount) {
    throw new Error(
      `TMDB returned only ${out.length} movies for language '${languageCode}', required ${targetCount}`
    );
  }

  return out.slice(0, targetCount);
}

async function buildEmbedding(text) {
  const response = await requestWithRetry(
    () => axios.post(`${AI_SERVICE_URL}/analyze`, { text }, { timeout: HTTP_TIMEOUT_MS }),
    'AI embedding request'
  );
  const embedding = response?.data?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('AI service did not return a valid embedding');
  }

  return embedding;
}

function toMovieDoc(tmdbMovie, languageCode, embedding) {
  const title = tmdbMovie.title || tmdbMovie.name || `Untitled ${tmdbMovie.id}`;
  const overview = tmdbMovie.overview || '';

  return {
    tmdbId: tmdbMovie.id,
    title,
    overview,
    genres: (tmdbMovie.genre_ids || []).map(String),
    posterPath: tmdbMovie.poster_path || '',
    trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official trailer`)}`,
    releaseDate: tmdbMovie.release_date || null,
    popularity: Number(tmdbMovie.popularity || 0),
    cast: [],
    crew: [{ name: `lang:${languageCode}`, posterPath: '', character: '' }],
    embedding,
  };
}

async function addCompleteMovies() {
  assertEnv();

  await mongoose.connect(MONGO_URL);
  console.log('[seed] MongoDB connected');

  console.log('[seed] Fetching TMDB movies by language split (ta:20, te:20, en:60)...');
  const tamilMovies = await fetchMoviesByLanguage('ta', TARGET_SPLIT.ta);
  const teluguMovies = await fetchMoviesByLanguage('te', TARGET_SPLIT.te);
  const englishMovies = await fetchMoviesByLanguage('en', TARGET_SPLIT.en);
  console.log('[seed] TMDB fetch complete');

  const combined = [
    ...tamilMovies.map((m) => ({ ...m, _lang: 'ta' })),
    ...teluguMovies.map((m) => ({ ...m, _lang: 'te' })),
    ...englishMovies.map((m) => ({ ...m, _lang: 'en' })),
  ];

  // De-duplicate just in case TMDB overlaps unexpectedly.
  const uniqueByTmdb = [];
  const seenTmdb = new Set();
  for (const movie of combined) {
    if (seenTmdb.has(movie.id)) continue;
    seenTmdb.add(movie.id);
    uniqueByTmdb.push(movie);
  }

  if (uniqueByTmdb.length < 100) {
    throw new Error(`Unique movies after merge are ${uniqueByTmdb.length}, expected at least 100`);
  }

  const selected = uniqueByTmdb.slice(0, 100);

  console.log('[seed] Generating embeddings for 100 movies...');
  const docs = [];
  for (let i = 0; i < selected.length; i += 1) {
    const m = selected[i];
    const text = [m.title, m.overview, `language:${m._lang}`].filter(Boolean).join('. ');
    const embedding = await buildEmbedding(text);
    docs.push(toMovieDoc(m, m._lang, embedding));
    if ((i + 1) % 10 === 0) {
      console.log(`[seed] Embedded ${i + 1}/100`);
    }
  }

  await movieModel.deleteMany({});
  const inserted = await movieModel.insertMany(docs, { ordered: true });

  const splitCounts = inserted.reduce(
    (acc, movie) => {
      const marker = (movie.crew && movie.crew[0] && movie.crew[0].name) || '';
      if (marker === 'lang:ta') acc.ta += 1;
      else if (marker === 'lang:te') acc.te += 1;
      else if (marker === 'lang:en') acc.en += 1;
      return acc;
    },
    { ta: 0, te: 0, en: 0 }
  );

  console.log('[seed] Inserted movies:', inserted.length);
  console.log('[seed] Split:', splitCounts);
}

addCompleteMovies()
  .then(async () => {
    await mongoose.disconnect();
    console.log('[seed] Done');
  })
  .catch(async (err) => {
    console.error('[seed] Failed:', err.message || err);
    try {
      await mongoose.disconnect();
    } catch (disconnectErr) {
      // no-op
    }
    process.exit(1);
  });
