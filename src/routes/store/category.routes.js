const express = require('express');
const { addCategory, getCategories, deleteCategory } = require('../../controllers/store/category.controller');
const categoryRouter = express.Router();

// Use requireAuth if you want to protect add/delete
// const { requireAuth } = require('../middleware/auth.middleware');

categoryRouter.post('/add', addCategory);      // POST /api/category/add
categoryRouter.get('/all', getCategories);     // GET  /api/category/all
categoryRouter.delete('/delete/:id', deleteCategory); // DELETE /api/category/delete/:id

module.exports = categoryRouter;