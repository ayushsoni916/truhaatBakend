const express = require('express');
const multer = require('multer');
const { getTopDeals, addProduct, getShopProducts, getProductsBySubCategory, searchProducts, getProductsByFilter } = require('../../controllers/shop/product.controller');
const shopProductRouter = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

shopProductRouter.post('/add', upload.array('images', 10), addProduct);
shopProductRouter.get('/top-deals', getTopDeals);
shopProductRouter.get('/shop/:shopId', getShopProducts);
shopProductRouter.get('/filter/:id', getProductsByFilter);
shopProductRouter.get('/subcategory/:subId', getProductsBySubCategory);
shopProductRouter.get('/search', searchProducts);
// shopProductRouter.get('/top-deals', getTopDeals);

module.exports = shopProductRouter;