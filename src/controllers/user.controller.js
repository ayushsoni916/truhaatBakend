const User = require("../models/user.model");
const cloudinary = require("../config/cloudinary");

const createUser = async (req, res) => {
    try {
        const { phone, firstName, lastName, email } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'phone is required' });
        }

        const user = new User({
            phone,
            firstName,
            lastName,
            email
        })

        await user.save()

        return res.status(200).json({
            user: {
                id: user._id,
                phone: user.phone,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                referralCode: user.referralCode,
                referredBy: user.referredBy,
                createdAt: user.createdAt
            }
        })

    }
    catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'User with this phone already exists' });
        }
        return next(err);
    }
}

const updateProfileUnified = async (req, res, next) => {
    try {
        const userId = req.user.id; // From your auth middleware
        const { firstName, lastName, email, gender } = req.body;
        const file = req.file;

        // Ensure at least one field is being updated
        if (!firstName && !lastName && !email && !gender && !file) {
            return res.status(400).json({ error: "Provide at least one field to update." });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Handle Image Upload to Cloudinary
        if (file) {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: "truhaat_profiles" },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(file.buffer);
            });

            // Delete old image from Cloudinary to save space
            if (user.profilePublicUrl) {
                await cloudinary.uploader.destroy(user.profilePublicUrl);
            }

            user.profilePic = result.secure_url;
            user.profilePublicUrl = result.public_id;
        }

        // Update Text Fields if provided
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (email) user.email = email;
        if (gender) user.gender = gender;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                gender: user.gender,
                profilePic: user.profilePic
            }
        });
    } catch (err) {
        next(err);
    }
};

const getKycData = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Select only the verification flags and the data objects
        const user = await User.findById(userId).select(
            'isAadhaarVerified isPanVerified isBankVerified aadhaar pan bank'
        );

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({
            success: true,
            data: {
                verificationStatus: {
                    aadhaar: user.isAadhaarVerified,
                    pan: user.isPanVerified,
                    bank: user.isBankVerified
                },
                aadhaarData: user.aadhaar,
                panData: user.pan,
                bankData: user.bank
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createUser, updateProfileUnified, getKycData };
