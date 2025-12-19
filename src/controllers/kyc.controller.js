const User = require('../models/user.model');
const {
    sendAadhaarOtp,
    verifyAadhaarOtp,
    verifyPan,
    verifyBank
} = require('../services/kyc.service');

const normalizeName = (name = '') =>
    name.toLowerCase().replace(/\s+/g, ' ').trim();

// 1️⃣ Send Aadhaar OTP
exports.sendAadhaarOtp = async (req, res) => {
    try {
        const { aadhaarNumber } = req.body;
        if (!aadhaarNumber) {
            return res.status(400).json({ error: 'aadhaarNumber is required' });
        }

        const data = await sendAadhaarOtp(aadhaarNumber);
        console.log('Aadhaar OTP sent:', data);
        return res.json({ success: true, data });
    } catch (err) {
        console.error('sendAadhaarOtp error', err);
        return res.status(500).json({ error: 'Aadhaar OTP failed' });
    }
};

// 2️⃣ Verify Aadhaar OTP
exports.verifyAadhaarOtp = async (req, res) => {
    try {
        const { requestId, otp } = req.body;
        const user = req.user.doc;

        if (!requestId || !otp) {
            return res.status(400).json({ error: 'requestId and otp required' });
        }

        // Already verified → block re-verification
        if (user.isAadhaarVerified) {
            return res.status(400).json({ error: 'Aadhaar already verified' });
        }

        const result = await verifyAadhaarOtp(requestId, otp);

        if (result.status !== 'success') {
            return res.status(400).json({ error: 'Aadhaar verification failed' });
        }

        const d = result.data;

        // 🔒 PAN consistency check (if PAN already verified)
        if (user.isPanVerified && user.pan?.name) {
            const panName = normalizeName(user.pan.name);
            const aadhaarName = normalizeName(d.full_name);

            if (panName !== aadhaarName) {
                return res.status(400).json({
                    error: 'Aadhaar name does not match PAN records'
                });
            }
        }

        user.aadhaar = {
            number: d.aadhaar_number,
            name: d.full_name,
            dob: d.dob,
            gender: d.gender,
            address: d.address,
            verifiedAt: new Date()
        };
        user.isAadhaarVerified = true;

        await user.save();

        return res.json({ success: true, aadhaar: user.aadhaar });
    } catch (err) {
        console.error('verifyAadhaarOtp error', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// 3️⃣ Verify PAN
exports.verifyPan = async (req, res) => {
    try {
        const { panNumber } = req.body;
        const user = req.user.doc;

        if (!panNumber) {
            return res.status(400).json({ error: 'panNumber is required' });
        }

        // Already verified → block overwrite
        if (user.isPanVerified) {
            return res.status(400).json({ error: 'PAN already verified' });
        }

        const result = await verifyPan(panNumber);

        if (result.status !== 'success') {
            return res.status(400).json({ error: 'PAN verification failed' });
        }

        const panName = result.data?.full_name || '';
        console.log('PAN verified name:', panName);

        // 🔒 Aadhaar consistency check (if Aadhaar already verified)
        if (user.isAadhaarVerified && user.aadhaar?.name) {
            const aadhaarName = normalizeName(user.aadhaar.name);
            const normalizedPanName = normalizeName(panName);

            console.log('Comparing Aadhaar name and PAN name:', aadhaarName, normalizedPanName);

            if (aadhaarName !== normalizedPanName) {
                return res.status(400).json({
                    error: 'PAN name does not match Aadhaar records'
                });
            }
        }

        user.pan = {
            number: panNumber,
            name: result.data?.name || '',
            verifiedAt: new Date()
        };
        user.isPanVerified = true;

        await user.save();

        return res.json({ success: true, pan: user.pan });
    } catch (err) {
        console.error('verifyPan error', err);
        return res.status(500).json({ error: 'PAN verification failed' });
    }
};

// 4️⃣ Verify Bank
exports.verifyBank = async (req, res) => {
    try {
        console.log('body', req.body);
        const { accountNumber, ifsc } = req.body;
        const user = req.user.doc;

        if (!accountNumber || !ifsc) {
            return res.status(400).json({ error: 'accountNumber and ifsc required' });
        }

        const result = await verifyBank(accountNumber, ifsc);

        user.bank = {
            accountNumber,
            ifsc,
            bankName: result.data?.bank_name || '',
            verifiedAt: new Date()
        };
        user.isBankVerified = true;

        await user.save();

        return res.json({ success: true, bank: user.bank });
    } catch (err) {
        console.error('verifyBank error', err);
        return res.status(500).json({ error: 'Bank verification failed' });
    }
};
