const express = require('express');
const multer = require('multer');
const { createCategory, getAllCategories, createSubcategory, getSubcategoriesByParent, createSubService, addLocationPrice, getAvailableServicesByLocation, getSubServicesBySubcategory, getPriceBookBySubService } = require('../../controllers/serviceControllers/serviceCategory.controller');
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

module.exports = serviceRouter;