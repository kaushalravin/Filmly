const mongoose=require('mongoose');

const reviewSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    movieId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Movie',
        required:true
    },
    rating:{
        type:Number,
        required:true,
        min:0,
        max:10
    },
    comment:{
        type:String, 
    },
    embedding:{
        type:[Number],
        default:undefined
    }
    
});

const reviewModel=mongoose.model('Review',reviewSchema);
module.exports=reviewModel;