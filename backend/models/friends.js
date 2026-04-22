const mongoose=require('mongoose');
const userModel=require('./users');

const friendSchema=new mongoose.Schema({
    fromUserId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true,
    },
    toUserId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true,
    },
    status:{
        type:String,
        enum:['pending','accepted','rejected'],
        default:'pending',
    }
},{
    timestamps:true,
}); 

const friendModel=mongoose.model('Friend',friendSchema);
module.exports=friendModel;
    