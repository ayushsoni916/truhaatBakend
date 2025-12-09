// src/controllers/team.controller.js
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Commission = require('../models/commission.model');
const PlanPurchase = require('../models/planPurchase.model');

// Helper: get logged-in user id from auth middleware
function getAuthUserId(req) {
  const u = req.user;
  if (!u) return null;

  if (u.doc?._id) return u.doc._id.toString();
  if (u.id) return u.id;
  if (u.tokenPayload?.sub) return u.tokenPayload.sub;

  return null;
}

/**
 * BFS downline: returns all levels up to `maxLevels`
 * levels[0] = level 1, levels[1] = level 2, ...
 */
async function getDownlineLevels(rootUserId, maxLevels) {
  const levels = [];

  let currentLevelIds = [new mongoose.Types.ObjectId(rootUserId)];
  let depth = 0;

  while (depth < maxLevels) {
    const children = await User.find({
      referredBy: { $in: currentLevelIds }
    })
      .select('_id referredBy')
      .lean();

    if (!children.length) break;

    levels.push(children);
    currentLevelIds = children.map((c) => c._id);
    depth++;
  }

  return levels;
}

/**
 * GET /api/team/overview
 * Leader card + basic team stats based on user role.
 *
 * Rules:
 * - Leader = current user (always)
 * - If role = SUBADMIN → full tree (up to 50 levels)
 * - Else → only care up to 9 levels
 */
const getTeamOverview = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(userId)
      .select(
        'firstName lastName phone email role createdAt planActivatedAt currentPlan referralCode'
      )
      .populate('currentPlan', 'name price')
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSubadmin = user.role === 'SUBADMIN';

    const maxLevels = isSubadmin ? 50 : 9; // hard cap to avoid insane depth
    const levels = await getDownlineLevels(userId, maxLevels);

    const actualLevels = levels.length;
    const visibleLevels = isSubadmin ? actualLevels : Math.min(actualLevels, 9);

    let totalMembers = 0;
    for (const levelArr of levels) totalMembers += levelArr.length;

    // commissions (wallet) for this user
    const commissions = await Commission.find({ earner: userId })
      .select('amount status')
      .lean();

    let releasedTotal = 0;
    let frozenTotal = 0;
    for (const c of commissions) {
      const amt = Number(c.amount) || 0;
      if (c.status === 'RELEASED') releasedTotal += amt;
      else if (c.status === 'FROZEN') frozenTotal += amt;
    }

    return res.json({
      success: true,
      leader: {
        id: user._id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        phone: user.phone,
        email: user.email || null,
        joinedAt: user.planActivatedAt || user.createdAt,
        role: user.role,
        currentPlan: user.currentPlan
          ? {
              id: user.currentPlan._id,
              name: user.currentPlan.name,
              price: user.currentPlan.price
            }
          : null,
        referralCode: user.referralCode
      },
      teamStats: {
        totalMembers,
        actualLevels,   // real levels in DB
        visibleLevels,  // how many tabs you should show to a USER (<=9), full for SUBADMIN
        revenue: {
          releasedTotal,
          frozenTotal
        }
      }
    });
  } catch (err) {
    console.error('getTeamOverview error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/team/level?level=1
 *
 * For USER:
 *   - we serve level from 1..min(actualLevels, 9)
 * For SUBADMIN:
 *   - we allow full depth (up to 50)
 *
 * No search / filter. Just list users at that level + revenueForLeader + lastPurchase.
 */
const getTeamLevel = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(userId).select('role').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSubadmin = user.role === 'SUBADMIN';
    const maxLevels = isSubadmin ? 50 : 9;

    let targetLevel = parseInt(req.query.level, 10) || 1;
    if (targetLevel < 1) targetLevel = 1;
    if (targetLevel > maxLevels) {
      // hard cap if client sends nonsense
      targetLevel = maxLevels;
    }

    // BFS until we reach targetLevel
    let currentLevelIds = [new mongoose.Types.ObjectId(userId)];
    let currentLevel = 0;
    let levelUsers = [];

    while (currentLevel < targetLevel) {
      const children = await User.find({
        referredBy: { $in: currentLevelIds }
      })
        .select('_id firstName lastName phone createdAt currentPlan')
        .populate('currentPlan', 'name price')
        .lean();

      currentLevel += 1;
      if (currentLevel === targetLevel) {
        levelUsers = children;
        break;
      }
      if (!children.length) break;
      currentLevelIds = children.map((c) => c._id);
    }

    if (!levelUsers.length) {
      return res.json({
        success: true,
        level: targetLevel,
        totalMembers: 0,
        members: []
      });
    }

    const levelUserIds = levelUsers.map((u) => u._id);

    // Sum released revenue that this leader (earner=userId) got FROM each member at this level
    const revenueAgg = await Commission.aggregate([
      {
        $match: {
          earner: new mongoose.Types.ObjectId(userId),
          fromUser: { $in: levelUserIds },
          status: 'RELEASED'
        }
      },
      {
        $group: {
          _id: '$fromUser',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const revenueMap = new Map();
    for (const r of revenueAgg) {
      revenueMap.set(r._id.toString(), r.total);
    }

    // Last purchase per member
    const purchaseAgg = await PlanPurchase.aggregate([
      {
        $match: {
          user: { $in: levelUserIds }
        }
      },
      {
        $group: {
          _id: '$user',
          lastPurchaseAt: { $max: '$paidAt' }
        }
      }
    ]);

    const purchaseMap = new Map();
    for (const p of purchaseAgg) {
      purchaseMap.set(p._id.toString(), p.lastPurchaseAt);
    }

    const members = levelUsers.map((u) => {
      const idStr = u._id.toString();
      const revenueForLeader = Number(revenueMap.get(idStr) || 0);
      const lastPurchaseAt = purchaseMap.get(idStr) || null;

      return {
        id: u._id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        phone: u.phone,
        joinedAt: u.createdAt,
        lastPurchaseAt,
        currentPlan: u.currentPlan
          ? {
              id: u.currentPlan._id,
              name: u.currentPlan.name,
              price: u.currentPlan.price
            }
          : null,
        revenueForLeader
      };
    });

    return res.json({
      success: true,
      level: targetLevel,
      totalMembers: members.length,
      members
    });
  } catch (err) {
    console.error('getTeamLevel error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getTeamOverview,
  getTeamLevel
};
