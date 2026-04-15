const mongoose=require('mongoose');
const { create } = require('./movies');

const userSchema=new mongoose.Schema({
    username:{
        string:true,
        required:true,
        unique:true,
        minlength:5,
        maxlength:75
    },
    email:{
        type:string,
        required:true
    },
    password:{
        type:string,
        required:true
    },
    createdAt:{
        type:Date,
        default:Date.now
    }  
});

const userModel=mongoose.model('User',userSchema);
module.exports=userModel;