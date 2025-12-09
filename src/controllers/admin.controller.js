const PlanPurchase = require("../models/planPurchase.model");
const User = require("../models/user.model");

const promoteToSubadmin = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'SUBADMIN') {
            return res.status(400).json({ error: 'User is already a subadmin' });
        }

        // 1) must not have bought any plan
        if (user.currentPlan) {
            return res.status(400).json({ error: 'User already has a plan, cannot be subadmin' });
        }

        const purchasesCount = await PlanPurchase.countDocuments({ user: user._id });
        if (purchasesCount > 0) {
            return res.status(400).json({ error: 'User already bought a plan, cannot be subadmin' });
        }

        // 2) must not have referred anyone
        const downlineCount = await User.countDocuments({ referredBy: user._id });
        if (downlineCount > 0) {
            return res.status(400).json({ error: 'User has referrals, cannot be subadmin' });
        }

        // 3) must not be referred by anyone
        if (user.referredBy) {
            return res.status(400).json({ error: 'User is referred by someone, cannot be subadmin' });
        }

        // Safe to promote
        user.role = 'SUBADMIN';
        // This subadmin becomes its own MLM root
        user.mlmRoot = user._id;

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'User promoted to subadmin successfully',
            user: {
                id: user._id,
                phone: user.phone,
                role: user.role,
                mlmRoot: user.mlmRoot,
                referralCode: user.referralCode
            }
        });
    } catch (err) {
        console.error('promoteToSubadmin error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


module.exports = {
    promoteToSubadmin
};
