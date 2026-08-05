const express = require('express');
const multer = require('multer');
const { onboardAgentByAdmin, sendAgentOtp, verifyAgentOtp, updateAgentLocation, toggleAgentOnlineStatus, getAllAgentsByAdmin } = require('../../controllers/serviceControllers/serviceAgent.controller');
const agentAuthGuard = require('../../middleware/agentAuth.middleware');
const { getAgentPendingEnquiries, completeServiceWithOtp } = require('../../controllers/serviceControllers/serviceBooking.controller');
const serviceAgentrouter = express.Router();

// 1. Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Optional: 5MB limit per file
});

// Admin Action Routing
serviceAgentrouter.post(
    '/admin/onboard-agent',
    upload.fields([
        { name: 'profilePic', maxCount: 1 },
        { name: 'panCard', maxCount: 1 },
        { name: 'cancelledCheque', maxCount: 1 },
        { name: 'identityDocument', maxCount: 1 }
    ]),
    onboardAgentByAdmin
);

serviceAgentrouter.get('/admin/all', getAllAgentsByAdmin);

// Mobile Application Access Routing
serviceAgentrouter.post('/auth/send-otp', sendAgentOtp);
serviceAgentrouter.post('/auth/verify-otp', verifyAgentOtp);

serviceAgentrouter.post('/profile/work-location', agentAuthGuard, updateAgentLocation);
serviceAgentrouter.post('/profile/status', agentAuthGuard, toggleAgentOnlineStatus);

serviceAgentrouter.get('/profile/pending-jobs', agentAuthGuard, getAgentPendingEnquiries);
serviceAgentrouter.post('/profile/verify-job-otp', agentAuthGuard, completeServiceWithOtp);

module.exports = serviceAgentrouter;