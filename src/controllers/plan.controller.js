const cashbackWalletModel = require("../models/cashbackWallet.model");
const Plan = require("../models/plan.model");
const PlanPurchase = require("../models/planPurchase.model");
const addressModel = require("../models/store/address.model");
const User = require("../models/user.model");
const cloudinary = require('cloudinary').v2;
const { handlePlanPurchase } = require("../services/mlm.service");

const generateInvoiceNumber = () => 'TRU-' + Date.now() + Math.floor(Math.random() * 1000);

const getMyPlanPurchases = async (req, res) => {
    try {
        console.log("called getMyPlanPurchases");

        // FIX: Extract the ID from either req.user.doc._id OR req.user.id
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Use doc._id if it exists, otherwise fallback to id
        const userId = authUser.doc?._id || authUser.id;

        if (!userId) {
            return res.status(400).json({ error: 'User ID missing from token' });
        }

        const purchases = await PlanPurchase.find({ user: userId })
            .populate('plan', 'name price') // Fetch basic plan info just in case
            .sort({ createdAt: -1 }) // Newest first
            .lean();

        console.log("plan details found:", purchases.length);

        return res.status(200).json({
            success: true,
            data: purchases
        });
    } catch (error) {
        console.error("Fetch Plan Purchases Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const createPlan = async (req, res) => {
    try {
        const {
            name,
            price,
            description,
            benefits,
            sortOrder,
            planType
        } = req.body;

        // ---- BASIC VALIDATION ----
        if (!name || price == null || !planType) {
            return res.status(400).json({
                error: 'name, price and planType are required'
            });
        }

        // ---- HARD RULE: USER plans always have 10% referral ----
        let referralPercent = 0;
        if (planType === 'USER') {
            referralPercent = 10;
        }

        const plan = await Plan.create({
            name,
            price,
            description: description || '',
            benefits: Array.isArray(benefits) ? benefits : [],
            referralPercent,
            planType,
            sortOrder: sortOrder ?? 0
        });

        return res.status(201).json({ success: true, plan });

    } catch (error) {
        console.error('createPlan error', error);

        if (error.code === 11000) {
            return res.status(409).json({
                error: 'Plan with this name already exists'
            });
        }

        return res.status(500).json({
            error: 'Internal server error'
        });
    }
};

const getPlans = async (req, res) => {
    try {
        // console.log('req.user =', req);
        const authUser = req.user;

        if (!authUser || !authUser.doc) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = authUser.doc;

        // Decide plan type based on role
        const planType = user.role === 'SUBADMIN' ? 'SUBADMIN' : 'USER';

        const plans = await Plan.find({
            isActive: true,
            planType
        })
            .sort({ price: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            planType,
            plans
        });

    } catch (err) {
        console.error('getPlans error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getSubAdminPlans = async (req, res) => {
    try {
        const plans = await Plan.find({
            isActive: true,
            planType: 'SUBADMIN'
        })
            .sort({ price: 1 })
            .lean();

        return res.status(200).json({ success: true, plans });
    } catch (err) {
        console.error('getSubAdminPlans error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getAllAdminPlans = async (req, res) => {
    try {
        // Find ALL plans (no filter for planType or isActive) so Admin can manage everything
        const plans = await Plan.find({})
            .sort({ planType: 1, price: 1 })
            .lean();

        // Notice we send it inside a 'data' array to match your React frontend expectation
        return res.status(200).json({ success: true, data: plans });
    } catch (err) {
        console.error('getAllAdminPlans error', err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// DELETE PLAN (For use in Postman)
const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedPlan = await Plan.findByIdAndDelete(id);

        if (!deletedPlan) return res.status(404).json({ error: 'Plan not found' });

        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
        console.error('deletePlan error', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// UPDATE PLAN BENEFITS & BUNDLE INFO
const updatePlanBenefits = async (req, res) => {
    try {
        const { id } = req.params;
        const { benefits, bundleInfo } = req.body; // Accept bundleInfo here

        if (benefits && !Array.isArray(benefits)) {
            return res.status(400).json({ error: 'Benefits must be an array of strings' });
        }

        const updateData = {};
        if (benefits) updateData.benefits = benefits;

        // Save the combo details and invoice items
        if (bundleInfo) {
            updateData.bundleInfo = bundleInfo;
        }

        const updatedPlan = await Plan.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true } // Returns the updated document
        );

        if (!updatedPlan) return res.status(404).json({ error: 'Plan not found' });

        return res.status(200).json({ success: true, plan: updatedPlan });
    } catch (error) {
        console.error('updatePlanBenefits error', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
const uploadMlmBanner = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No image file provided." });
        }

        const stream = cloudinary.uploader.upload_stream(
            { folder: "mlm_banners" },
            (err, result) => {
                if (err) {
                    console.error("Cloudinary Upload Error:", err);
                    return res.status(500).json({ success: false, error: "Failed to upload image." });
                }

                // Return the secure URL to the frontend
                return res.status(200).json({ success: true, url: result.secure_url });
            }
        );

        // Pass the file buffer to the Cloudinary stream
        stream.end(req.file.buffer);
    } catch (error) {
        console.error('uploadMlmBanner error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const purchasePlan = async (req, res) => {
    // console.log("REQ.USER =", req.user);
    try {
        const authUser = req.user;

        if (!authUser || !authUser.doc) {
            return res.status(401).json({ error: 'Invalid auth payload' });
        }

        const user = authUser.doc;          // ✅ already a User document from DB
        const userId = user._id.toString(); // if you need the id
        const { planId } = req.body;

        if (!planId) {
            return res.status(400).json({ error: 'planId is required' });
        }

        // ✅ BLOCK MULTIPLE PLAN PURCHASES
        if (user.currentPlan) {
            return res.status(400).json({
                error: 'User has already bought a plan'
            });
        }

        const plan = await Plan.findById(planId);
        if (!plan || !plan.isActive) {
            return res.status(400).json({ error: 'Invalid or inactive plan' });
        }

        // Create purchase record
        const purchase = await PlanPurchase.create({
            user: user._id,
            plan: plan._id,
            amount: plan.price
        });

        // Update user plan info (no expiry for now)
        user.currentPlan = plan._id;
        user.planActivatedAt = new Date();
        user.planExpiresAt = null;
        await user.save();

        // MLM commissions (1% root + 10% levels)
        await handlePlanPurchase(user, plan, purchase);

        return res.status(201).json({
            success: true,
            message: 'Plan purchased successfully',
            purchase: {
                id: purchase._id,
                user: purchase.user,
                plan: purchase.plan,
                amount: purchase.amount,
                paidAt: purchase.paidAt
            },
            user: {
                id: user._id,
                phone: user.phone,
                referralCode: user.referralCode,
                currentPlan: user.currentPlan,
                planActivatedAt: user.planActivatedAt,
                planExpiresAt: user.planExpiresAt
            }
        });
    } catch (err) {
        console.error('purchasePlan error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
const processPlanActivation = async (userId, planId, addressId, razorpayOrderId = null, razorpayPaymentId = null) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.currentPlan) throw new Error('User has already bought a plan');

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) throw new Error('Invalid or inactive plan');

    // 1. Fetch the user's shipping address
    let shippingAddress = null;
    if (addressId) {
        const address = await addressModel.findById(addressId);
        if (address) shippingAddress = address.toObject();
    }

    if (razorpayOrderId) {
        const structuralCheck = await PlanPurchase.findOne({ razorpayOrderId });
        if (structuralCheck) return { alreadyProcessed: true, user };
    }
    // Create purchase record
    const purchase = await PlanPurchase.create({
        user: user._id,
        plan: plan._id,
        amount: plan.price,
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        paidAt: new Date(),
        invoiceNumber: generateInvoiceNumber(),
        shippingAddress: shippingAddress,
        bundleSnapshot: plan.bundleInfo
    });

    // Update user plan info (no expiry for now)
    // Commit changes directly to User profile parameters
    user.currentPlan = plan._id;
    user.planActivatedAt = new Date();
    user.planExpiresAt = null;
    await user.save();

    // Trigger downline Multi-Level Marketing matrices
    await handlePlanPurchase(user, plan, purchase);

    return { purchase, user };
};

const processCashbackCardActivation = async (userId, razorpayOrderId, razorpayPaymentId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Idempotency: Avoid double activation cycles
    if (user.hasActiveCashbackCard) {
        return { alreadyActive: true, user };
    }

    // 1. Flip active status flags on the User Document
    user.hasActiveCashbackCard = true;
    user.cashbackCardActivatedAt = new Date();
    await user.save();

    // 2. Initialize or find the independent Loyalty Points Wallet
    let wallet = await cashbackWalletModel.findOne({ userId: user._id });
    if (!wallet) {
        wallet = await cashbackWalletModel.create({
            userId: user._id,
            pointsBalance: 0,
            lifetimePointsEarned: 0
        });
    }

    // 3. Drop an activation footprint trace log row into your point ledger history
    await cashbackTransactionModel.create({
        userId: user._id,
        amount: 0,
        type: 'CREDIT',
        description: 'Cashback Card Membership Activated',
        razorpayOrderId: razorpayOrderId
    });

    return { success: true, user };
};

module.exports = {
    createPlan,
    getPlans,
    purchasePlan,
    processPlanActivation,
    processCashbackCardActivation,
    getSubAdminPlans,
    getAllAdminPlans,
    updatePlanBenefits,
    deletePlan,
    uploadMlmBanner,
    getMyPlanPurchases
};
