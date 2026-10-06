const express = require('express');
const orderRouter = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const { placeOfflineOrder, getOfflineOrderHistory, getAllPlatformOrders, markPayoutSettled, getOrdersByShopId, updateOrderStatus } = require('../../controllers/shop/order.controller');

// orderRouter.use(requireAuth);

// Endpoint to place the order from the cart
orderRouter.post('/place', requireAuth, placeOfflineOrder);

// Endpoint for the user to see their previous offline orders
orderRouter.get('/my-history', requireAuth, getOfflineOrderHistory);

orderRouter.get('/admin/all', getAllPlatformOrders);

// Endpoint to mark a specific vendor payout as 'Settled'
orderRouter.put('/admin/settle/:orderId', markPayoutSettled);

// ==========================================
// SHOP OWNER ROUTES
// ==========================================
// Get all orders belonging to a specific shop
orderRouter.get('/shop/:shopId', getOrdersByShopId);

// Update status (Accepted, Ready, Completed, Cancelled)
orderRouter.put('/status/:orderId', updateOrderStatus);

module.exports = orderRouter;