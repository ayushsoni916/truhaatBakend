const MainShopCategory = require("../../models/Shop/mainCategory.model");

exports.addMainCategory = async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name) return res.status(400).json({ error: "Main category name is required" });

        const data = await MainShopCategory.create({ name });
        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
};

exports.getMainCategories = async (req, res, next) => {
    try {
        const data = await MainShopCategory.find({ isActive: true });
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

exports.deleteMainCategory = async (req, res, next) => {
    try {
        await MainShopCategory.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Main Shop Category deleted" });
    } catch (error) { next(error); }
};