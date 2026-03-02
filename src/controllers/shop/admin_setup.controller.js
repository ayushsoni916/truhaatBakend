const ShopCategory = require("../../models/Shop/category.model");
const ShopSubCategory = require("../../models/Shop/subcategory.model");
const ShopTag = require("../../models/Shop/tags.model");
const cloudinary = require("cloudinary").v2; // Ensure cloudinary is configured

// Helper for Cloudinary Upload
const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: folder },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        uploadStream.end(fileBuffer);
    });
};

// ================= CATEGORY LOGIC =================
exports.addCategory = async (req, res, next) => {
    try {
        const { name } = req.body;
        const file = req.file;

        if (!name || !file) {
            return res.status(400).json({ error: "Category name and image are required" });
        }

        const imageUrl = await uploadToCloudinary(file.buffer, "shop_categories");

        const data = await ShopCategory.create({
            name,
            image: imageUrl
        });

        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
};

// ================= SUBCATEGORY LOGIC =================
exports.addSubCategory = async (req, res, next) => {
    try {
        const { name, parentCategoryId } = req.body;
        const file = req.file;

        if (!name || !parentCategoryId || !file) {
            return res.status(400).json({ error: "Name, Parent Category, and Image are required" });
        }

        const imageUrl = await uploadToCloudinary(file.buffer, "shop_subcategories");

        const data = await ShopSubCategory.create({
            name,
            parentCategory: parentCategoryId,
            image: imageUrl
        });

        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
};

// ================= TAG LOGIC (No Image Needed) =================
exports.addTag = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Tag name is required" });

        const data = await ShopTag.create({ name });
        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
};

// ================= GET & DELETE (Standard) =================
exports.getCategories = async (req, res, next) => {
    try {
        const data = await ShopCategory.find({ isActive: true });
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

exports.getCategoriesWithSubcategories = async (req, res, next) => {
    try {
        const data = await ShopCategory.aggregate([
            {
                $match: { isActive: true }
            },
            {
                $lookup: {
                    from: "shopsubcategories",     // Must match your actual collection name in MongoDB
                    localField: "_id",             // Category _id
                    foreignField: "parentCategory",// Subcategory parentCategory field
                    as: "subCategories"            // Name of the array in the response
                }
            },
            {
                $sort: { createdAt: 1 } // Optional: Sort categories by date
            }
        ]);

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

exports.getSubCategories = async (req, res, next) => {
    try {
        const { parentId } = req.query;
        const filter = parentId ? { parentCategory: parentId, isActive: true } : { isActive: true };
        const data = await ShopSubCategory.find(filter).populate('parentCategory', 'name');
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

exports.getTags = async (req, res, next) => {
    try {
        const data = await ShopTag.find({ isActive: true });
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};


exports.deleteCategory = async (req, res, next) => {
    try {
        await ShopCategory.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Category deleted" });
    } catch (error) { next(error); }
};


exports.deleteSubCategory = async (req, res, next) => {
    try {
        await ShopSubCategory.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "SubCategory deleted" });
    } catch (error) { next(error); }
};


exports.deleteTag = async (req, res, next) => {
    try {
        await ShopTag.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Tag deleted" });
    } catch (error) { next(error); }
};