const PayoutRequest = require('../models/payoutRequest.model');
const Commission = require('../models/commission.model');
const User = require('../models/user.model');

// Helper to extract User ID safely from your auth payload
function getAuthUserId(req) {
    const u = req.user;
    if (!u) return null;
    if (u.doc?._id) return u.doc._id.toString();
    if (u.id) return u.id;
    if (u.tokenPayload?.sub) return u.tokenPayload.sub;
    return null;
}

// ==========================================
// USER CONTROLLERS
// ==========================================

const requestPayout = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { amount } = req.body;
        const withdrawAmount = Number(amount);

        if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Please enter a valid amount greater than 0.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        // 1. MUST have verified bank details
        if (!user.bank?.accountNumber || !user.isBankVerified) {
            return res.status(400).json({
                success: false,
                error: 'Your bank account must be added and verified by admin before requesting a payout.'
            });
        }

        // 2. Prevent spamming (Only 1 active pending request allowed at a time)
        const existingPending = await PayoutRequest.findOne({ user: userId, status: 'PENDING' });
        if (existingPending) {
            return res.status(400).json({
                success: false,
                error: 'You already have a pending withdrawal request. Please wait for it to be processed.'
            });
        }

        // 3. Calculate Actual Withdrawable Balance Dynamically
        // A. Sum of all earned & released commissions
        const commissionAgg = await Commission.aggregate([
            { $match: { earner: user._id, status: 'RELEASED' } },
            { $group: { _id: null, totalReleased: { $sum: '$amount' } } }
        ]);
        const totalReleased = commissionAgg.length > 0 ? commissionAgg[0].totalReleased : 0;

        // B. Sum of all money already withdrawn or currently requested
        const payoutAgg = await PayoutRequest.aggregate([
            { $match: { user: user._id, status: { $in: ['PENDING', 'APPROVED'] } } },
            { $group: { _id: null, totalWithdrawn: { $sum: '$amount' } } }
        ]);
        const totalWithdrawn = payoutAgg.length > 0 ? payoutAgg[0].totalWithdrawn : 0;

        // C. Net Available Balance
        const availableBalance = totalReleased - totalWithdrawn;

        if (withdrawAmount > availableBalance) {
            return res.status(400).json({
                success: false,
                error: `Insufficient balance. Your available withdrawable balance is ₹${availableBalance.toLocaleString()}.`
            });
        }

        // 4. Create the withdrawal request
        const newRequest = await PayoutRequest.create({
            user: userId,
            amount: withdrawAmount
        });

        return res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted successfully.',
            data: newRequest,
            remainingBalance: availableBalance - withdrawAmount
        });

    } catch (error) {
        console.error('requestPayout error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};


// ==========================================
// ADMIN CONTROLLERS
// ==========================================

const getPayoutRequestsAdmin = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status || 'ALL';
        const search = req.query.search || '';

        let query = {};

        if (status !== 'ALL') {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        // Fetch requests and populate user bank details
        const requests = await PayoutRequest.find(query)
            .populate('user', 'firstName lastName phone email bank')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Search Filtering (applied in memory since it searches populated fields)
        let filteredRequests = requests;
        if (search) {
            const lowerSearch = search.toLowerCase();
            filteredRequests = requests.filter(req =>
                req._id.toString().toLowerCase().includes(lowerSearch) ||
                (req.user?.firstName || '').toLowerCase().includes(lowerSearch) ||
                (req.user?.lastName || '').toLowerCase().includes(lowerSearch) ||
                (req.user?.phone || '').includes(lowerSearch)
            );
        }

        const totalRequests = await PayoutRequest.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: filteredRequests,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalRequests / limit),
                totalRequests
            }
        });
    } catch (error) {
        console.error('getPayoutRequestsAdmin error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const updatePayoutStatusAdmin = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status. Must be APPROVED or REJECTED.' });
        }

        const request = await PayoutRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found.' });
        }

        // STRICT RULE: Cannot revert or change a processed request
        if (request.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `This request is already ${request.status} and cannot be modified.`
            });
        }

        request.status = status;
        request.processedAt = new Date();
        await request.save();

        return res.status(200).json({
            success: true,
            message: `Payout successfully marked as ${status}.`,
            data: request
        });
    } catch (error) {
        console.error('updatePayoutStatusAdmin error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

module.exports = {
    requestPayout,
    getPayoutRequestsAdmin,
    updatePayoutStatusAdmin
};