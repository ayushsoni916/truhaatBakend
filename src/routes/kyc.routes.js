const express = require('express');
const kycRouter = express.Router();
const { sendAadhaarOtp, verifyAadhaarOtp, verifyPan, verifyBank } = require('../controllers/kyc.controller');
const { requireAuth } = require('../middleware/auth.middleware');

kycRouter.post('/aadhaar/send-otp', requireAuth, sendAadhaarOtp);
kycRouter.post('/aadhaar/verify-otp', requireAuth, verifyAadhaarOtp);
kycRouter.post('/pan/verify', requireAuth, verifyPan);
kycRouter.post('/bank/verify', requireAuth, verifyBank);

module.exports = kycRouter;