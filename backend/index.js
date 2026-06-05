const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
const cookieParser=require('cookie-parser');
const path=require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const authRoutes=require('./routes/authRoutes');
const movieRoutes=require('./routes/movieRoutes');
const reviewRoutes=require('./routes/reviewRoutes');
const friendRoutes=require('./routes/friendRoutes');
const recommendationRoutes=require('./routes/recommendationRoutes');
const dashboardRoutes=require('./routes/dashboardRoutes');

const port=process.env.PORT || 3000;
const mongoUrl=process.env.MONGO_URL;

const app=express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools (Postman/curl) and approved frontend origins.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));

app.use((req, res, next) => {
  console.log(`[backend] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(authRoutes);
app.use(movieRoutes);
app.use(reviewRoutes);
app.use(friendRoutes);
app.use(recommendationRoutes);
app.use(dashboardRoutes);

mongoose
  .connect(mongoUrl)
  .then(() => {
    console.log("MongoDB connection successful!");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });


app.get('/',(req,res)=>{
    res.send('hello world');
});

app.listen(port,()=>{
  console.log(`server is running on port ${port}`);
})