// const express = require('express');
// const multer = require('multer');
// const { getTopDeals, addProduct, getShopProducts, getProductsBySubCategory, searchProducts, getProductsByFilter, getProductDetailOffline } = require('../../controllers/shop/product.controller');
// const shopProductRouter = express.Router();

// const upload = multer({ storage: multer.memoryStorage() });

// shopProductRouter.post('/add', upload.array('images', 10), addProduct);
// shopProductRouter.get('/top-deals', getTopDeals);
// shopProductRouter.get('/shop/:shopId', getShopProducts);
// shopProductRouter.get('/filter/:id', getProductsByFilter);
// shopProductRouter.get('/subcategory/:subId', getProductsBySubCategory);
// shopProductRouter.get('/search', searchProducts);
// shopProductRouter.get('/detail/:productId', getProductDetailOffline);

// // shopProductRouter.get('/top-deals', getTopDeals);

// module.exports = shopProductRouter;

const express = require('express');
const multer = require('multer');
const {
    getTopDeals,
    addProduct,
    getShopProducts,
    getProductsBySubCategory,
    searchProducts,
    getProductsByFilter,
    getProductDetailOffline,
    getAdminShopProducts
} = require('../../controllers/shop/product.controller');

// Import the shop authentication middleware
const { requireShopAuth } = require('../../middleware/auth.middleware');

const shopProductRouter = express.Router();

// Memory storage for Cloudinary upload processing
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// PROTECTED ROUTES (Shop Owners Only)
// ==========================================
// Changed to max 5 images to keep payloads optimized and safe
shopProductRouter.post('/add', requireShopAuth, upload.array('images', 5), addProduct);

shopProductRouter.get('/admin/shop/:shopId', getAdminShopProducts); // <-- 3. Add Admin Route


// ==========================================
// PUBLIC ROUTES (For Consumer App & Browsing)
// ==========================================
shopProductRouter.get('/top-deals', getTopDeals);
shopProductRouter.get('/shop/:shopId', getShopProducts);
shopProductRouter.get('/filter/:id', getProductsByFilter);
shopProductRouter.get('/subcategory/:subId', getProductsBySubCategory);
shopProductRouter.get('/search', searchProducts);
shopProductRouter.get('/detail/:productId', getProductDetailOffline);

module.exports = shopProductRouter;