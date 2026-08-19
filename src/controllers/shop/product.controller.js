// const Product = require("../../models/Shop/product.model");
// const shopModel = require("../../models/Shop/shop.model");
// const cloudinary = require("cloudinary").v2;

// // --- 1. Add Product (with Multi-Image & Tags) ---
// exports.addProduct = async (req, res, next) => {
//     try {
//         const {
//             shopId, name, description, price, salePrice, stock,
//             categoryId, subCategoryId, tagId, subtags
//         } = req.body;

//         const files = req.files; // Array from multer
//         if (!files || files.length === 0) return res.status(400).json({ error: "Product images are required" });

//         // Upload to Cloudinary
//         const uploadPromises = files.map(file => {
//             return new Promise((resolve, reject) => {
//                 const stream = cloudinary.uploader.upload_stream({ folder: "shop_products" }, (err, res) => {
//                     if (err) reject(err); else resolve({ url: res.secure_url, publicId: res.public_id });
//                 });
//                 stream.end(file.buffer);
//             });
//         });
//         const uploadedImages = await Promise.all(uploadPromises);

//         // Parse subtags
//         const parsedSubtags = subtags ? (Array.isArray(subtags) ? subtags : subtags.split(',').map(s => s.trim())) : [];

//         const product = await Product.create({
//             shop: shopId, name, description, price, salePrice, stock,
//             images: uploadedImages,
//             category: categoryId,
//             subCategory: subCategoryId,
//             tag: tagId,
//             subtags: parsedSubtags,
//             inStock: stock > 0
//         });

//         res.status(201).json({ success: true, message: "Product listed", data: product });
//     } catch (error) { next(error); }
// };

// // // --- 2. Get Top Deals (Highest Discount %) ---
// // exports.getTopDeals = async (req, res, next) => {
// //     try {
// //         const deals = await Product.aggregate([
// //             { $match: { isActive: true, salePrice: { $lt: "$price" } } },
// //             { $addFields: {
// //                 discount: { $subtract: ["$price", "$salePrice"] },
// //                 discountPerc: { $multiply: [{ $divide: [{ $subtract: ["$price", "$salePrice"] }, "$price"] }, 100] }
// //             }},
// //             { $sort: { discountPerc: -1 } },
// //             { $limit: 10 },
// //             { $lookup: { from: "shops", localField: "shop", foreignField: "_id", as: "shop" } },
// //             { $unwind: "$shop" }
// //         ]);
// //         res.status(200).json({ success: true, data: deals });
// //     } catch (error) { next(error); }
// // };

// // --- 3. Get Shop Products ---
// // controllers/Shop/product.controller.js

// exports.getShopProducts = async (req, res, next) => {
//     try {
//         const { shopId } = req.params;
//         console.log("--- Debug: Fetching Products for Shop ---");
//         console.log("Target Shop ID from Request:", shopId);

//         // 1. Fetch products and log the raw result
//         const products = await Product.find({ shop: shopId }).lean();

//         console.log(`Found ${products.length} products in DB for this ID.`);

//         if (products.length > 0) {
//             console.log("First Product Sample:", {
//                 name: products[0].name,
//                 shopIdInDoc: products[0].shop,
//                 isActive: products[0].isActive
//             });
//         }

//         // 2. Format for your UI (matches image_348e20.png)
//         const formattedProducts = products.map(product => ({
//             ...product,
//             displayImage: product.images?.[0]?.url || product.image || null,
//             discountPercentage: product.price > 0
//                 ? Math.round(((product.price - product.salePrice) / product.price) * 100)
//                 : 0
//         }));

//         res.status(200).json({
//             success: true,
//             count: formattedProducts.length,
//             data: formattedProducts
//         });
//     } catch (error) {
//         console.error("API Error:", error);
//         next(error);
//     }
// };

// exports.getProductsByFilter = async (req, res, next) => {
//     try {
//         const { id } = req.params; // This ID could be Category, SubCategory, or Tag

//         const products = await Product.find({
//             isActive: true,
//             $or: [
//                 { category: id },
//                 { subCategory: id },
//                 { tag: id }
//             ]
//         }).lean();

