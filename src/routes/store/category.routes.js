const express = require('express');
const categoryRouter = express.Router();
const multer = require('multer');

// Import multer middleware (Update the path based on your folder structure)
const upload = multer({ storage: multer.memoryStorage() }); // <-- Important: Must use memoryStorage

// Import Category Controllers
const { 
    addCategory, 
    getCategories, 
    deleteCategory, 
    updateCategory
} = require('../../controllers/store/category.controller');

// Import SubCategory Controllers
const { 
    addSubCategory, 
    getSubCategories, 
    deleteSubCategory, 
    updateSubCategory
} = require('../../controllers/store/subCategory.controller');
const { addTag, getTags, deleteTag, updateTag } = require('../../controllers/store/tag.controller');

// Use requireAuth if you want to protect add/delete for admins
// const { requireAuth } = require('../../middlewares/auth.middleware');

// ==========================================
// 1. CATEGORY ROUTES
// ==========================================
// POST /api/category/add
categoryRouter.post('/add', upload.single('image'), addCategory);      

// GET /api/category/all
categoryRouter.get('/all', getCategories);     

// DELETE /api/category/delete/:id
categoryRouter.delete('/delete/:id', deleteCategory); 
categoryRouter.put('/update/:id', upload.single('image'), updateCategory);


// ==========================================
// 2. SUB-CATEGORY ROUTES
// ==========================================
// POST /api/category/sub/add
categoryRouter.post('/sub/add', upload.single('image'), addSubCategory);      

// GET /api/category/sub/all (Can pass ?categoryId=... to filter)
categoryRouter.get('/sub/all', getSubCategories);     

// DELETE /api/category/sub/delete/:id
categoryRouter.delete('/sub/delete/:id', deleteSubCategory); 
categoryRouter.put('/sub/update/:id', upload.single('image'), updateSubCategory);

// ==========================================
// 3. TAG ROUTES
// ==========================================
// Note: No 'upload.single' here because tags don't have images
categoryRouter.post('/tag/add', addTag);      
categoryRouter.get('/tag/all', getTags);     
categoryRouter.delete('/tag/delete/:id', deleteTag);
categoryRouter.put('/tag/update/:id', updateTag);


module.exports = categoryRouter;