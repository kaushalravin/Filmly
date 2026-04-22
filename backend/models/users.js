const mongoose=require('mongoose');
const userSchema=new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true,
        minlength:5,
        maxlength:75
    },
    email:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    friendCount:{
        type:Number,
        default:0
    },
    friendRequestsCount:{
        type:Number,
        default:0
    }
});

const userModel=mongoose.model('User',userSchema);
module.exports=userModel;