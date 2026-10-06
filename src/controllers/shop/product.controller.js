const productModel = require("../../models/Shop/product.model");
const shopModel = require("../../models/Shop/shop.model");
// Adjust path if needed
const cloudinary = require("cloudinary").v2;

const round2 = value =>
    Number(Number(value || 0).toFixed(2));

const getProductPriceFields = product => {
    const basePrice = Number(
        product.basePrice || 0
    );

    const salePrice = Number(
        product.salePrice
    );

    const gstPercentage = Number(
        product.gstPercentage || 0
    );

    const hasSalePrice =
        Number.isFinite(salePrice) &&
        salePrice > 0 &&
        salePrice < basePrice;

    const sellingPriceBeforeGst =
        hasSalePrice
            ? salePrice
            : basePrice;

    const originalFinalPrice = round2(
        basePrice *
        (1 + gstPercentage / 100)
    );

    const finalPrice = round2(
        sellingPriceBeforeGst *
        (1 + gstPercentage / 100)
    );

    const discountPercentage =
        hasSalePrice && basePrice > 0
            ? Math.round(
                (
                    (basePrice - salePrice) /
                    basePrice
                ) * 100
            )
            : 0;

    return {
        sellingPriceBeforeGst,
        originalFinalPrice,
        finalPrice,
        discountPercentage
    };
};

// --- 1. Add Product (Updated for Variant-Specific Specifications) ---
exports.addProduct = async (req, res, next) => {
    try {
        const shopId = req.user._id;
        const fixedCategoryId = req.user.doc.firmCategory;

        if (!fixedCategoryId) {
            return res.status(400).json({ success: false, error: "Your shop profile is missing a firm category." });
        }

        // Handle Images
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, error: "At least one product image is required" });
        }

        const uploadPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({ folder: "shop_products" }, (err, result) => {
                    if (err) reject(err);
                    else resolve({ url: result.secure_url, publicId: result.public_id });
                });
                stream.end(file.buffer);
            });
        });
        const uploadedImages = await Promise.all(uploadPromises);

        const mainImage = uploadedImages[0];
        const additionalImages = uploadedImages.slice(1);

        // Parse JSON arrays
        const hasVariants = req.body.hasVariants === 'true';
        let specifications = req.body.specifications ? JSON.parse(req.body.specifications) : [];
        let variants = req.body.variants ? JSON.parse(req.body.variants) : [];
        const searchKeywords = req.body.searchKeywords ? JSON.parse(req.body.searchKeywords) : [];

        if (searchKeywords.length > 5) {
            return res.status(400).json({ success: false, error: "You can only add up to 5 search keywords." });
        }

        // BACKEND SAFEGUARD: Mutually exclusive specifications and stock
        if (hasVariants) {
            specifications = []; // Clear global specs if variants are used
        } else {
            variants = []; // Clear variants if turned off
        }

        // Create the Product
        const product = await productModel.create({
            shop: shopId,
            name: req.body.name,
            description: req.body.description,
            category: fixedCategoryId,
            subCategory: req.body.subCategory,
            tag: req.body.tag,
            searchKeywords: searchKeywords,

            basePrice: Number(req.body.basePrice),
            salePrice: req.body.salePrice ? Number(req.body.salePrice) : undefined,
            gstPercentage: Number(req.body.gstPercentage),
            hsnCode: req.body.hsnCode,

            mainImage: mainImage,
            images: additionalImages,

            // DYNAMIC DATA (Automatically parses nested specs inside variants)
            hasVariants: hasVariants,
            totalStock: hasVariants ? 0 : (Number(req.body.totalStock) || 0),
            specifications: specifications, // Global specs
            variants: variants, // Variant array (now contains size, color, stock, sku, and specifications[])

            inStock: req.body.inStock !== 'false',
            isActive: req.body.isActive !== 'false'
        });

        res.status(201).json({ success: true, message: "Product listed successfully", data: product });
    } catch (error) {
        console.error("Add Shop Product Error:", error);
        next(error);
    }
};

