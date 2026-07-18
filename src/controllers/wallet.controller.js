const mongoose = require('mongoose');
const Commission = require('../models/commission.model');
const User = require('../models/user.model');
const Plan = require('../models/plan.model');

// small helper because your auth payload structure is messy
function getAuthUserId(req) {
  const u = req.user;
  if (!u) return null;

  // you have: { id, phone, tokenPayload, doc }
  if (u.doc?._id) return u.doc._id.toString();
  if (u.id) return u.id;
  if (u.tokenPayload?.sub) return u.tokenPayload.sub;

  return null;
}

/**
 * GET /api/wallet
 * Return summary: totals & by kind
 */
const getWalletSummary = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const commissions = await Commission.find({ earner: userId })
      .select('amount kind status')
      .lean();

    let releasedTotal = 0;
    let frozenTotal = 0;

    const byKind = {
      ROOT_1P: { released: 0, frozen: 0 },
      MLM_LEVEL: { released: 0, frozen: 0 }
    };

    for (const c of commissions) {
      const amt = Number(c.amount) || 0;
      const kind = c.kind;
      const status = c.status;

      if (status === 'RELEASED') {
        releasedTotal += amt;
        if (byKind[kind]) {
          byKind[kind].released += amt;
        }
      } else if (status === 'FROZEN') {
        frozenTotal += amt;
        if (byKind[kind]) {
          byKind[kind].frozen += amt;
        }
      }
    }

    return res.json({
      success: true,
      balance: {
        releasedTotal,
        frozenTotal,
        byKind
      }
    });
  } catch (err) {
    console.error('getWalletSummary error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/wallet/history
 * Query params: page, limit, kind, status
 */
const getWalletHistory = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const filter = { earner: new mongoose.Types.ObjectId(userId) };

    const { kind, status } = req.query;

    if (kind && ['ROOT_1P', 'MLM_LEVEL'].includes(kind)) {
      filter.kind = kind;
    }

    if (status && ['RELEASED', 'FROZEN'].includes(status)) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Commission.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('fromUser', 'firstName lastName phone')
        .populate('plan', 'name price')
        .populate('purchase', 'paidAt')
        .lean(),
      Commission.countDocuments(filter)
    ]);

    const mapped = items.map((c) => ({
      id: c._id,
      kind: c.kind,
      status: c.status,
      amount: c.amount,
      level: c.level ?? null,
      fromUser: c.fromUser
        ? {
          id: c.fromUser._id,
          phone: c.fromUser.phone,
          firstName: c.fromUser.firstName,
          lastName: c.fromUser.lastName
        }
        : null,
      plan: c.plan
        ? {
          id: c.plan._id,
          name: c.plan.name,
          price: c.plan.price
        }
        : null,
      purchaseId: c.purchase?._id || null,
      createdAt: c.createdAt
    }));

    return res.json({
      success: true,
      page,
      limit,
      total,
      items: mapped
    });
  } catch (err) {
    console.error('getWalletHistory error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 1. Get Global Wallet Dashboard Data for Admin
const getAdminWalletDashboard = async (req, res) => {
  try {
    // --- STEP 1: CALCULATE TOTAL PLAN REVENUE ---
    const revenueAgg = await User.aggregate([
      { $match: { currentPlan: { $ne: null } } },
      { $lookup: { from: 'plans', localField: 'currentPlan', foreignField: '_id', as: 'planDetails' } },
      { $unwind: "$planDetails" },
      { $group: { _id: null, totalRevenue: { $sum: "$planDetails.price" } } }
    ]);
    const totalPlanRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    // --- STEP 2: CALCULATE COMMISSIONS ---
    const aggregatedData = await Commission.aggregate([
      { $match: { earner: { $ne: null } } },
      {
        $group: {
          _id: "$earner",
          totalEarned: { $sum: "$amount" },
          availableBalance: { $sum: { $cond: [{ $eq: ["$status", "RELEASED"] }, "$amount", 0] } },
          frozenBalance: { $sum: { $cond: [{ $eq: ["$status", "FROZEN"] }, "$amount", 0] } }
        }
      }
    ]);

    let totalCommission = 0;
    let totalFrozen = 0;

    const walletUserIds = aggregatedData.map(item => item._id).filter(id => id != null);
    const users = await User.find({ _id: { $in: walletUserIds } }).select('firstName lastName phone profilePic role').lean();

    const userMap = {};
    users.forEach(u => { if (u && u._id) userMap[u._id.toString()] = u; });

    const wallets = aggregatedData.map(item => {
      const userIdString = item._id ? item._id.toString() : 'unknown';
      const u = userMap[userIdString];

      // Accumulate global stats
      totalCommission += item.totalEarned || 0;
      totalFrozen += item.frozenBalance || 0;

      return {
        id: userIdString,
        userId: userIdString,
        firstName: u?.firstName || 'Unknown',
        lastName: u?.lastName || '',
        phone: u?.phone || 'N/A',
        profilePic: u?.profilePic || null,
        role: u?.role || 'USER',
        totalEarned: item.totalEarned || 0,
        availableBalance: item.availableBalance || 0,
        frozenBalance: item.frozenBalance || 0
      };
    });

    // --- STEP 3: COMPUTE PROFIT ---
    const totalProfit = totalPlanRevenue - totalCommission;

    const stats = {
      totalProfit,
      totalPlanRevenue,
      totalCommission,
      totalFrozen
    };

    return res.status(200).json({ success: true, stats, wallets });
  } catch (error) {
    console.error('getAdminWalletDashboard error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// 2. Get Ledger History for a specific User (Admin View)
const getAdminUserLedger = async (req, res) => {
  try {
    const { userId } = req.params;

    const commissions = await Commission.find({ earner: userId })
      .sort({ createdAt: -1 })
      .lean();

    const ledger = commissions.map(c => ({
      id: c._id,
      date: new Date(c.createdAt).toLocaleString(),
      type: 'COMMISSION',
      subType: c.kind,
      amount: c.amount,
      status: c.status,
      desc: `${c.kind === 'MLM_LEVEL' ? `Level ${c.level} Commission` : 'Platform Share'}`
    }));

    return res.status(200).json({ success: true, ledger });
  } catch (error) {
    console.error('getAdminUserLedger error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  getWalletSummary,
  getWalletHistory,
  getAdminWalletDashboard,
  getAdminUserLedger
};
