const express = require('express');
const { onboardAgentByAdmin, sendAgentOtp, verifyAgentOtp, updateAgentLocation, toggleAgentOnlineStatus } = require('../../controllers/serviceControllers/serviceAgent.controller');
const agentAuthGuard = require('../../middleware/agentAuth.middleware');
const { getAgentPendingEnquiries, completeServiceWithOtp } = require('../../controllers/serviceControllers/serviceBooking.controller');
const serviceAgentrouter = express.Router();

// Admin Action Routing
serviceAgentrouter.post('/admin/onboard-agent', onboardAgentByAdmin);

// Mobile Application Access Routing
serviceAgentrouter.post('/auth/send-otp', sendAgentOtp);
serviceAgentrouter.post('/auth/verify-otp', verifyAgentOtp);

serviceAgentrouter.post('/profile/work-location', agentAuthGuard, updateAgentLocation);
serviceAgentrouter.post('/profile/status', agentAuthGuard, toggleAgentOnlineStatus);

serviceAgentrouter.get('/profile/pending-jobs', agentAuthGuard, getAgentPendingEnquiries);
serviceAgentrouter.post('/profile/verify-job-otp', agentAuthGuard, completeServiceWithOtp);

module.exports = serviceAgentrouter;