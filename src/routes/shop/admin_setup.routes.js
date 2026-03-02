const express = require('express');
const multer = require('multer');
const {
    addCategory, getCategories, deleteCategory,
    addSubCategory, getSubCategories, deleteSubCategory,
    addTag, getTags, deleteTag,
    getCategoriesWithSubcategories
} = require('../../controllers/shop/admin_setup.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const adminSetupRouter = express.Router();

// Multer Memory Storage Configuration (As per your User Route reference)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================= CATEGORY ROUTES =================
// Using 'image' as the field name for the category icon
adminSetupRouter.post('/category/add', upload.single('image'), addCategory);
adminSetupRouter.get('/category/all', getCategories);
adminSetupRouter.get('/category/with-subcategories', getCategoriesWithSubcategories); // Nested list
adminSetupRouter.delete('/category/:id', requireAuth, deleteCategory);

// ================= SUBCATEGORY ROUTES =================
adminSetupRouter.post('/subcategory/add', upload.single('image'), addSubCategory);
adminSetupRouter.get('/subcategory/all', getSubCategories); // Supports ?parentId=...
adminSetupRouter.delete('/subcategory/:id', deleteSubCategory);

// ================= TAG ROUTES =================
// Tags don't require images, so no upload middleware needed
adminSetupRouter.post('/tag/add', addTag);
adminSetupRouter.get('/tag/all', getTags);
adminSetupRouter.delete('/tag/:id', deleteTag);

module.exports = adminSetupRouter;