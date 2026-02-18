const categoryModel = require("../../models/store/category.model");


// 1. Add Category
exports.addCategory = async (req, res, next) => {
    try {
        const { name, image } = req.body;

        // Check if exists
        const exists = await categoryModel.findOne({ name });
        if (exists) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const category = await categoryModel.create({ name, image });
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
};

// 2. Get All Categories
exports.getCategories = async (req, res, next) => {
    try {
        const categories = await categoryModel.find({ isActive: true }).select('name image _id');
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
};

// 3. Delete Category
exports.deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        await categoryModel.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        next(error);
    }
};