const productModel = require("../../models/store/product.model");
const cloudinary = require("cloudinary").v2;
// 1. Add Product
exports.addProduct = async (req, res, next) => {
    try {
        const files = req.files; // Array of images from multer
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "At least one product image is required" });
        }

        // 1. Upload all images to Cloudinary in parallel
        const uploadPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({ folder: "store_products" }, (err, result) => {
                    if (err) reject(err);
                    else resolve({ url: result.secure_url, publicId: result.public_id });
                });
                stream.end(file.buffer);
            });
        });
        const uploadedImages = await Promise.all(uploadPromises);

        // First image is mainImage, rest go to images array
        const mainImage = uploadedImages[0];
        const additionalImages = uploadedImages.slice(1);

        // 2. Parse JSON strings from FormData
        // Frontend sends arrays/objects as strings in FormData, so we must parse them
        const specifications = req.body.specifications ? JSON.parse(req.body.specifications) : [];
        const variants = req.body.variants ? JSON.parse(req.body.variants) : [];
        const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
        const searchKeywords = req.body.searchKeywords ? JSON.parse(req.body.searchKeywords) : [];

        // 3. Create the Product
        const product = await productModel.create({
            name: req.body.name,
            description: req.body.description,
            gender: req.body.gender || undefined,
            category: req.body.category,
            subCategory: req.body.subCategory,
            tags: tags,
            searchKeywords: searchKeywords,
            basePrice: req.body.basePrice,
            salePrice: req.body.salePrice || undefined,
            gstPercentage: req.body.gstPercentage,
            hsnCode: req.body.hsnCode,
            mainImage: mainImage,
            images: additionalImages,
            specifications: specifications,
            hasVariants: req.body.hasVariants === 'true',
            totalStock: req.body.totalStock || 0,
            variants: variants,
            inStock: req.body.inStock !== 'false',
            isActive: req.body.isActive !== 'false'
        });

        res.status(201).json({ success: true, message: "Product created successfully", data: product });
    } catch (error) {
        next(error);
    }
};

// 2. Get All Products (Admin - with Pagination & Search)
exports.getProducts = async (req, res, next) => {
    try {
        const { categoryId, search, page = 1, limit = 10 } = req.query;
        let query = {}; // Admin needs to see all products, even inactive ones

        if (categoryId) {
            query.category = categoryId;
        }

        if (search) {
            // Case-insensitive search on product name
            query.name = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const products = await productModel.find(query)
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .populate('tags', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await productModel.countDocuments(query);

        res.status(200).json({
            success: true,
            data: products,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
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

// 4. Delete Product (And clean up Cloudinary images)
exports.deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        // 1. Find the product first to get the image publicIds
        const product = await productModel.findById(id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // 2. Prepare Cloudinary deletion promises
        const deletePromises = [];

        // Check mainImage (Handles new object format securely, ignores old string format)
        if (product.mainImage && product.mainImage.publicId) {
            deletePromises.push(cloudinary.uploader.destroy(product.mainImage.publicId));
        }

        // Check additional images array
        if (product.images && Array.isArray(product.images)) {
            product.images.forEach(img => {
                if (img && img.publicId) {
                    deletePromises.push(cloudinary.uploader.destroy(img.publicId));
                }
            });
        }

        // Execute all image deletions in parallel (we catch errors so if an image is already missing, it still deletes the DB record)
        if (deletePromises.length > 0) {
            await Promise.all(deletePromises.map(p => p.catch(err => console.error("Cloudinary delete error:", err))));
        }

        // 3. Delete the product from MongoDB
        await productModel.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: 'Product and associated images deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Add inside product.controller.js
exports.updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await productModel.findById(id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        // 1. Handle Images
        // Frontend sends 'keptImages' array containing the old Cloudinary objects the user did NOT delete
        let keptImages = req.body.keptImages ? JSON.parse(req.body.keptImages) : [];
        if (!Array.isArray(keptImages)) keptImages = [keptImages];

        // Upload any newly added files
        const files = req.files || [];
        const uploadPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({ folder: "store_products" }, (err, result) => {
                    if (err) reject(err); else resolve({ url: result.secure_url, publicId: result.public_id });
                });
                stream.end(file.buffer);
            });
        });
        const newUploadedImages = await Promise.all(uploadPromises);

        // Combine kept old images + newly uploaded images
        const finalImagesList = [...keptImages, ...newUploadedImages];
        if (finalImagesList.length === 0) {
            return res.status(400).json({ error: "At least one product image is required" });
        }

        const mainImage = finalImagesList[0];
        const additionalImages = finalImagesList.slice(1);

        // 2. Cleanup deleted images from Cloudinary
        const allOriginalImages = [product.mainImage, ...product.images].filter(Boolean);
        const keptPublicIds = keptImages.map(img => img.publicId);

        const imagesToDelete = allOriginalImages.filter(img => img.publicId && !keptPublicIds.includes(img.publicId));
        imagesToDelete.forEach(img => {
            cloudinary.uploader.destroy(img.publicId).catch(err => console.error("Cloudinary delete error:", err));
        });

        // 3. Update Product Fields
        product.name = req.body.name || product.name;
        product.description = req.body.description || product.description;
        product.gender = req.body.gender || undefined;
        product.category = req.body.category || product.category;
        product.subCategory = req.body.subCategory || product.subCategory;

        product.tags = req.body.tags ? JSON.parse(req.body.tags) : product.tags;
        product.searchKeywords = req.body.searchKeywords ? JSON.parse(req.body.searchKeywords) : product.searchKeywords;

        product.basePrice = req.body.basePrice || product.basePrice;
        product.salePrice = req.body.salePrice || undefined;
        product.gstPercentage = req.body.gstPercentage || product.gstPercentage;
        product.hsnCode = req.body.hsnCode || product.hsnCode;

        product.specifications = req.body.specifications ? JSON.parse(req.body.specifications) : product.specifications;

        if (req.body.hasVariants !== undefined) product.hasVariants = req.body.hasVariants === 'true';
        if (req.body.totalStock !== undefined) product.totalStock = req.body.totalStock;
        if (req.body.variants) product.variants = JSON.parse(req.body.variants);

        if (req.body.inStock !== undefined) product.inStock = req.body.inStock === 'true';
        if (req.body.isActive !== undefined) product.isActive = req.body.isActive === 'true';

        product.mainImage = mainImage;
        product.images = additionalImages;

        await product.save();
        res.status(200).json({ success: true, message: "Product updated successfully", data: product });
    } catch (error) {
        next(error);
    }
};

// DON'T FORGET to add this to your routes:
// productRouter.put('/update/:id', upload.array('images', 5), updateProduct);