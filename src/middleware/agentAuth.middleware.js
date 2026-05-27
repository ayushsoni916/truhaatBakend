const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Token token missing.' });
        }

        const token = authHeader.split(' ')[1];
        // Uses your secret key to unpack the session payload we generated at login
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'YOUR_JWT_SECRET_KEY_HERE');
        
        req.agent = verified; // Injects _id, phone, and role into the request lifecycle
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Forbidden', message: 'Invalid or expired token.' });
    }
};