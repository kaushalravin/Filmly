const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/users');
const wrapAsync = require('../utilities/wrapAsync.js');
const AppError = require('../utilities/AppError');
const { isLoggedIn } = require('../validators/authMiddlewares');

const router = express.Router();

router.post('/api/signup', wrapAsync(async (req, res) => {
  const { username, email, password } = req.body;

  const response = await userModel.findOne({ $or: [{ username: username }, { email: email }] });

  if (response) {
    console.log(response);
    throw new AppError("User already exists", 409);
  }

  const toStore = {};
  toStore.username = username;
  toStore.email = email;
  toStore.password = await bcrypt.hash(password, 12);

  const user = new userModel(toStore);
  await user.save();
  console.log(user);
  res.status(201).json({
    success: true,
    message: "User saved successfully"
  });
}))

router.post('/api/login', wrapAsync(async (req, res) => {
  const { username, password } = req.body;

  const user = await userModel.findOne({ username: username });

  if (!user) {
    throw new AppError("Invalid username or password", 401);
  }

  //let test=await bcrypt.hash("demodemo123", 12);
  console.log(password);
  let test = await bcrypt.compare("$2b$12$XtU9Z77.HTx4tUsnvM/.nupHwUyNtgEN.iqKECdRZRDhr.rHYXnCO", user.password);
  console.log(test);

  const isValidPassword = await bcrypt.compare(password, user.password);
  console.log(isValidPassword);
  if (!isValidPassword) {
    throw new AppError("Wrong username or password", 401);
  }

  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "none",
    secure: true // true in production
  });

  res.json({
    success: true,
    data: {
      message: "Login successful",
      token
    }
  });
}))


router.post("/api/logout", isLoggedIn, (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "none",
    secure: false // true in production
  });

  res.json({
    success: true,
    data: {
      message: "Logged out successfully"
    }
  });
});

// check auth / current user
router.get("/api/me", isLoggedIn, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

module.exports = router;
