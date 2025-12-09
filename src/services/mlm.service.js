// src/services/mlm.service.js
const User = require('../models/user.model');
const PlanPurchase = require('../models/planPurchase.model');
const Commission = require('../models/commission.model');

const MAX_LEVELS = 9;
// Right now 1%, later you can make this dynamic per subadmin plan
const ROOT_PERCENT = 0.01;

function computeLevelShares(total, numLevels) {
    if (numLevels <= 0 || total <= 0) return [];

    // weights: nearest ancestor gets most
    // Example: L=3 -> [3,2,1] => closer gets more
    const weights = [];
    for (let i = 0; i < numLevels; i++) {
        weights.push(numLevels - i); // L, L-1, ..., 1
    }

    const sumW = weights.reduce((a, b) => a + b, 0);
    const shares = weights.map(w => Number((total * w / sumW).toFixed(2)));

    // Fix rounding: adjust last share
    const sumShares = shares.reduce((a, b) => a + b, 0);
    const diff = Number((total - sumShares).toFixed(2));
    shares[shares.length - 1] += diff;

    return shares;
}

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

    // 3) ROOT 1%: to mlmRoot (subadmin) or admin
    if (rootCut > 0) {
        if (buyer.mlmRoot) {
            const rootUser = await User.findById(buyer.mlmRoot)
                .select('_id directActiveRefCount');

            if (rootUser) {
                const status = rootUser.directActiveRefCount >= 2 ? 'RELEASED' : 'FROZEN';

                await Commission.create({
                    earner: rootUser._id,
                    earnerType: 'USER',
                    fromUser: buyer._id,
                    plan: plan._id,
                    purchase: purchase._id,
                    level: null,
                    kind: 'ROOT_1P',
                    amount: rootCut,
                    status
                });
            }
        } else {
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


    if (!ancestors.length) {
        // No upline at all → whole 10% goes to admin
        if (mlmPool > 0) {
            await Commission.create({
                earner: null,
                earnerType: 'ADMIN',
                fromUser: buyer._id,
                plan: plan._id,
                purchase: purchase._id,
                level: null,
                kind: 'MLM_LEVEL',
                amount: mlmPool,
                status: 'RELEASED'
            });
        }
    } else {
        const shares = computeLevelShares(mlmPool, ancestors.length);

        // ancestors[0] = level 1 (closest), ancestors[1] = level 2, ...
        for (let i = 0; i < ancestors.length; i++) {
            const anc = ancestors[i];
            const level = i + 1;
            const amount = shares[i];

            if (amount <= 0) continue;

            const status = anc.directActiveRefCount >= 2 ? 'RELEASED' : 'FROZEN';

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
