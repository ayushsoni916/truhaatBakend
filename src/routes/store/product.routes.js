const express = require('express');
const multer = require('multer');
const { addProduct, getProducts, getProductById, deleteProduct, updateProduct } = require('../../controllers/store/product.controller');
const { getProductDetailOffline } = require('../../controllers/shop/product.controller');

const upload = multer({ storage: multer.memoryStorage() });

const productRouter = express.Router();

productRouter.post('/add', upload.array('images', 5), addProduct);       // POST /api/product/add
productRouter.get('/all', getProducts);        // GET  /api/product/all?categoryId=...
productRouter.get('/:id', getProductById);     // GET  /api/product/:id
productRouter.delete('/delete/:id', deleteProduct);
productRouter.put('/update/:id', upload.array('images', 5), updateProduct);

module.exports = productRouter;