const axios = require('axios');
const shopModel = require("../../models/Shop/shop.model");
const { createOtpForPhone, verifyOtpForPhone } = require('../../services/otp.service');
const { generateAccessToken } = require('../../services/jwt.service');

// --- SMS Helper ---
const sendSmsIndiaHub = async (phone, code) => {
    try {
        const API_KEY = process.env.SMS_API_KEY;
        const SENDER_ID = process.env.SMS_SENDER_ID || "SMSHUB";
        const formattedPhone = "91" + phone;
        const message = `Welcome to truhaat powered by SMSINDIAHUB. Your OTP for shop login is ${code}`;

        const response = await axios.get("https://cloud.smsindiahub.in/vendorsms/pushsms.aspx", {
            params: {
                APIKey: API_KEY,
                msisdn: formattedPhone,
                sid: SENDER_ID,
                msg: message,
                fl: 0,
                gwid: 2
            },
            timeout: 5000
        });
        return response.data;
    } catch (error) {
        console.error(`SMS Service Error: ${error.message}`);
        throw new Error("Failed to send SMS gateway request");
    }
};

// ==========================================
// SHOP AUTHENTICATION CONTROLLERS
// ==========================================

exports.sendShopOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        // 1. Verify if this phone number belongs to a registered shop owner
        const shop = await shopModel.findOne({ 'owner.mobile': phone.trim() });

        if (!shop) {
            return res.status(404).json({
                success: false,
                error: 'No registered shop found with this mobile number. Please contact administration.'
            });
        }

        if (!shop.isOpen) {
            return res.status(403).json({
                success: false,
                error: 'Your shop account is currently suspended or closed.'
            });
        }

        // 2. Generate OTP
        const { code, expiresAt } = await createOtpForPhone(phone.trim());
        console.log(`[SHOP LOGIN] DEV OTP for ${phone}: ${code}, expiresAt=${expiresAt.toISOString()}`);

        // 3. Send SMS
        await sendSmsIndiaHub(phone.trim(), code);

        return res.json({
            success: true,
            message: 'OTP sent successfully to your registered mobile number.',
        });
    } catch (error) {
        console.error('sendShopOtp Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error while sending OTP.' });
    }
};

exports.verifyShopOtp = async (req, res) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({ success: false, error: 'Phone and code are required' });
        }

        // 1. Verify OTP
        const result = await verifyOtpForPhone(phone.trim(), code.trim());

        if (!result.ok) {
            const reasonMap = {
                not_found: { status: 400, msg: 'OTP not found or already used' },
                expired: { status: 400, msg: 'OTP expired' },
                invalid: { status: 400, msg: 'Invalid OTP' },
                too_many_attempts: { status: 429, msg: 'Too many invalid attempts' }
            };

            const info = reasonMap[result.reason] || { status: 400, msg: 'OTP verification failed' };
            return res.status(info.status).json({ success: false, error: info.msg });
        }

        // 2. Find the Shop again
        const shop = await shopModel.findOne({ 'owner.mobile': phone.trim() });
        if (!shop) {
            return res.status(404).json({ success: false, error: 'Shop not found.' });
        }

        // 3. Generate JWT Token with SHOP role
        // Passing a clean payload so your auth middleware knows this is a Shop User
        const sessionPayload = {
            _id: shop._id,
            role: 'SHOP',
            phone: shop.owner.mobile,
            shopName: shop.name
        };

        const token = generateAccessToken(sessionPayload);

        // 4. Return ONLY token and success status (No heavy shop data)
        return res.json({
            success: true,
            message: 'Login successful',
            token
        });
    } catch (error) {
        console.error('verifyShopOtp error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error during verification.' });
    }
};

exports.getShopProfile = async (req, res) => {
    try {
        // req.user is populated by your requireAuth middleware from the JWT
        const shopId = req.user._id || req.user.sub;

        // Fetch shop and populate the category name if needed
        const shop = await shopModel.findById(shopId).populate('firmCategory', 'name image');

        if (!shop) {
            return res.status(404).json({ success: false, error: 'Shop profile not found' });
        }

        return res.json({
            success: true,
            data: shop
        });
    } catch (error) {
        console.error('getShopProfile Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error fetching profile.' });
    }
};