const joi = require('joi');
const jwt = require('jsonwebtoken');
const userSchema = require('./authValidators').signupSchema;
const loginSchema = require('./authValidators').LoginSchema;
const AppError = require('../utilities/AppError');

const getTokenFromRequest = (req) => {
    const authHeader = req.get("authorization") || req.get("Authorization");
    if (authHeader) {
        const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
        if (match) return match[1];
    }

    const cookieToken = req?.cookies?.token;
    if (cookieToken) return cookieToken;

    return null;
};

const validateUser = (req, res, next) => {
    try {
        const { error } = userSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                message: error.details[0].message,
            });
        }

        next();
    } catch (err) {
        return res.status(400).json({
            message: error.details[0].message,
        });
    }
}

const validateUserLogin = (req, res, next) => {
    try {
        const { error } = loginSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                message: error.details[0].message,
            });
        }

        next();
    } catch (err) {
        return res.status(400).json({
            message: error.details[0].message,
        });
    }
}

const isLoggedIn = (req, res, next) => {
    const token = getTokenFromRequest(req);
    
    if (!token) {
        return next(new AppError("You are not authorized", 401));
    }
    try {
        
        const payload = jwt.verify(token, process.env.JWT_SECRET);//if this is not true it throws so kept it in try catch block
        req.user = payload;
        next();
    } catch (err) {
        next(new AppError("You are not authorized", 401));
    }
};


//isAuthorized has to come here

module.exports = { validateUser, validateUserLogin, isLoggedIn };