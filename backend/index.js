const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
const cookieParser=require('cookie-parser');

const authRoutes=require('./routes/authRoutes');
require('dotenv').config();

const app=express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin:'*'
}));
app.use(authRoutes);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB connection successful!");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });


app.get('/',(req,res)=>{
    res.send('hello world');
});

app.listen(process.env.PORT,()=>{
    console.log(`server is running on port ${process.env.PORT}`);
})