const Plan = require("../models/plan.model");


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

module.exports = {
    createPlan,
    getPlans
};
