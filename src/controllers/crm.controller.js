const PlanPurchase = require('../models/planPurchase.model');
const ServiceBooking = require('../models/ServiceModel/serviceBooking.model');
const orderModel = require('../models/Shop/order.model');
const Order = require('../models/store/order.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// STEP 1: Get all users with their monthly and lifetime spend (Paginated)
const getGlobalCrmUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const filterType = req.query.type || 'ALL'; // ALL, MLM, NORMAL

        // 1. Build the Match Query
        let matchQuery = {};
        if (search) {
            matchQuery = {
                $or: [
                    { phone: { $regex: search, $options: 'i' } },
                    { firstName: { $regex: search, $options: 'i' } }
                ]
            };
        }

        if (filterType === 'MLM') {
            matchQuery.currentPlan = { $ne: null };
        } else if (filterType === 'NORMAL') {
            matchQuery.currentPlan = null;
        }

        // 2. Count Total for Pagination
        const totalUsers = await User.countDocuments(matchQuery);

        // 3. Paginate first, THEN lookup transactions (Super Fast Performance)
        const users = await User.aggregate([
            { $match: matchQuery },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },

            // Lookup MLM Purchases
            { $lookup: { from: 'planpurchases', localField: '_id', foreignField: 'user', as: 'planPurchases' } },
            // Lookup E-Commerce Orders
            { $lookup: { from: 'orders', localField: '_id', foreignField: 'user', as: 'onlineOrders' } },
            // Lookup Offline POS Orders
            { $lookup: { from: 'offlineorders', localField: '_id', foreignField: 'user', as: 'offlineOrders' } },
            // Lookup Urban Service Bookings
            { $lookup: { from: 'servicebookings', localField: '_id', foreignField: 'user', as: 'serviceBookings' } },
            // Lookup Current Plan Name
            { $lookup: { from: 'plans', localField: 'currentPlan', foreignField: '_id', as: 'planDetails' } },
            { $unwind: { path: '$planDetails', preserveNullAndEmptyArrays: true } }
        ]);

        // 4. Calculate Totals in Node.js for the returned batch
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        const crmData = users.map(user => {
            let lifetimeSpend = 0;
            let thisMonthSpend = 0;
            let totalTxCount = 0;

            // Helper function to sum up amounts and check dates
            const calculateSpend = (transactions, amountField, dateField) => {
                transactions.forEach(tx => {
                    const amount = tx[amountField] || 0;
                    const txDate = new Date(tx[dateField]);

                    lifetimeSpend += amount;
                    totalTxCount += 1;

                    if (txDate >= startOfMonth) {
                        thisMonthSpend += amount;
                    }
                });
            };

            // Calculate for all 3 revenue streams
            calculateSpend(user.planPurchases, 'amount', 'paidAt');
            calculateSpend(user.onlineOrders, 'finalAmount', 'createdAt');
            calculateSpend(user.offlineOrders, 'totalAmount', 'createdAt');

            // Add Service Bookings to transaction count (since there's no amount field in schema yet)
            totalTxCount += user.serviceBookings.length;

            return {
                _id: user._id,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
                phone: user.phone,
                role: user.role,
                isMlmMember: !!user.currentPlan,
                planName: user.planDetails ? user.planDetails.name : 'No Active Plan',
                lifetimeSpend,
                thisMonthSpend,
                totalTransactions: totalTxCount,
                joinedAt: user.createdAt
            };
        });

        return res.status(200).json({
            success: true,
            data: crmData,
            pagination: {
                totalUsers,
                currentPage: page,
                totalPages: Math.ceil(totalUsers / limit)
            }
        });

    } catch (error) {
        console.error('CRM Global Fetch Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const getUserLedgerDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. Fetch User Basic Info
        const user = await User.findById(userId)
            .populate('currentPlan', 'name price') // Get their active plan name
            .lean();

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // 2. Fetch all 4 pillars concurrently for maximum speed
        const [mlmPurchases, onlineOrders, offlineOrders, serviceBookings] = await Promise.all([
            // Pillar 1: MLM Plan Purchases
            PlanPurchase.find({ user: userId })
                .populate('plan', 'name price bundleInfo')
                .sort({ paidAt: -1 })
                .lean(),

            // Pillar 2: Online E-Commerce Orders
            Order.find({ user: userId })
                .sort({ createdAt: -1 })
                .lean(),

            // Pillar 3: Offline POS Orders
            orderModel.find({ user: userId })
                .populate('shop', 'shopName phone') // Assuming your Shop model has shopName
                .sort({ createdAt: -1 })
                .lean(),

            // Pillar 4: Urban Services
            ServiceBooking.find({ user: userId })
                .populate('agent', 'name phone') // Assuming ServiceAgent has name
                .populate('subService', 'name')
                .sort({ createdAt: -1 })
                .lean()
        ]);

        // 3. Send the unified package to the frontend
        return res.status(200).json({
            success: true,
            data: {
                userBasic: {
                    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                    phone: user.phone,
                    email: user.email,
                    joinedAt: user.createdAt,
                    role: user.role,
                    currentPlan: user.currentPlan,
                    kyc: {
                        aadhaar: user.isAadhaarVerified,
                        pan: user.isPanVerified,
                        bank: user.isBankVerified
                    }
                },
                ledger: {
                    mlmPurchases,
                    onlineOrders,
                    offlineOrders,
                    serviceBookings
                }
            }
        });

    } catch (error) {
        console.error('getUserLedgerDetails Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

module.exports = {
    getGlobalCrmUsers,
    getUserLedgerDetails
};