// --- 2. Get Shop Products ---
exports.getShopProducts = async (req, res, next) => {
    try {
        const { shopId } = req.params;

        const products = await productModel.find({ shop: shopId }).lean();

        // Format for UI
        const formattedProducts = products.map(
            product => ({
                ...product,

                displayImage:
                    product.mainImage?.url ||
                    product.images?.[0]?.url ||
                    null,

                ...getProductPriceFields(product)
            })
        );

        res.status(200).json({
            success: true,
            count: formattedProducts.length,
            data: formattedProducts
        });
    } catch (error) {
        console.error("API Error:", error);
        next(error);
    }
};

// --- 3. Get Products by Filter (Universal) ---
exports.getProductsByFilter = async (req, res, next) => {
    try {
        const { id } = req.params; // Category, SubCategory, or Tag ID

        const products = await productModel.find({
            isActive: true,
            $or: [
                { category: id },
                { subCategory: id },
                { tag: id }
            ]
        }).lean();

        const formattedData = products.map(p => ({
            _id: p._id,
            name: p.name,

            basePrice: p.basePrice,
            salePrice: p.salePrice,
            gstPercentage: p.gstPercentage,
            hsnCode: p.hsnCode,

            displayImage:
                p.mainImage?.url ||
                p.images?.[0]?.url ||
                null,

            ...getProductPriceFields(p),

            shop: p.shop
        }));

        res.status(200).json({ success: true, count: formattedData.length, data: formattedData });
    } catch (error) {
        next(error);
    }
};

// --- 4. Get Products by SubCategory (Specific) ---
exports.getProductsBySubCategory =
    async (req, res, next) => {
        try {
            const products =
                await productModel.find({
                    subCategory:
                        req.params.subId,

                    isActive: true,
                    adminDisabled: false
                }).lean();

            const formattedProducts =
                products.map(product => ({
                    ...product,

                    displayImage:
                        product.mainImage?.url ||
                        product.images?.[0]?.url ||
                        null,

                    ...getProductPriceFields(
                        product
                    )
                }));

            return res.status(200).json({
                success: true,
                data: formattedProducts
            });
        } catch (error) {
            next(error);
        }
    };

// --- 5. Global Search (Name + Keywords) ---
exports.searchProducts = async (
    req,
    res,
    next
) => {
    try {
        const searchText = String(
            req.query.q || ''
        ).trim();

        if (!searchText) {
            return res.status(400).json({
                success: false,
                message: 'Search text is required'
            });
        }

        const escapedSearch =
            searchText.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            );

        const searchRegex = new RegExp(
            escapedSearch,
            'i'
        );

        const products =
            await productModel.find({
                isActive: true,

                // Also includes older products where
                // adminDisabled does not exist.
                adminDisabled: {
                    $ne: true
                },

                $or: [
                    {
                        name: searchRegex
                    },
                    {
                        searchKeywords:
                            searchRegex
                    }
                ]
            })
                .limit(20)
                .lean();

        const formattedProducts =
            products.map(product => ({
                ...product,

                displayImage:
                    product.mainImage?.url ||
                    product.images?.[0]?.url ||
                    null,

                ...getProductPriceFields(
                    product
                )
            }));

        return res.status(200).json({
            success: true,
            data: formattedProducts
        });
    } catch (error) {
        next(error);
    }
};

