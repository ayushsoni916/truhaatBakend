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

// --- 4. Create New Shop (Vendor Onboarding) ---
exports.createShop = async (req, res, next) => {
    try {
        const {
            // Firm Details
            name, firmCategory, phone,
            // Owner Details
            ownerName, ownerDesignation, ownerMobile, ownerEmail,
            // Address & Location
            street, area, city, state, pincode, latitude, longitude,
            // Bank Details
            beneficiaryName, accountNumber, ifscCode, bankName, bankAddress,
            // Tax & Compliance
            panNumber, hasGst, gstNumber, altDocType, altDocNumber,
            // Extra
            description
        } = req.body;

        const files = req.files; // Object of files from multer.fields()

        if (!files || !files.panCard || !files.cancelledCheque || !files.complianceCertificate || !files.images) {
            return res.status(400).json({ error: "All mandatory documents and at least one shop image are required." });
        }

        // 1. Upload Documents to Cloudinary
        const [panUpload, chequeUpload, certUpload] = await Promise.all([
            uploadToCloudinary(files.panCard[0].buffer, "shop_documents"),
            uploadToCloudinary(files.cancelledCheque[0].buffer, "shop_documents"),
            uploadToCloudinary(files.complianceCertificate[0].buffer, "shop_documents")
        ]);

        // 2. Upload Shop Images
        const shopImagePromises = files.images.map(file => uploadToCloudinary(file.buffer, "shop_interiors"));
        const uploadedShopImages = await Promise.all(shopImagePromises);

        // 3. Create Shop in Database
        const shop = await shopModel.create({
            name,
            firmCategory,
            phone,
            owner: {
                name: ownerName,
                designation: ownerDesignation,
                mobile: ownerMobile,
                email: ownerEmail
            },
            address: { street, area, city, state, pincode },
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            bankDetails: { beneficiaryName, accountNumber, ifscCode, bankName, bankAddress },
            taxDetails: {
                panNumber,
                hasGst: hasGst === 'true' || hasGst === true,
                gstNumber: gstNumber || undefined,
                altDocType: altDocType || undefined,
                altDocNumber: altDocNumber || undefined
            },
            documents: {
                panCard: panUpload,
                cancelledCheque: chequeUpload,
                complianceCertificate: certUpload
            },
            images: uploadedShopImages,
            description
        });

        res.status(201).json({
            success: true,
            message: "Vendor onboarded successfully",
            data: shop
        });
    } catch (error) {
        next(error);
    }
};

// --- Top Shops (Updated for new firmCategory lookup) ---
exports.getTopShops = async (req, res, next) => {
    try {
        const { latitude, longitude } = req.query;
        const radius = 100000; // 10km

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
            { $match: { isOpen: true } },
            // UPDATED: Now joins with shopcategories using firmCategory
            {
                $lookup: {
                    from: "shopcategories",
                    localField: "firmCategory",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    name: 1,
                    images: 1,
                    rating: 1,
                    distance: 1,
                    categoryName: "$categoryDetails.name",
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
        await shopModel.collection.dropIndexes();
        await shopModel.collection.createIndex({ location: "2dsphere" });
        const indexes = await shopModel.collection.getIndexes();
        res.status(200).json({ success: true, message: "Indexes Rebuilt", indexes });
    } catch (error) {
        console.error("Index Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- Get All Shops (Admin - with Pagination & Search) ---
exports.getAllShops = async (req, res, next) => {
    try {
        const { categoryId, search, page = 1, limit = 10 } = req.query;
        let query = {}; // Admin needs to see all shops

        // Filter by Firm Category
        if (categoryId) {
            query.firmCategory = categoryId;
        }

        // Search by Shop Name or Owner Name
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { 'owner.name': { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const shops = await shopModel.find(query)
            .populate('firmCategory', 'name') // Populates the category name
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await shopModel.countDocuments(query);

        res.status(200).json({
            success: true,
            data: shops,
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