const Banner = require("../models/banner.model");
const cloudinary = require("../config/cloudinary");

// 1. ADD BANNER
exports.addBanner = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Please upload an image" });

        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "truhaat_banners" },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        const banner = await Banner.create({
            image: result.secure_url,
            publicId: result.public_id,
            title: req.body.title || ""
        });

        res.status(201).json({ success: true, banner });
    } catch (err) {
        next(err);
    }
};

// 2. GET ALL BANNERS (For App Home Screen)
exports.getBanners = async (req, res, next) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, banners });
    } catch (err) {
        next(err);
    }
};

// 3. DELETE BANNER
exports.deleteBanner = async (req, res, next) => {
    try {
        const { id } = req.params;
        const banner = await Banner.findById(id);
        
        if (!banner) return res.status(404).json({ error: "Banner not found" });

        // Delete from Cloudinary first
        await cloudinary.uploader.destroy(banner.publicId);
        
        // Delete from Database
        await Banner.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Banner deleted successfully" });
    } catch (err) {
        next(err);
    }
};