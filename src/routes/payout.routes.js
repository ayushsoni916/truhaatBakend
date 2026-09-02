const express = require('express');
const payoutRouter = express.Router();
const { requireAuth } = require('../middleware/auth.middleware'); // Adjust path to your auth middleware
const {
    requestPayout,
    getPayoutRequestsAdmin,
    updatePayoutStatusAdmin
} = require('../controllers/payout.controller');

// ==========================
// USER ROUTES
// ==========================
// User requests a new withdrawal
payoutRouter.post('/request', requireAuth, requestPayout);


// ==========================
// ADMIN ROUTES
// ==========================
// Get all payout requests (with pagination, filter, search)
payoutRouter.get('/admin/all', getPayoutRequestsAdmin);

// Update a payout status (Approve/Reject)
payoutRouter.put('/admin/:requestId', updatePayoutStatusAdmin);

module.exports = payoutRouter;