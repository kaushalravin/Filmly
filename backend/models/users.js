const mongoose=require('mongoose');
const movieModel=require('./movies');
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
    },
    favorites:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:'Movie'
        },
    ],
    watchlater:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:'Movie'
        }
    ],
    profile_embedding:{
        type:[Number],
        default:[]
    },
    genre_preferences:{
        type:Map,
        of:Number,
        default:{}
    }
});

const userModel=mongoose.model('User',userSchema);
module.exports=userModel;