const categoryModel = require("../../models/Shop/category.model");
const productModel = require("../../models/Shop/product.model");
const shopModel = require("../../models/Shop/shop.model");
const subcategoryModel = require("../../models/Shop/subcategory.model");


// --- 1. Add Main Category ---
exports.addCategory = async (req, res, next) => {
    try {
        const { name, image } = req.body;
        const category = await categoryModel.create({ name, image });
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
};

// --- 2. Add SubCategory ---
exports.addSubCategory = async (req, res, next) => {
    try {
        const { name, parentCategoryId, image } = req.body;

        const subCategory = await subcategoryModel.create({
            name,
            parentCategory: parentCategoryId,
            image
        });

        res.status(201).json({ success: true, data: subCategory });
    } catch (error) {
        next(error);
    }
};

// --- 3. Get All Categories (with Subcategories) ---
exports.getAllCategories = async (req, res, next) => {
    try {
        const categories = await categoryModel.find({ isActive: true });

        // Optional: You can also fetch subcategories here if needed for the UI tree
        // For now, just returning main categories
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
};

exports.getAllSubCategories = async (req, res, next) => {
    try {
        // Fetch all active subcategories
        // You can limit this if needed, e.g., .limit(10)
        const subCategories = await subcategoryModel.find({ isActive: true });
        
        res.status(200).json({ success: true, data: subCategories });
    } catch (error) {
        next(error);
    }
};

// --- 4. Create New Shop ---
exports.createShop = async (req, res, next) => {
    try {
        // Now getting owner details from body, not req.user
        const {
            ownerName,
            ownerMobile,
            ownerEmail,
            name,
            phone,
            categoryId,
            subCategoryIds,
            address,
            latitude,
            longitude,
            logo,
            images,
            description
        } = req.body;

        const shop = await shopModel.create({
            owner: {
                name: ownerName,
                mobile: ownerMobile,
                email: ownerEmail
            },
            name,
            phone,
            category: categoryId,
            subCategories: subCategoryIds,
            address,
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            logo,
            images,
            description
        });

        res.status(201).json({ success: true, message: "Shop created successfully", data: shop });
    } catch (error) {
        next(error);
    }
};

exports.addProduct = async (req, res, next) => {
    try {
        const {
            shopId,
            name,
            description,
            price,
            salePrice,
            image,
            gallery,
            categoryId,
            subCategoryId
        } = req.body;

        const product = await productModel.create({
            shop: shopId,
            name,
            description,
            price,
            salePrice,
            image,
            gallery,
            category: categoryId,
            subCategory: subCategoryId
        });

        res.status(201).json({ success: true, message: "Product added", data: product });
    } catch (error) {
        next(error);
    }
};

// --- 6. Get Products by Shop ---
exports.getShopProducts = async (req, res, next) => {
    try {
        const { shopId } = req.params;
        const products = await productModel.find({ shop: shopId, isActive: true });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        next(error);
    }
};

// --- Get Top Deals (Highest Discount + Nearby) ---
exports.getTopDeals = async (req, res, next) => {
    try {
        const { latitude, longitude, radius = 10000 } = req.query; // Default 10km radius

        // 1. Find Shops Nearby first
        const shops = await shopModel.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                    $maxDistance: parseInt(radius)
                }
            }
        }).select('_id');

        const shopIds = shops.map(s => s._id);

        // 2. Find Products in these shops, sorted by Discount % (High to Low)
        // We calculate discount % on the fly or if you stored it, sort by that.
        // If you didn't store discount %, we sort by (price - salePrice) difference or just salePrice.
        // Better approach: MongoDB Aggregate to calculate discount % and sort.

        const products = await productModel.aggregate([
            { $match: { shop: { $in: shopIds }, isActive: true, inStock: true } },
            {
                $addFields: {
                    discountPercentage: {
                        $cond: {
                            if: { $gt: ["$price", 0] },
                            then: { $multiply: [{ $divide: [{ $subtract: ["$price", "$salePrice"] }, "$price"] }, 100] },
                            else: 0
                        }
                    }
                }
            },
            { $sort: { discountPercentage: -1 } }, // Highest discount first
            { $limit: 10 }, // Top 10
            // Populate Shop details (since aggregate doesn't use mongoose populate directly in same way)
            {
                $lookup: {
                    from: "shops", // collection name in DB (usually plural lowercase)
                    localField: "shop",
                    foreignField: "_id",
                    as: "shopDetails"
                }
            },
            { $unwind: "$shopDetails" } // Flatten the array
        ]);

        res.status(200).json({ success: true, data: products });
    } catch (error) {
        next(error);
    }
};

// --- Get Top Rated Shops Nearby ---
exports.getTopShops = async (req, res, next) => {
    try {
        const { latitude, longitude, radius = 10000 } = req.query;

        // Convert query params to numbers
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: "Latitude and Longitude are required" });
        }

        const shops = await shopModel.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [lng, lat] }, // User's location
                    distanceField: "distance", // Create a new field called 'distance'
                    maxDistance: parseInt(radius), // Max radius in meters
                    spherical: true // Calculate accurate spherical distance
                }
            },
            {
                $match: {
                    isOpen: true // Only show open shops
                }
            },
            { $sort: { rating: -1 } }, // Sort by highest rating first
            { $limit: 10 } // Limit to top 10 results
        ]);

        res.status(200).json({ success: true, data: shops });
    } catch (error) {
        next(error);
    }
};

exports.fixIndexes = async (req, res) => {
    try {
        // 1. Remove any old indexes to avoid conflicts
        await shopModel.collection.dropIndexes();
        
        // 2. Create the specific 2dsphere index for location
        await shopModel.collection.createIndex({ location: "2dsphere" });
        
        // 3. Get list of indexes to verify
        const indexes = await shopModel.collection.getIndexes();
        
        res.status(200).json({ 
            success: true, 
            message: "Indexes Rebuilt Successfully", 
            indexes: indexes 
        });
    } catch (error) {
        console.error("Index Error:", error);
        res.status(500).json({ error: error.message });
    }
};