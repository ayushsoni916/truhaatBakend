const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { placeOrder, getCart, addToCart, applyCoupon, getAddresses, addAddress, removeCartItem, getDefaultAddress, updateCartItem, createCoupon, getCoupons } = require('../../controllers/store/store.controller');
const cartRouter = express.Router();

// Import Controller Functions


// ==========================================
// CART ROUTES
// ==========================================
// All require login (requireAuth)

// GET /api/store/cart - View Cart & Totals
cartRouter.get('/cart', requireAuth, getCart);

// POST /api/store/cart/add - Add Item
cartRouter.post('/cart/add', requireAuth, addToCart);

// POST /api/store/cart/coupon - Apply Coupon
cartRouter.post('/cart/coupon', requireAuth, applyCoupon);

// DELETE /api/store/cart/:productId - Remove Item
// Note: You might need to pass size in query params if you want to delete specific size
// For now, this assumes deleting all qty of that product
cartRouter.delete('/cart/:productId', requireAuth, removeCartItem);
cartRouter.put('/cart/update', requireAuth, updateCartItem);


// ==========================================
// ADDRESS ROUTES
// ==========================================

// GET /api/store/address - Get all saved addresses
cartRouter.get('/address', requireAuth, getAddresses);

// POST /api/store/address - Add new address
cartRouter.post('/address', requireAuth, addAddress);

//get default address
cartRouter.get('/address/default', requireAuth, getDefaultAddress);


// ==========================================
// Coupoun ROUTES
// ==========================================

cartRouter.post('/coupon/add', requireAuth, createCoupon); // Ideally protect with Admin middleware
cartRouter.get('/coupon/all', getCoupons);                 // Public or User
cartRouter.post('/cart/coupon/apply', requireAuth, applyCoupon);


// ==========================================
// ORDER ROUTES
// ==========================================

// POST /api/store/order/place - Final Checkout
cartRouter.post('/order/place', requireAuth, placeOrder);

module.exports = cartRouter;