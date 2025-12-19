const axios = require('axios');

const ERA_BASE_URL = process.env.ERA_BASE_URL;
const ERA_API_KEY = process.env.ERA_API_KEY;

const eraClient = axios.create({
    baseURL: ERA_BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' }
});

// 1️⃣ Send Aadhaar OTP
async function sendAadhaarOtp(aadhaarNumber) {
    const res = await eraClient.post('/api/v1/aadhaar-v2/generate-otp', {
        key: ERA_API_KEY,
        id_number: aadhaarNumber
    });
    return res.data;
}

// 2️⃣ Verify Aadhaar OTP
async function verifyAadhaarOtp(requestId, otp) {
    const res = await eraClient.post('/api/v1/aadhaar-v2/submit-otp', {
        key: ERA_API_KEY,
        request_id: requestId,
        otp
    });
    return res.data;
}

// 3️⃣ Verify PAN
async function verifyPan(panNumber) {
    const res = await eraClient.post('/api/v1/pan/pan', {
        key: ERA_API_KEY,
        id_number: panNumber
    });
    return res.data;
}

// 4️⃣ Verify Bank
async function verifyBank(accountNumber, ifsc) {
    const res = await eraClient.post('/api/v1/bank-verification', {
        key: ERA_API_KEY,
        id_number: accountNumber,
        ifsc
    });
    return res.data;
}

module.exports = {
    sendAadhaarOtp,
    verifyAadhaarOtp,
    verifyPan,
    verifyBank
};
