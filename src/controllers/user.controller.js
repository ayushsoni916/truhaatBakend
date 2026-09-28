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

const getMe = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId).select('-password -__v');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
}

// --- ADD THIS TO YOUR USER CONTROLLER ---
const getUsersAdmin = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type || 'all'; // 'mlm', 'subadmin', or 'all'
        const search = req.query.search || '';
        const kyc = req.query.kyc || 'ALL';
        const status = req.query.status || 'ALL';

        let andConditions = [];

        // 1. Role / Type Filter Fix
        if (type === 'mlm') {
            // MLM Users must have a plan
            andConditions.push({ role: 'USER', currentPlan: { $ne: null } });
        } else if (type === 'subadmin') {
            andConditions.push({ role: 'SUBADMIN' });
        } else {
            // 'all' - Show users with plans OR subadmins
            andConditions.push({
                $or: [
                    { role: 'USER', currentPlan: { $ne: null } },
                    { role: 'SUBADMIN' }
                ]
            });
        }

        // 2. Search Filter
        if (search) {
            andConditions.push({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { referralCode: { $regex: search, $options: 'i' } }
                ]
            });
        }

        // 3. KYC Filter
        if (kyc === 'VERIFIED') {
            andConditions.push({ isAadhaarVerified: true, isPanVerified: true, isBankVerified: true });
        } else if (kyc === 'PENDING') {
            andConditions.push({
                $or: [{ isAadhaarVerified: false }, { isPanVerified: false }, { isBankVerified: false }]
            });
        }

        let query = { $and: andConditions };
        let users = await User.find(query)
            .select('-password')
            .populate('currentPlan', 'name planType price')
            .sort({ createdAt: -1 })
            .lean();

        // 4. Attach PlanPurchase & filter by status if specified
        const PlanPurchase = require('../models/planPurchase.model');

        let processedUsers = await Promise.all(users.map(async (user) => {
            const purchase = await PlanPurchase.findOne({ user: user._id })
                .sort({ createdAt: -1 })
                .select(
                    'deliveryStatus deliveryMethod invoiceNumber shippingAddress trackingDetails'
                );
            return { ...user, planPurchase: purchase };
        }));

        // 5. Delivery Status Filter
        if (status !== 'ALL') {
            processedUsers = processedUsers.filter(u => u.planPurchase?.deliveryStatus === status);
        }

        // Pagination calculation after filters
        const totalUsers = processedUsers.length;
        const totalPages = Math.ceil(totalUsers / limit) || 1;
        const skip = (page - 1) * limit;
        const paginatedUsers = processedUsers.slice(skip, skip + limit);

        res.status(200).json({
            success: true,
            data: paginatedUsers,
            pagination: { currentPage: page, totalPages, totalUsers, limit }
        });
    } catch (error) {
        console.error('getUsersAdmin error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// Manually Update User KYC & Bank (Admin)
const manuallyUpdateUserKyc = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { aadhaar, pan, bank } = req.body;

        const updateData = {};

        // 1. Aadhaar Block (If any Aadhaar data is passed, ALL must be present)
        if (aadhaar) {
            if (!aadhaar.number || !aadhaar.name || !aadhaar.dob || !aadhaar.gender || !aadhaar.address) {
                return res.status(400).json({ success: false, error: 'All Aadhaar fields (number, name, dob, gender, address) are required.' });
            }
            updateData['aadhaar.number'] = aadhaar.number;
            updateData['aadhaar.name'] = aadhaar.name;
            updateData['aadhaar.dob'] = aadhaar.dob;
            updateData['aadhaar.gender'] = aadhaar.gender;
            updateData['aadhaar.address'] = aadhaar.address; // Saves as Object
            updateData['aadhaar.verifiedAt'] = new Date();
            updateData.isAadhaarVerified = true;
        }

        // 2. PAN Block
        if (pan) {
            if (!pan.number || !pan.name) {
                return res.status(400).json({ success: false, error: 'All PAN fields (number, name) are required.' });
            }
            updateData['pan.number'] = pan.number;
            updateData['pan.name'] = pan.name;
            updateData['pan.verifiedAt'] = new Date();
            updateData.isPanVerified = true;
        }

        // 3. Bank Block
        if (bank) {
            if (!bank.accountNumber || !bank.ifsc || !bank.bankName) {
                return res.status(400).json({ success: false, error: 'All Bank fields (accountNumber, ifsc, bankName) are required.' });
            }
            updateData['bank.accountNumber'] = bank.accountNumber;
            updateData['bank.ifsc'] = bank.ifsc;
            updateData['bank.bankName'] = bank.bankName;
            updateData['bank.verifiedAt'] = new Date();
            updateData.isBankVerified = true;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid KYC data provided to update.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.status(200).json({ success: true, message: 'KYC manually updated.', data: updatedUser });
    } catch (error) {
        console.error('manuallyUpdateUserKyc error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};


// Don't forget to export it!
// module.exports = { createUser, updateProfileUnified, getKycData, getMe, getUsersAdmin };

module.exports = { createUser, updateProfileUnified, getKycData, getMe, getUsersAdmin, manuallyUpdateUserKyc };
