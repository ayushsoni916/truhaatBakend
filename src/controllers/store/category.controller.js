const Category = require("../../models/store/category.model");
const cloudinary = require("cloudinary").v2;

// 1. Add Category
exports.addCategory = async (req, res, next) => {
    try {
        const { name } = req.body;
        const file = req.file; // Assuming multer setup uses upload.single('image')

        if (!name) return res.status(400).json({ error: "Category name is required" });
        if (!file) return res.status(400).json({ error: "Category image is required" });

        // Check if exists
        const exists = await Category.findOne({ name });
        if (exists) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        // Upload to Cloudinary using upload_stream
        const uploadedImage = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder: "store_categories" }, (err, res) => {
                if (err) reject(err);
                else resolve({ url: res.secure_url, publicId: res.public_id });
            });
            stream.end(file.buffer);
        });

        // Save to DB with the new image object schema
        const category = await Category.create({
            name,
            image: uploadedImage
        });

        res.status(201).json({ success: true, message: "Category created", data: category });
    } catch (error) {
        next(error);
    }
};

// 2. Get All Categories
exports.getCategories = async (req, res, next) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
};

// 3. Delete Category
exports.deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Find the category first to get the Cloudinary publicId
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Delete the image from Cloudinary to save storage space
        if (category.image && category.image.publicId) {
            await cloudinary.uploader.destroy(category.image.publicId);
        }

        // Delete from Database
        await Category.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Category and its image deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Add this below your existing add/get functions
exports.updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;
        const file = req.file;

        const category = await Category.findById(id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        // If a new image is uploaded
        if (file) {
            // 1. Upload new image
            const newImage = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({ folder: "store_categories" }, (err, result) => {
                    if (err) reject(err);
                    else resolve({ url: result.secure_url, publicId: result.public_id });
                });
                stream.end(file.buffer);
            });

            // 2. Delete old image from Cloudinary
            if (category.image && category.image.publicId) {
                await cloudinary.uploader.destroy(category.image.publicId);
            }

            // 3. Set new image in DB
            category.image = newImage;
        }

        // Update other fields
        if (name) category.name = name;
        if (isActive !== undefined) category.isActive = isActive;

        await category.save();
        res.status(200).json({ success: true, message: 'Category updated', data: category });
    } catch (error) {
        next(error);
    }
};