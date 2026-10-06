const express = require('express');
const shopCartRouter = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const { getOfflineCart, addToOfflineCart, updateOfflineCartItem, changeOfflineCartVariant } = require('../../controllers/shop/cart.controller');

shopCartRouter.use(requireAuth);

shopCartRouter.get('/', getOfflineCart);
shopCartRouter.post('/add', addToOfflineCart);
shopCartRouter.post('/update', updateOfflineCartItem);
shopCartRouter.post(
    '/change-variant',
    changeOfflineCartVariant
);

module.exports = shopCartRouter;