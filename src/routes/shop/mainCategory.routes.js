const express = require('express');
const { addMainCategory, getMainCategories, deleteMainCategory } = require('../../controllers/shop/mainCategory.controller');

const mainCategoryRouter = express.Router();

mainCategoryRouter.post('/add', addMainCategory);
mainCategoryRouter.get('/all', getMainCategories);
mainCategoryRouter.delete('/:id', deleteMainCategory);

module.exports = mainCategoryRouter;