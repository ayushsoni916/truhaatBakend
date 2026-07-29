const SubCategory = require("../../models/store/subCategory.model");
const cloudinary = require("cloudinary").v2;

// 1. Add SubCategory
exports.addSubCategory = async (req, res, next) => {
    try {
        const { name, parentCategory } = req.body;
        const file = req.file; // From multer: upload.single('image')

        if (!name || !parentCategory) return res.status(400).json({ error: "Name and parentCategory are required" });
        if (!file) return res.status(400).json({ error: "SubCategory image is required" });

        // Check if exists (preventing duplicate subcategory under the SAME parent)
        const exists = await SubCategory.findOne({ name, parentCategory });
        if (exists) {
            return res.status(400).json({ error: 'SubCategory already exists under this category' });
        }

        // Upload to Cloudinary
        const uploadedImage = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder: "store_subcategories" }, (err, res) => {
                if (err) reject(err); 
                else resolve({ url: res.secure_url, publicId: res.public_id });
            });
            stream.end(file.buffer);
        });

        // Save to DB
        const subCategory = await SubCategory.create({ 
            name, 
            parentCategory,
            image: uploadedImage 
        });

        res.status(201).json({ success: true, message: "SubCategory created", data: subCategory });
    } catch (error) {
        next(error);
    }
};

// 2. Get SubCategories (With optional filtering by parent category)
exports.getSubCategories = async (req, res, next) => {
    try {
        // Allow frontend to fetch all, OR fetch by specific category: /api/subcategories?categoryId=123
        const filter = { isActive: true };
        if (req.query.categoryId) {
            filter.parentCategory = req.query.categoryId;
        }

        // Populate the parent category name so the frontend knows what it belongs to
        const subCategories = await SubCategory.find(filter).populate('parentCategory', 'name');
        
        res.status(200).json({ success: true, data: subCategories });
    } catch (error) {
        next(error);
    }
};

// 3. Delete SubCategory
exports.deleteSubCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Find the subcategory to get publicId
        const subCategory = await SubCategory.findById(id);
        if (!subCategory) {
            return res.status(404).json({ error: 'SubCategory not found' });
        }

        // Delete image from Cloudinary
        if (subCategory.image && subCategory.image.publicId) {
            await cloudinary.uploader.destroy(subCategory.image.publicId);
        }

        // Delete from Database
        await SubCategory.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'SubCategory and its image deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Add this below your existing add/get functions
exports.updateSubCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, parentCategory, isActive } = req.body;
        const file = req.file;

        const subCategory = await SubCategory.findById(id);
        if (!subCategory) return res.status(404).json({ error: 'SubCategory not found' });

        // If a new image is uploaded
        if (file) {
            const newImage = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({ folder: "store_subcategories" }, (err, result) => {
                    if (err) reject(err);
                    else resolve({ url: result.secure_url, publicId: result.public_id });
                });
                stream.end(file.buffer);
            });

            if (subCategory.image && subCategory.image.publicId) {
                await cloudinary.uploader.destroy(subCategory.image.publicId);
            }
            subCategory.image = newImage;
        }

        if (name) subCategory.name = name;
        if (parentCategory) subCategory.parentCategory = parentCategory;
        if (isActive !== undefined) subCategory.isActive = isActive;

        await subCategory.save();
        res.status(200).json({ success: true, message: 'SubCategory updated', data: subCategory });
    } catch (error) {
        next(error);
    }
};