// --- 6. Get Top Deals (Location Based) ---
exports.getTopDeals = async (req, res, next) => {
    try {
        const { latitude, longitude, radius = 10000 } = req.query;
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        const nearbyShops = await shopModel.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: parseInt(radius)
                }
            }
        }).select('_id');
        const nearbyIds = nearbyShops.map(s => s._id);

        const fetchDeals = async (matchQuery, limit) => {
            return await productModel.aggregate([
                {
                    $match: {
                        ...matchQuery,
                        isActive: true,
                        adminDisabled: false, // STRICT CHECK: Hide admin suspended products
                        salePrice: { $exists: true, $gt: 0 },
                        // STRICT STOCK CHECK: Must have physical stock > 0
                        $or: [
                            { hasVariants: false, totalStock: { $gt: 0 } },
                            { hasVariants: true, "variants.stock": { $gt: 0 } }
                        ]
                    }
                },
                {
                    $addFields: {
                        // Use basePrice or price depending on what exists
                        calcPrice: { $ifNull: ["$basePrice", "$price"] }
                    }
                },
                {
                    $addFields: {
                        discountPercentage: {
                            $cond: {
                                if: { $gt: ["$calcPrice", 0] },
                                then: { $round: [{ $multiply: [{ $divide: [{ $subtract: ["$calcPrice", "$salePrice"] }, "$calcPrice"] }, 100] }, 0] },
                                else: 0
                            }
                        }
                    }
                },
                { $sort: { discountPercentage: -1 } },
                { $limit: limit },
                {
                    $project: {
                        name: 1,
                        basePrice: 1,
                        price: 1,
                        salePrice: 1,
                        discountPercentage: 1,
                        shop: 1,
                        gstPercentage: 1,
                        hsnCode: 1,
                        // SMART MAPPING FOR IMAGES
                        displayImage: {
                            $ifNull: [
                                "$mainImage.url",
                                { $arrayElemAt: ["$images.url", 0] }
                            ]
                        }
                    }
                }
            ]);
        };

        let finalProducts = await fetchDeals({ shop: { $in: nearbyIds } }, 10);

        if (finalProducts.length < 4) {
            const needed = 4 - finalProducts.length;
            const existingIds = finalProducts.map(p => p._id);
            const fillerProducts = await fetchDeals({ _id: { $nin: existingIds } }, needed);
            finalProducts = [...finalProducts, ...fillerProducts];
        }

        finalProducts = finalProducts.map(
            product => ({
                ...product,
                ...getProductPriceFields(product)
            })
        );

        res.status(200).json({ success: true, count: finalProducts.length, data: finalProducts });
    } catch (error) {
        next(error);
    }
};

// --- 7. Get Single Product with Shop Details ---
exports.getProductDetailOffline = async (req, res, next) => {
    try {
        const { productId } = req.params;

        const product = await productModel.findById(productId)
            .populate('shop', 'name images location address rating description phone')
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .populate('tag', 'name')
            .lean();

        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        // Compile all images (mainImage + gallery images)
        let allImages = [];
        if (product.mainImage?.url) allImages.push(product.mainImage.url);
        if (product.images?.length > 0) {
            allImages = [...allImages, ...product.images.map(img => img.url)];
        }

        const formattedProduct = {
            ...product,

            displayImage:
                product.mainImage?.url ||
                product.images?.[0]?.url ||
                null,

            allImages,

            ...getProductPriceFields(product),

            shopDetails: product.shop
                ? {
                    ...product.shop,

                    displayImage:
                        product.shop.images?.[0] ||
                        null,

                    coordinates:
                        product.shop.location
                            ?.coordinates || []
                }
                : null
        };

        res.status(200).json({ success: true, data: formattedProduct });
    } catch (error) {
        console.error("Fetch Product Error:", error);
        next(error);
    }
};

// --- Get Products of a Specific Shop (For Admin Panel) ---
exports.getAdminShopProducts = async (req, res, next) => {
    try {
        const { shopId } = req.params;
        const { search, subCategory } = req.query;

        let query = { shop: shopId };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (subCategory) {
            query.subCategory = subCategory;
        }

        const products = await productModel.find(query)
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .populate('tag', 'name')
            .populate('shop', 'name phone owner')
            .sort({ createdAt: -1 })
            .lean();

        const formattedProducts = products.map(product => ({
            ...product,
            displayImage: product.mainImage?.url || product.images?.[0]?.url || null,
            calculatedStock: product.hasVariants && product.variants?.length > 0
                ? product.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
                : (product.totalStock || 0)
        }));

        res.status(200).json({
            success: true,
            count: formattedProducts.length,
            data: formattedProducts
        });
    } catch (error) {
        console.error("getAdminShopProducts error:", error);
        next(error);
    }
};

// --- 9. Admin Disable/Enable Products (Bulk) ---
exports.toggleAdminDisableProducts = async (req, res, next) => {
    try {
        const { productIds, disable } = req.body; // disable should be a boolean (true/false)

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ success: false, error: "Please provide an array of product IDs." });
        }

        // Update all provided product IDs at once
        await productModel.updateMany(
            { _id: { $in: productIds } },
            { $set: { adminDisabled: Boolean(disable) } }
        );

        res.status(200).json({
            success: true,
            message: `Successfully ${disable ? 'disabled' : 'enabled'} ${productIds.length} product(s).`
        });
    } catch (error) {
        console.error("Toggle Admin Disable Error:", error);
        next(error);
    }
};