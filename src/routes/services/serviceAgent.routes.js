const express = require('express');
const { onboardAgentByAdmin, sendAgentOtp, verifyAgentOtp, updateAgentLocation } = require('../../controllers/serviceControllers/serviceAgent.controller');
const agentAuthGuard = require('../../middleware/agentAuth.middleware');
const serviceAgentrouter = express.Router();

// Admin Action Routing
serviceAgentrouter.post('/admin/onboard-agent', onboardAgentByAdmin);

// Mobile Application Access Routing
serviceAgentrouter.post('/auth/send-otp', sendAgentOtp);
serviceAgentrouter.post('/auth/verify-otp', verifyAgentOtp);

serviceAgentrouter.post('/profile/work-location', agentAuthGuard, updateAgentLocation);

module.exports = serviceAgentrouter;