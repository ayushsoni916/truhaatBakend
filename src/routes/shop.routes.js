const express = require('express');
const { addCategory, addSubCategory, getAllCategories, createShop, addProduct, getShopProducts, getAllSubCategories, getTopDeals, getTopShops, fixIndexes } = require('../controllers/shop/setup.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const shopRouter = express.Router();

shopRouter.get('/fix-index', fixIndexes);
// --- Categories ---
shopRouter.post('/category/add', addCategory); // Admin only in real app
shopRouter.post('/subcategory/add', addSubCategory); // Admin only
shopRouter.get('/categories', getAllCategories);
shopRouter.get('/subcategory/all', getAllSubCategories); // <-- NEW ROUTE

// --- Shop ---
shopRouter.post('/create', createShop);

shopRouter.post('/product/add',  addProduct);
shopRouter.get('/shop/:shopId/products', getShopProducts);

shopRouter.get('/products/top-deals', getTopDeals);
shopRouter.get('/shops/best-sellers', getTopShops);

module.exports = shopRouter;