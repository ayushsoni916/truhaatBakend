const User = require("../models/user.model");

const createUser = async (req, res) => {
    try {
        const { phone, firstName, lastName, email } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'phone is required' });
        }

        const user = new User({
            phone,
            firstName,
            lastName,
            email
        })

        await user.save()

        return res.status(200).json({
            user: {
                id: user._id,
                phone: user.phone,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                createdAt: user.createdAt
            }
        })

    }
    catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'User with this phone already exists' });
        }
        return next(err);
    }
}

module.exports = {
    createUser
}