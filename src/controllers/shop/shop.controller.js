const productModel = require("../../models/Shop/product.model");
const shopModel = require("../../models/Shop/shop.model");

const cloudinary = require("cloudinary").v2;

// Helper: Cloudinary Multi-Upload
const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: folder },
            (error, result) => {
                if (error) reject(error);
                else resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );
        uploadStream.end(fileBuffer);
    });
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
            mainCategoryId, // The high-level type ID
            street,
            area,
            city,
            state,
            pincode,
            latitude,
            longitude,
            description
        } = req.body;

        const files = req.files; // Array of files from multer

        if (!files || files.length === 0) {
            return res.status(400).json({ error: "At least one shop image is required." });
        }

        // 1. Parallel Upload to Cloudinary (Max 3 as per your requirement)
        const uploadPromises = files.map(file => uploadToCloudinary(file.buffer, "shop_interiors"));
        const uploadedImages = await Promise.all(uploadPromises);

        // 2. Create Shop
        const shop = await shopModel.create({
            owner: {
                name: ownerName,
                mobile: ownerMobile,
                email: ownerEmail
            },
            name,
            phone,
            mainCategory: mainCategoryId,
            address: {
                street,
                area,
                city,
                state,
                pincode
            },
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            images: uploadedImages, // Array of {url, publicId}
            description
        });

        res.status(201).json({
            success: true,
            message: "Shop onboarded successfully",
            data: shop
        });
    } catch (error) {
        next(error);
    }
};

exports.getTopShops = async (req, res, next) => {
    try {
        const { latitude, longitude } = req.query;
        const radius = 100000; // Fixed 10km as per your request

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ success: false, message: "Valid Latitude and Longitude are required" });
        }

        const shops = await shopModel.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [lng, lat] },
                    distanceField: "distance", 
                    maxDistance: radius,
                    spherical: true
                }
            },
            {
                $match: { isOpen: true }
            },
            // Join with MainShopCategory to get the category name (Grocery, Medical, etc.)
            {
                $lookup: {
                    from: "mainshopcategories", // Ensure this matches your collection name in MongoDB
                    localField: "mainCategory",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $project: {
                    name: 1,
                    images: 1,
                    rating: 1,
                    distance: 1,
                    categoryName: "$categoryDetails.name",
                    // Format distance to a readable string (e.g., "200m away" or "1.2km away")
                    distanceLabel: {
                        $cond: {
                            if: { $lt: ["$distance", 1000] },
                            then: { $concat: [{ $toString: { $round: ["$distance", 0] } }, "m away"] },
                            else: { $concat: [{ $toString: { $round: [{ $divide: ["$distance", 1000] }, 1] } }, "km away"] }
                        }
                    }
                }
            },
            { $sort: { rating: -1 } },
            { $limit: 10 }
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