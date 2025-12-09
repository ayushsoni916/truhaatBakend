const Plan = require("../models/plan.model");
const PlanPurchase = require("../models/planPurchase.model");
const User = require("../models/user.model");
const { handlePlanPurchase } = require("../services/mlm.service");


const createPlan = async (req, res) => {
    try {
        const { name, price, description, benefits, referralPercent, sortOrder } = req.body;

        if (!name || price == null || referralPercent == null) {
            return res.status(400).json({ error: 'name, price and referralPercent are required' });
        }

        const plan = await Plan.create({
            name,
            price,
            description: description || '',
            benefits: Array.isArray(benefits) ? benefits : [],
            referralPercent,
            sortOrder: sortOrder ?? 0
        });

        return res.status(201).json({ success: true, plan });


    } catch (error) {
        console.error('createPlan error', error);
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Plan with this name already exists' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
}

const getPlans = async (req, res) => {
    try {
        const plans = await Plan.find({ isActive: true })
            .sort({ sortOrder: 1, price: 1 })
            .lean();

        return res.status(200).json({ success: true, plans })
    } catch (err) {
        console.error('getPlans error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

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

module.exports = {
    createPlan,
    getPlans,
    purchasePlan
};
