const shopModel = require("../models/Shop/shop.model");
const User = require("../models/user.model");
const { verifyToken } = require("../services/jwt.service");

const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        console.log("auth header", authHeader)

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization header missing or invalid' });
        }

        const token = authHeader.split(' ')[1]; // "Bearer TOKEN"
        // console.log("we are here",token)

        let payload;

        try {
            payload = verifyToken(token)
        } catch (error) {
            console.error('JWT verify error', error.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Basic sanity check
        if (!payload.sub) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        const user = await User.findById(payload.sub);

        if (!user) {
            return res.status(401).json({ error: 'User not found for this token' });
        }

        req.user = {
            id: user._id.toString(),
            phone: user.phone,
            tokenPayload: payload,
            doc: user
        };

        // console.log("reqUser",req.user)

        next();
    } catch (error) {
        console.error('requireAuth error', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

const requireShopAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Authorization header missing or invalid' });
        }

        const token = authHeader.split(' ')[1];
        let payload;

        try {
            payload = verifyToken(token);
        } catch (error) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token' });
        }

        if (!payload.sub) {
            return res.status(401).json({ success: false, error: 'Invalid token payload' });
        }

        // Search in the Shop collection instead of User
        const shop = await shopModel.findById(payload.sub);

        if (!shop) {
            return res.status(401).json({ success: false, error: 'Shop not found for this token' });
        }

        if (!shop.isOpen) {
            return res.status(403).json({ success: false, error: 'Shop account is currently suspended.' });
        }

        // Map it to req.user so your existing controllers still work perfectly
        req.user = {
            _id: shop._id,
            sub: shop._id,
            role: 'SHOP',
            doc: shop
        };

        next();
    } catch (error) {
        console.error('requireShopAuth error', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

module.exports = {
    requireAuth,
    requireShopAuth
};