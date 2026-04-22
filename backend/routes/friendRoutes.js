const express=require('express');
const friendModel=require('../models/friends');
const userModel=require('../models/users');
const wrapAsync=require('../utilities/wrapAsync.js');
const AppError=require('../utilities/AppError');
const { isLoggedIn } = require('../validators/authMiddlewares');

const router=express.Router();

//sending request to another user
router.post('/api/friends/request/:touserId',isLoggedIn,wrapAsync(async(req,res)=>{
    const {touserId}=req.params;
    const fromUserId=req.user.id;

    if(fromUserId===touserId){
        throw new AppError("You cannot send friend request to yourself",400);
    }

    let isexisting=await userModel.exists({_id:touserId});
    if(!isexisting){
        throw new AppError("User not found",404);
    }

    isexisting=await friendModel.exists({
        $or:[
            {fromUserId,toUserId:touserId},
            {fromUserId:touserId,toUserId:fromUserId}
        ]
    });
    if(isexisting){
        throw new AppError("Friend request already sent",400);
    }

    const friendRequest=await friendModel.create({
        fromUserId,
        toUserId:touserId
    });

    await userModel.findByIdAndUpdate(touserId,{
        $inc:{friendRequestsCount:1}
    });

    res.status(201).json({
        message:"Friend request sent successfully"
    });
}));

//accepting friend request

router.patch('/api/friends/accept/:requestId',isLoggedIn,wrapAsync(async(req,res)=>{
    const {requestId}=req.params;
    const userId=req.user.id;

    const friendRequest=await friendModel.findById(requestId);

    if(!friendRequest){
        throw new AppError("Friend request not found",404);
    }

    if(friendRequest.toUserId.toString()!==userId){
        throw new AppError("You are not authorized to accept this friend request",403);
    }

    if(friendRequest.status!=='pending'){
        throw new AppError("Friend request already processed",400);
    }

    friendRequest.status='accepted';
    await friendRequest.save();
    await userModel.findByIdAndUpdate(friendRequest.fromUserId,{
        $inc:{friendCount:1}
    });
    await userModel.findByIdAndUpdate(friendRequest.toUserId,{
        $inc:{friendCount:1,friendRequestsCount:-1}
    });
    res.status(200).json({
        message:"Friend request accepted successfully"
    });

}));

//to reject friend request
router.post('/api/friends/reject/:requestId',isLoggedIn,wrapAsync(async(req,res)=>{
    const {requestId}=req.params;
    const userId=req.user.id;

    const friendRequest=await friendModel.findById(requestId);

    if(!friendRequest){
        throw new AppError("Friend request not found",404);
    }

    if(friendRequest.toUserId.toString()!==userId){
        throw new AppError("You are not authorized to reject this friend request",403);
    }

    if(friendRequest.status!=='pending'){
        throw new AppError("Friend request already processed",400);
    }

    friendRequest.status='rejected';
    await friendRequest.save();
    await userModel.findByIdAndUpdate(friendRequest.toUserId,{
        $inc:{friendRequestsCount:-1}
    });
    res.status(200).json({
        message:"Friend request rejected successfully"
    });
}));

//to see friends list of user
router.get('/api/friends',isLoggedIn,wrapAsync(async(req,res)=>{
    const user=req.user.id;
    const friends=await friendModel.find({
        $or:[
            {fromUserId:user,status:'accepted'},
            {toUserId:user,status:'accepted'}
        ]
    }).populate('fromUserId','username email').populate('toUserId','username email');
    res.status(200).json({
        message:"Friends retrieved successfully",
        data:friends
    });
}));

//to see pending friend requests
router.get('/api/friends/requests',isLoggedIn,wrapAsync(async(req,res)=>{
    const user=req.user.id;
    const friendRequests=await friendModel.find({
        toUserId:user,
        status:'pending'
    }).populate('fromUserId','username');
    res.status(200).json({
        message:"Pending friend requests retrieved successfully",
        data:friendRequests
    });
}));

//to unfriend a user
router.delete('/api/friends/unfriend/:friendId',isLoggedIn,wrapAsync(async(req,res)=>{
    const {friendId}=req.params;
    const userId=req.user.id;
    const friend=await friendModel.findById(friendId);

    if(!friend){
        throw new AppError("Friend not found",404);
    }
    if(friend.fromUserId.toString()!==userId && friend.toUserId.toString()!==userId){
        throw new AppError("You are not authorized to unfriend this user",403);
    }
    await friendModel.findByIdAndDelete(friendId);
    await userModel.findByIdAndUpdate(friend.fromUserId,{
        $inc:{friendCount:-1}
    });
    await userModel.findByIdAndUpdate(friend.toUserId,{
        $inc:{friendCount:-1}
    });
    res.status(200).json({
        message:"Friend removed successfully"
    });
}));

//to search an user
router.post('/api/friends/search',isLoggedIn,wrapAsync(async(req,res)=>{
    const {username}=req.body;
    if(!username || typeof username!=='string' || username.trim()===''){
        throw new AppError("Invalid username",400);
    }
    const currentUserId = req.user.id;
    const matchedUsers = await userModel.find({
        _id: { $ne: currentUserId },
        username:{$regex:username.trim(),$options:'i'}
    }).select('username email friendCount');

    const matchedIds = matchedUsers.map((user) => user._id);
    const relations = await friendModel.find({
        $or:[
            {fromUserId:currentUserId,toUserId:{$in:matchedIds}},
            {fromUserId:{$in:matchedIds},toUserId:currentUserId}
        ]
    }).select('fromUserId toUserId status');

    const relationMap = new Map();
    relations.forEach((relation) => {
        const otherId = relation.fromUserId.toString() === currentUserId
            ? relation.toUserId.toString()
            : relation.fromUserId.toString();
        relationMap.set(otherId, relation.status);
    });

    const users = matchedUsers.map((user) => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        friendCount: user.friendCount,
        status: relationMap.get(user._id.toString()) || 'none',
    }));
    res.status(200).json({
        message:"Users retrieved successfully",
        data:users
    });
}));

module.exports=router;