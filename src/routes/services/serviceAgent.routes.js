const express = require('express');
const { onboardAgentByAdmin, sendAgentOtp, verifyAgentOtp } = require('../../controllers/serviceControllers/serviceAgent.controller');
const serviceAgentrouter = express.Router();


// Admin Action Routing
serviceAgentrouter.post('/admin/onboard-agent', onboardAgentByAdmin);

// Mobile Application Access Routing
serviceAgentrouter.post('/auth/send-otp', sendAgentOtp);
serviceAgentrouter.post('/auth/verify-otp', verifyAgentOtp);

module.exports = serviceAgentrouter;