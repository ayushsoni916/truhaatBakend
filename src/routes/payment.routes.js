const express = require('express');
const { createOrder, handleWebhook, createCashBackOrder, getAllPayments, verifyManualPayment } = require('../controllers/payment.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const routerRazor = express.Router();

// 1. Route to create an order (Called by React Native)
routerRazor.post('/create-order', requireAuth, createOrder);
routerRazor.post('/create-cashback-order', requireAuth, createCashBackOrder);


// 2. Webhook route (Called by Razorpay - uses express.raw for signature verification)
routerRazor.post('/webhook', express.text({ type: 'application/json' }), handleWebhook);

// ==========================================
// ADMIN PAYMENT LEDGER ROUTES
// ==========================================

// Get all gateway payments and calculated stats for the dashboard
routerRazor.get('/admin/all', getAllPayments);

// Verify or reject manual UTR payment requests
routerRazor.put('/admin/verify/:paymentId', verifyManualPayment);

module.exports = routerRazor;