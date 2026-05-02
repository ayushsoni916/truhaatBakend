const express = require('express');
const { createOrder, handleWebhook } = require('../controllers/payment.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const routerRazor = express.Router();

// 1. Route to create an order (Called by React Native)
routerRazor.post('/create-order', requireAuth,createOrder);

// 2. Webhook route (Called by Razorpay - uses express.raw for signature verification)
routerRazor.post('/webhook', express.text({ type: 'application/json' }), handleWebhook);

module.exports = routerRazor;