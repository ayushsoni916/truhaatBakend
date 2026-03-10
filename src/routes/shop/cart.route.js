const express = require('express');
const shopCartRouter = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const { getOfflineCart, addToOfflineCart, updateOfflineCartItem } = require('../../controllers/shop/cart.controller');

shopCartRouter.use(requireAuth);

shopCartRouter.get('/', getOfflineCart);
shopCartRouter.post('/add', addToOfflineCart);
shopCartRouter.post('/update', updateOfflineCartItem);

module.exports = shopCartRouter;