const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
require('dotenv').config();

const app=express();

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