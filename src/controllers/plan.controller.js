const Plan = require("../models/plan.model");
const PlanPurchase = require("../models/planPurchase.model");
const User = require("../models/user.model");


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
    try {
        const { planId } = req.body;

        if (!planId)
            return res.status(400).json({ error: 'planId is required' });

        // req.user is set by requireAuth middleware
        const userId = req.user.id;

        const plan = await Plan.findOne({ _id: planId, isActive: true });

        if (!plan) {
            return res.status(404).json({ error: 'Plan not found or inactive' });
        }

        // For now: no expiry logic => planExpiresAt = null
        const user = await User.findById(userId);
        if (!user) {
            // Should basically never happen if requireAuth worked
            return res.status(401).json({ error: 'User not found' });
        }

        // Create purchase record
        const purchase = await PlanPurchase.create({
            user: user._id,
            plan: plan._id,
            amount: plan.price
        });

        user.currentPlan = plan._id;
        user.planActivatedAt = new Date();
        user.planExpiresAt = null; // infinite for now

        await user.save()

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
                currentPlan: plan._id,
                planActivatedAt: user.planActivatedAt,
                planExpiresAt: user.planExpiresAt
            }
        });
    } catch (err) {
        console.error('purchasePlan error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    createPlan,
    getPlans,
    purchasePlan
};