//         // Debug Logs to help you verify data in terminal
//         console.log(`[Universal Filter] ID: ${id} | Found: ${products.length} products`);

//         const formattedData = products.map(p => ({
//             _id: p._id,
//             name: p.name,
//             price: p.price,
//             salePrice: p.salePrice,
//             displayImage: p.images?.[0]?.url || null,
//             discountPercentage: p.price > 0
//                 ? Math.round(((p.price - p.salePrice) / p.price) * 100)
//                 : 0,
//             shop: p.shop
//         }));

//         res.status(200).json({
//             success: true,
//             count: formattedData.length,
//             data: formattedData
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// // --- 4. Get Products by Subcategory ---
// exports.getProductsBySubCategory = async (req, res, next) => {
//     try {
//         const products = await Product.find({ subCategory: req.params.subId, isActive: true });
//         res.status(200).json({ success: true, data: products });
//     } catch (error) { next(error); }
// };

// // --- 5. Global Search (Name + Subtags) ---
// exports.searchProducts = async (req, res, next) => {
//     try {
//         const { q } = req.query; // e.g. /search?q=blue jeans
//         const products = await Product.find({
//             isActive: true,
//             $or: [
//                 { name: { $regex: q, $options: 'i' } },
//                 { subtags: { $in: [new RegExp(q, 'i')] } }
//             ]
//         }).limit(20);
//         res.status(200).json({ success: true, data: products });
//     } catch (error) { next(error); }
// };

// exports.getTopDeals = async (req, res, next) => {
//     try {
//         const { latitude, longitude, radius = 10000 } = req.query;
//         const lat = parseFloat(latitude);
//         const lng = parseFloat(longitude);

//         // 1. Find Nearby Shop IDs
//         const nearbyShops = await shopModel.find({
//             location: {
//                 $near: {
//                     $geometry: { type: "Point", coordinates: [lng, lat] },
//                     $maxDistance: parseInt(radius)
//                 }
//             }
//         }).select('_id');
//         const nearbyIds = nearbyShops.map(s => s._id);

//         // 2. Helper to fetch formatted products
//         const fetchDeals = async (matchQuery, limit) => {
//             return await Product.aggregate([
//                 { $match: { ...matchQuery, isActive: true, inStock: true, salePrice: { $exists: true } } },
//                 {
//                     $addFields: {
//                         discountPercentage: {
//                             $cond: {
//                                 if: { $gt: ["$price", 0] },
//                                 then: { $round: [{ $multiply: [{ $divide: [{ $subtract: ["$price", "$salePrice"] }, "$price"] }, 100] }, 0] },
//                                 else: 0
//                             }
//                         }
//                     }
//                 },
//                 { $sort: { discountPercentage: -1 } },
//                 { $limit: limit },
//                 {
//                     $project: {
//                         name: 1, price: 1, salePrice: 1, discountPercentage: 1,
//                         displayImage: { $arrayElemAt: ["$images.url", 0] },
//                         shop: 1
//                     }
//                 }
//             ]);
//         };

//         // 3. Get Nearby Deals
//         let finalProducts = await fetchDeals({ shop: { $in: nearbyIds } }, 10);

//         // 4. UI FILLER LOGIC: If less than 4, fetch global deals to fill the gap
//         if (finalProducts.length < 4) {
//             const needed = 4 - finalProducts.length;
//             const existingIds = finalProducts.map(p => p._id);

//             const fillerProducts = await fetchDeals({
//                 _id: { $nin: existingIds } // Don't duplicate products
//             }, needed);

//             finalProducts = [...finalProducts, ...fillerProducts];
//         }

//         res.status(200).json({
//             success: true,
//             count: finalProducts.length,
//             data: finalProducts
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// // --- Get Single Product with Shop Details ---
// exports.getProductDetailOffline = async (req, res, next) => {
//     try {
//         const { productId } = req.params;

//         // 1. Fetch product and populate the 'shop' and 'category' details
//         const product = await Product.findById(productId)
//             .populate('shop', 'name images location address rating description phone')
//             .populate('category', 'name')
//             .lean();

