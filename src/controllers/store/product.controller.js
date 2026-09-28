const categoryModel = require("../../models/store/category.model");
const productModel = require("../../models/store/product.model");
const cloudinary = require("cloudinary").v2;

// 1. Add Product
exports.addProduct = async (req, res, next) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "At least one product image is required" });
        }

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

        const mainImage = uploadedImages[0];
        const additionalImages = uploadedImages.slice(1);

        // Parse JSON strings from FormData
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
            specifications: specifications, // Global specs
            hasVariants: req.body.hasVariants === 'true',
            totalStock: req.body.totalStock || 0,
            variants: variants, // Contains nested specs automatically parsed
            inStock: req.body.inStock !== 'false',
            isActive: req.body.isActive !== 'false'
        });

        res.status(201).json({ success: true, message: "Product created successfully", data: product });
    } catch (error) {
        next(error);
    }
};

// 2. Get All Products (Admin)
exports.getProducts = async (req, res, next) => {
    try {
        const {
            categoryId,
            subCategoryId,
            search,
            page = 1,
            limit = 10
        } = req.query;

        const query = {};

        if (categoryId) query.category = categoryId;
        if (subCategoryId) query.subCategory = subCategoryId;

        if (search) {
            query.name = {
                $regex: search,
                $options: 'i'
            };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const products = await productModel.find(query)
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .populate('tags', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const formattedProducts = products.map(product => {
            const hasSalePrice =
                product.salePrice !== null &&
                product.salePrice !== undefined &&
                Number(product.salePrice) > 0 &&
                Number(product.salePrice) < Number(product.basePrice);

            const sellingPrice = hasSalePrice
                ? Number(product.salePrice)
                : Number(product.basePrice);

            const gstPercentage = Number(
                product.gstPercentage || 0
            );

            const finalPrice = Number(
                (
                    sellingPrice *
                    (1 + gstPercentage / 100)
                ).toFixed(2)
            );

            const discountPercentage = hasSalePrice
                ? Math.round(
                    (
                        (product.basePrice - product.salePrice) /
                        product.basePrice
                    ) * 100
                )
                : 0;

            return {
                ...product,
                finalPrice,
                discountPercentage
            };
        });

        const total = await productModel.countDocuments(query);

        res.status(200).json({
            success: true,
            data: formattedProducts,
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
        const product = await productModel
            .findById(req.params.id)
            .populate('category', 'name')
            .lean();

        if (!product) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        const hasSalePrice =
            product.salePrice !== null &&
            product.salePrice !== undefined &&
            Number(product.salePrice) > 0 &&
            Number(product.salePrice) < Number(product.basePrice);

        const sellingPrice = hasSalePrice
            ? Number(product.salePrice)
            : Number(product.basePrice);

        const gstPercentage = Number(
            product.gstPercentage || 0
        );

        const finalPrice = Number(
            (
                sellingPrice *
                (1 + gstPercentage / 100)
            ).toFixed(2)
        );

        const originalFinalPrice = Number(
            (
                Number(product.basePrice) *
                (1 + gstPercentage / 100)
            ).toFixed(2)
        );

        const discountPercentage = hasSalePrice
            ? Math.round(
                (
                    (product.basePrice - product.salePrice) /
                    product.basePrice
                ) * 100
            )
            : 0;

        res.status(200).json({
            success: true,
            data: {
                ...product,
                finalPrice,
                originalFinalPrice,
                discountPercentage
            }
        });
    } catch (error) {
        next(error);
    }
};

// 4. Delete Product
exports.deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await productModel.findById(id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const deletePromises = [];

        if (product.mainImage && product.mainImage.publicId) {
            deletePromises.push(cloudinary.uploader.destroy(product.mainImage.publicId));
        }

        if (product.images && Array.isArray(product.images)) {
            product.images.forEach(img => {
                if (img && img.publicId) {
                    deletePromises.push(cloudinary.uploader.destroy(img.publicId));
                }
            });
        }

        if (deletePromises.length > 0) {
            await Promise.all(deletePromises.map(p => p.catch(err => console.error("Cloudinary delete error:", err))));
        }

        await productModel.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: 'Product and associated images deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// 5. Update Product
exports.updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await productModel.findById(id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        let keptImages = req.body.keptImages ? JSON.parse(req.body.keptImages) : [];
        if (!Array.isArray(keptImages)) keptImages = [keptImages];

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

        const finalImagesList = [...keptImages, ...newUploadedImages];
        if (finalImagesList.length === 0) {
            return res.status(400).json({ error: "At least one product image is required" });
        }

        const mainImage = finalImagesList[0];
        const additionalImages = finalImagesList.slice(1);

        const allOriginalImages = [product.mainImage, ...product.images].filter(Boolean);
        const keptPublicIds = keptImages.map(img => img.publicId);

        const imagesToDelete = allOriginalImages.filter(img => img.publicId && !keptPublicIds.includes(img.publicId));
        imagesToDelete.forEach(img => {
            cloudinary.uploader.destroy(img.publicId).catch(err => console.error("Cloudinary delete error:", err));
        });

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

        // This easily handles the new nested specifications inside variants
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

exports.getHomeFeed = async (req, res, next) => {
    try {
        // 1. Fetch all active categories (For the top tabs)
        const categories = await categoryModel.find({ isActive: true }).lean();

        // 2. Fetch the top 5 products for EACH category efficiently in parallel
        const categorySections = await Promise.all(
            categories.map(async (cat) => {
                // We only .select() the fields the UI actually needs, saving massive bandwidth
                const products = await productModel.find({ category: cat._id, isActive: true })
                    .select('name basePrice salePrice gstPercentage mainImage category')
                    .limit(5)
                    .lean();

                return {
                    categoryId: cat._id,
                    categoryName: cat.name,
                    // Calculate discount percentage on the backend
                    products: products.map(p => {
                        const hasSalePrice =
                            p.salePrice !== null &&
                            p.salePrice !== undefined &&
                            Number(p.salePrice) < Number(p.basePrice);

                        const taxablePrice = hasSalePrice
                            ? Number(p.salePrice)
                            : Number(p.basePrice);

                        const gstPercentage = Number(p.gstPercentage || 0);

                        const finalPrice = Number(
                            (taxablePrice * (1 + gstPercentage / 100)).toFixed(2)
                        );

                        const originalFinalPrice = Number(
                            (Number(p.basePrice) * (1 + gstPercentage / 100)).toFixed(2)
                        );

                        return {
                            _id: p._id,
                            name: p.name,

                            basePrice: p.basePrice,
                            salePrice: p.salePrice,
                            gstPercentage,

                            finalPrice,
                            originalFinalPrice,

                            mainImage: p.mainImage?.url,
                            category: p.category,

                            discountPercentage: hasSalePrice
                                ? Math.round(
                                    ((p.basePrice - p.salePrice) / p.basePrice) * 100
                                )
                                : 0
                        };
                    })
                };
            })
        );

        // 3. Filter out any categories that don't have any products yet
        const activeSections = categorySections.filter(sec => sec.products.length > 0);

        // 4. Send everything in one payload
        res.status(200).json({
            success: true,
            data: {
                categories: categories,
                sections: activeSections
            }
        });
    } catch (error) {
        next(error);
    }
};