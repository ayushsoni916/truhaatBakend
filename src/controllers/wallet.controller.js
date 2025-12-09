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

module.exports = {
  getWalletSummary,
  getWalletHistory
};
