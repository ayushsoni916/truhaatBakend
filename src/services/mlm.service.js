// src/services/mlm.service.js
const User = require('../models/user.model');
const PlanPurchase = require('../models/planPurchase.model');
const Commission = require('../models/commission.model');
const Plan = require('../models/plan.model');

// L1 → 28%
// L2 → 18%
// L3 → 15%
// L4 → 9%
// L5 → 8%
// L6 → 7%
// L7 → 6%
// L8 → 5%
// L9 → 4%
// TOTAL = 100% of MLM pool (10% of price)


const MAX_LEVELS = 9;
// Right now 1%, later you can make this dynamic per subadmin plan
const ROOT_PERCENT = 0.01;
const LEVEL_PERCENTS = [28, 18, 15, 9, 8, 7, 6, 5, 4]; // sum = 100

async function getAncestors(user, maxLevels = MAX_LEVELS) {
    const ancestors = [];
    let currentParentId = user.referredBy;
    let level = 0;

    while (currentParentId && level < maxLevels) {
        const parent = await User.findById(currentParentId)
            .select('_id referredBy directActiveRefCount role');
        if (!parent) break;

        ancestors.push(parent);
        currentParentId = parent.referredBy;
        level++;
    }

    return ancestors;
}

async function handlePlanPurchase(buyer, plan, purchase) {
    const price = plan.price;
    const mlmPercent = 10; // you said fixed 10% for now
    const mlmPool = price * (mlmPercent / 100);    // 10% for levels
    const rootCut = price * ROOT_PERCENT;          // 1% for mlmRoot/admin

    // 1) Is this buyer's first plan purchase? (for pair logic)
    const purchaseCount = await PlanPurchase.countDocuments({ user: buyer._id });
    const isFirstPlanPurchase = purchaseCount === 1;

    let parentJustCompletedPair = null;

    // 2) If first plan purchase and buyer has a direct parent, increment parent's directActiveRefCount
    if (isFirstPlanPurchase && buyer.referredBy) {
        const parent = await User.findById(buyer.referredBy).select('directActiveRefCount');
        if (parent) {
            const oldCount = parent.directActiveRefCount || 0;
            parent.directActiveRefCount = oldCount + 1;
            await parent.save();

            if (oldCount < 2 && parent.directActiveRefCount >= 2) {
                parentJustCompletedPair = parent._id; // will unfreeze later
            }
        }
    }

    // 3) ROOT x%: to mlmRoot (subadmin) or 1% to admin
    if (rootCut > 0) {
        if (buyer.mlmRoot) {
            const rootUser = await User.findById(buyer.mlmRoot)
                .select('_id directActiveRefCount');

            if (rootUser && rootUser.role === 'SUBADMIN' && rootUser.currentPlan) {
                const subAdminPlan = await Plan.findById(rootUser.currentPlan)
                    .select('referralPercent');

                if (subAdminPlan && subAdminPlan.referralPercent > 0) {
                    const amount = Number(
                        (price * subAdminPlan.referralPercent / 100).toFixed(2)
                    );
                    const status = rootUser.directActiveRefCount >= 2 ? 'RELEASED' : 'FROZEN';

                    await Commission.create({
                        earner: rootUser._id,
                        earnerType: 'USER',
                        fromUser: buyer._id,
                        plan: plan._id,
                        purchase: purchase._id,
                        level: null,
                        kind: 'SUBADMIN_REFERRAL',
                        amount,
                        status: status
                    });
                }
            }
        }
        else {
            // No subadmin tree above -> 1% stays with admin (we still record it)
            await Commission.create({
                earner: null,
                earnerType: 'ADMIN',
                fromUser: buyer._id,
                plan: plan._id,
                purchase: purchase._id,
                level: null,
                kind: 'ROOT_1P',
                amount: rootCut,
                status: 'RELEASED' // admin is always "qualified"
            });
        }
    }

    // 4) 10% MLM levels
    const rawAncestors = await getAncestors(buyer, MAX_LEVELS);

    // Exclude SUBADMINs from MLM_LEVEL distribution
    const ancestors = rawAncestors.filter(a => a.role !== 'SUBADMIN');

    let adminRemainder = 0;

    for (let i = 0; i < ancestors.length && i < LEVEL_PERCENTS.length; i++) {
        const anc = ancestors[i];
        const level = i + 1;
        const percent = LEVEL_PERCENTS[i];
        const amount = Number((mlmPool * percent / 100).toFixed(2));

        const status =
            anc.directActiveRefCount >= 2 ? 'RELEASED' : 'FROZEN';

        await Commission.create({
            earner: anc._id,
            earnerType: 'USER',
            fromUser: buyer._id,
            plan: plan._id,
            purchase: purchase._id,
            level,
            kind: 'MLM_LEVEL',
            amount,
            status
        });
    }

    // ✅ ADMIN gets everything else in ONE ENTRY
    const paidPercent = LEVEL_PERCENTS
        .slice(0, ancestors.length)
        .reduce((a, b) => a + b, 0);

    const remainingPercent = 100 - paidPercent;

    if (remainingPercent > 0) {
        const adminAmount = Number((mlmPool * remainingPercent / 100).toFixed(2));

        await Commission.create({
            earner: null,
            earnerType: 'ADMIN',
            fromUser: buyer._id,
            plan: plan._id,
            purchase: purchase._id,
            level: null,
            kind: 'MLM_LEVEL',
            amount: adminAmount,
            status: 'RELEASED'
        });
    }

    // 5) If some parent just completed pair, unfreeze all their commissions
    if (parentJustCompletedPair) {
        await Commission.updateMany(
            { earner: parentJustCompletedPair, status: 'FROZEN' },
            { $set: { status: 'RELEASED' } }
        );
    }
}

module.exports = {
    handlePlanPurchase
};