//         if (!product) {
//             return res.status(404).json({ success: false, message: "Product not found" });
//         }

//         // 2. Format the Product Data for the Frontend
//         const formattedProduct = {
//             ...product,
//             // Main image for the product
//             displayImage: product.images?.[0]?.url || null,
//             // Array of all product image URLs for the gallery
//             allImages: product.images?.map(img => img.url) || [],
//             // Calculate savings percentage
//             discountPercentage: product.price > 0 && product.salePrice 
//                 ? Math.round(((product.price - product.salePrice) / product.price) * 100)
//                 : 0,

//             // 3. Format the Shop Data for the "Shop" tab
//             shopDetails: product.shop ? {
//                 ...product.shop,
//                 // Extract shop logo/banner from shop images array
//                 displayImage: product.shop.images?.[0] || null, 
//                 // Useful for the "Locate Me" button
//                 coordinates: product.shop.location?.coordinates || []
//             } : null
//         };

//         res.status(200).json({
//             success: true,
//             data: formattedProduct
//         });
//     } catch (error) {
//         console.error("Fetch Product Error:", error);
//         next(error);
//     }
// };

const productModel = require("../../models/Shop/product.model");
const shopModel = require("../../models/Shop/shop.model");
// Adjust path if needed
const cloudinary = require("cloudinary").v2;

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
        const formattedProducts = products.map(product => ({
            ...product,
            // Fallback gracefully to old schema if older products exist
            displayImage: product.mainImage?.url || product.images?.[0]?.url || null,
            discountPercentage: product.basePrice > 0 && product.salePrice
                ? Math.round(((product.basePrice - product.salePrice) / product.basePrice) * 100)
                : 0
        }));

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
            displayImage: p.mainImage?.url || p.images?.[0]?.url || null,
            discountPercentage: p.basePrice > 0 && p.salePrice
                ? Math.round(((p.basePrice - p.salePrice) / p.basePrice) * 100)
                : 0,
            shop: p.shop
        }));

        res.status(200).json({ success: true, count: formattedData.length, data: formattedData });
    } catch (error) {
        next(error);
    }
};

// --- 4. Get Products by SubCategory (Specific) ---
exports.getProductsBySubCategory = async (req, res, next) => {
    try {
        const products = await productModel.find({ subCategory: req.params.subId, isActive: true });
        res.status(200).json({ success: true, data: products });
    } catch (error) { next(error); }
};

// --- 5. Global Search (Name + Keywords) ---
exports.searchProducts = async (req, res, next) => {
    try {
        const { q } = req.query;
        const products = await productModel.find({
            isActive: true,
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { searchKeywords: { $in: [new RegExp(q, 'i')] } }
            ]
        }).limit(20);
        res.status(200).json({ success: true, data: products });
    } catch (error) { next(error); }
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
                { $match: { ...matchQuery, isActive: true, inStock: true, salePrice: { $exists: true } } },
                {
                    $addFields: {
                        discountPercentage: {
                            $cond: {
                                if: { $gt: ["$basePrice", 0] },
                                then: { $round: [{ $multiply: [{ $divide: [{ $subtract: ["$basePrice", "$salePrice"] }, "$basePrice"] }, 100] }, 0] },
                                else: 0
                            }
                        }
                    }
                },
                { $sort: { discountPercentage: -1 } },
                { $limit: limit },
                {
                    $project: {
                        name: 1, basePrice: 1, salePrice: 1, discountPercentage: 1,
                        displayImage: "$mainImage.url",
                        shop: 1
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
            displayImage: product.mainImage?.url || product.images?.[0]?.url || null,
            allImages: allImages,
            discountPercentage: product.basePrice > 0 && product.salePrice
                ? Math.round(((product.basePrice - product.salePrice) / product.basePrice) * 100)
                : 0,

            shopDetails: product.shop ? {
                ...product.shop,
                displayImage: product.shop.images?.[0] || null,
                coordinates: product.shop.location?.coordinates || []
            } : null
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