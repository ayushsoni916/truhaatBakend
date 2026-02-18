const productModel = require("../../models/store/product.model");

// 1. Add Product
exports.addProduct = async (req, res, next) => {
    try {
        const { name, categoryId, price, description, mainImage, images, stock } = req.body;

        const product = await productModel.create({
            name,
            category: categoryId, // Must match the ObjectId of a Category
            price,
            description,
            mainImage,
            images,
            stock
        });

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
};

// 2. Get All Products (With Optional Category Filter)
exports.getProducts = async (req, res, next) => {
    try {
        const { categoryId } = req.query;
        let query = { isActive: true };

        // If user sends ?categoryId=123, filter by that category
        if (categoryId) {
            query.category = categoryId;
        }

        // .populate('category') will replace the ID with the actual Category name/image
        const products = await productModel.find(query).populate('category', 'name');

        res.status(200).json({ success: true, data: products });
    } catch (error) {
        next(error);
    }
};

// 3. Get Single Product
exports.getProductById = async (req, res, next) => {
    try {
        const product = await productModel.findById(req.params.id).populate('category', 'name');
        if (!product) return res.status(404).json({ error: 'Product not found' });

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
};