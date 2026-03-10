const express = require('express');
const { addProduct, getProducts, getProductById } = require('../../controllers/store/product.controller');
const { getProductDetailOffline } = require('../../controllers/shop/product.controller');
const productRouter = express.Router();

productRouter.post('/add', addProduct);        // POST /api/product/add
productRouter.get('/all', getProducts);        // GET  /api/product/all?categoryId=...
productRouter.get('/:id', getProductById);     // GET  /api/product/:id

module.exports = productRouter;