const express = require('express');
const orderRouter = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const { placeOfflineOrder, getOfflineOrderHistory } = require('../../controllers/shop/order.controller');

orderRouter.use(requireAuth);

// Endpoint to place the order from the cart
orderRouter.post('/place', placeOfflineOrder);

// Endpoint for the user to see their previous offline orders
orderRouter.get('/my-history', getOfflineOrderHistory);

module.exports = orderRouter;