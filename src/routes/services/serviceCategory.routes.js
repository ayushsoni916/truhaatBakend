const express = require('express');
const multer = require('multer');
const { createCategory, getAllCategories, createSubcategory, getSubcategoriesByParent, createSubService, addLocationPrice, getAvailableServicesByLocation, getSubServicesBySubcategory, getPriceBookBySubService, getUniversalPriceBookGrid } = require('../../controllers/serviceControllers/serviceCategory.controller');
const { getLiveAvailableServices, bookServiceInstant } = require('../../controllers/serviceControllers/serviceBooking.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const serviceRouter = express.Router();

// Multer parsing configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 } // 3MB threshold match
});

// Category Endpoints
serviceRouter.post('/categories', createCategory);
serviceRouter.get('/categories', getAllCategories);

// Subcategory Endpoints - expect 'image' parameter for file upload multipart forms
serviceRouter.post('/subcategories', upload.single('image'), createSubcategory);
serviceRouter.get('/subcategories/:parentCategoryId', getSubcategoriesByParent);

// New Deep Custom Action Items Routes
serviceRouter.post('/sub-services', createSubService);
serviceRouter.post('/price-book', addLocationPrice);

// Consumer Price Check Endpoint
serviceRouter.post('/resolve-availability', getAvailableServicesByLocation);

// Append these underneath your existing serviceCategory routing paths:
serviceRouter.get('/sub-services/by-subcategory/:subcategoryId', getSubServicesBySubcategory);
serviceRouter.get('/price-book/by-subservice/:subServiceId', getPriceBookBySubService);
serviceRouter.post('/price-book/inspect-grid', getUniversalPriceBookGrid);

// =========================================================
// NEW: LIVE CONSUMER BOOKING ENDPOINTS
// =========================================================

// 1. Check which main categories have live, online providers within a 5km radius
serviceRouter.post('/live-availability', getLiveAvailableServices);

// 2. Book a service instantly, automatically assign an agent, and return a job-completion OTP
serviceRouter.post('/book-now', requireAuth, bookServiceInstant);

module.exports = serviceRouter;