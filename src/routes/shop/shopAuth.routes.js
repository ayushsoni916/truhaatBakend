const express = require('express');
const { requireAuth, requireShopAuth } = require('../../middleware/auth.middleware');
const { sendShopOtp, verifyShopOtp, getShopProfile } = require('../../controllers/shop/shopAuth.controller');

const shopAuthRouter = express.Router();

// Public Routes (For Login)
shopAuthRouter.post('/send-otp', sendShopOtp);
shopAuthRouter.post('/verify-otp', verifyShopOtp);

// Protected Routes (Requires JWT Token)
shopAuthRouter.get('/profile', requireShopAuth, getShopProfile);

module.exports = shopAuthRouter;