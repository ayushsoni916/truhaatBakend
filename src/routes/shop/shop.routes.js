const express = require('express');
const multer = require('multer');
const { createShop, getTopShops } = require('../../controllers/shop/shop.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const shopRouter = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

shopRouter.post('/create', upload.array('images', 3), createShop);
shopRouter.get('/top-shops', getTopShops);


// shopRouter.get('/fix-index', fixIndexes);
// // --- Categories ---
// shopRouter.post('/category/add', addCategory); // Admin only in real app
// shopRouter.post('/subcategory/add', addSubCategory); // Admin only
// shopRouter.get('/categories', getAllCategories);
// shopRouter.get('/subcategory/all', getAllSubCategories); // <-- NEW ROUTE

// // --- Shop ---
// // shopRouter.post('/create', createShop);

// shopRouter.post('/product/add', addProduct);
// shopRouter.get('/shop/:shopId/products', getShopProducts);

// shopRouter.get('/products/top-deals', getTopDeals);

module.exports = shopRouter;