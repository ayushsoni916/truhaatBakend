const cashbackTransactionModel = require("../models/cashbackTransaction.model");
const cashbackWalletModel = require("../models/cashbackWallet.model");

exports.getCashbackSummary = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;

        let wallet = await cashbackWalletModel.findOne({ userId });
        
        // Lazy-initialization if the wallet schema footprint doesn't exist yet
        if (!wallet) {
            wallet = await cashbackWalletModel.create({
                userId,
                pointsBalance: 0,
                lifetimePointsEarned: 0
            });
        }

        return res.status(200).json({
            success: true,
            wallet: {
                pointsBalance: wallet.pointsBalance,
                lifetimePointsEarned: wallet.lifetimePointsEarned
            }
        });
    } catch (error) {
        console.error("❌ getCashbackSummary error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Fetch paginated tracking log history items for points
 */
exports.getCashbackHistory = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const items = await cashbackTransactionModel.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalItems = await cashbackTransactionModel.countDocuments({ userId });

        return res.status(200).json({
            success: true,
            items: items.map(item => ({
                id: item._id,
                amount: item.amount,
                type: item.type,
                description: item.description,
                createdAt: item.createdAt
            })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                totalItems
            }
        });
    } catch (error) {
        console.error("❌ getCashbackHistory error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};