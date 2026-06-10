
const axios = require('axios');
const ServiceCategory = require('../../models/ServiceModel/serviceCategory.model');
const ServiceAgent = require('../../models/ServiceModel/serviceAgent.model');
const { createOtpForPhone, verifyOtpForPhone } = require('../../services/otp.service');
const { generateAccessToken } = require('../../services/jwt.service');

// SMS Gateway Helper Integration (Reusing your SMS India Hub utility)
const sendSmsIndiaHub = async (phone, code) => {
    try {
        const API_KEY = process.env.SMS_API_KEY;
        const SENDER_ID = process.env.SMS_SENDER_ID || "SMSHUB";

        // SMS India Hub expects numbers without the '+' prefix
        const formattedPhone = "91" + phone;
        const message = `Welcome to the truhaat powered by SMSINDIAHUB. Your OTP for registration is ${code}`;

        const response = await axios.get("https://cloud.smsindiahub.in/vendorsms/pushsms.aspx", {
            params: {
                APIKey: API_KEY,
                msisdn: formattedPhone,
                sid: SENDER_ID,
                msg: message,
                fl: 0,
                gwid: 2
            },
            timeout: 5000 // 5 second timeout - don't let a slow API hang your server
        });

        // SMSIndiaHub often returns 200 OK even if the balance is low. 
        // We log the response data for auditing.
        return response.data;
    } catch (error) {
        // Log the error for monitoring (like Sentry or Datadog)
        console.error(`SMS Service Error: ${error.message}`);
        throw new Error("Failed to send SMS gateway request");
    }
};

// ==========================================
// ADMIN DASHBOARD CONTROLLERS
// ==========================================

const onboardAgentByAdmin = async (req, res) => {
    try {
        const { phone, firstName, lastName, allowedCategoryId, email } = req.body;

        if (!phone || !firstName || !allowedCategoryId) {
            return res.status(400).json({ success: false, error: 'phone, firstName, and allowedCategoryId are required' });
        }

        // 1. Validate category mapping exists
        const categoryExists = await ServiceCategory.findById(allowedCategoryId);
        if (!categoryExists) {
            return res.status(404).json({ success: false, error: 'Assigned Service Category not found' });
        }

        // 2. Check duplicate phone records
        const existingAgent = await ServiceAgent.findOne({ phone: phone.trim() });
        if (existingAgent) {
            return res.status(400).json({ success: false, error: 'An agent with this phone number is already registered' });
        }

        // 3. Create profile
        const agent = await ServiceAgent.create({
            phone: phone.trim(),
            firstName: firstName.trim(),
            lastName: lastName ? lastName.trim() : '',
            allowedCategory: allowedCategoryId,
            email: email ? email.trim() : undefined
        });

        return res.status(201).json({ success: true, data: agent });
    } catch (error) {
        console.error('onboardAgentByAdmin Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const fetchPincodeFromOpenStreetMap = async (lat, lng) => {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: {
                format: 'jsonv2',
                lat: parseFloat(lat),
                lon: parseFloat(lng),
                'accept-language': 'en',
                addressdetails: 1
            },
            headers: {
                // OpenStreetMap requires a distinct User-Agent to avoid automatic rate-limiting bans
                'User-Agent': 'TruhaatServiceMobileApp/1.0 (info@truhaat.com)'
            },
            timeout: 6000 // 6-second threshold timeout
        });

        if (!response.data || !response.data.address) {
            throw new Error('Coordinates could not be mapped to structural address nodes.');
        }

        const address = response.data.address;

        // Extract the postal code parameter
        const pincode = address.postcode;

        if (!pincode) {
            throw new Error('Postal zone pincode attribute missing from OpenStreetMap address payload.');
        }

        return pincode.trim(); // Returns e.g., "302029"
    } catch (error) {
        console.error('fetchPincodeFromOpenStreetMap Error:', error.message);
        throw error;
    }
};

// ==========================================
// AGENT APP AUTHENTICATION CONTROLLERS
// ==========================================

const sendAgentOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        // 1. Secure check: Ensure agent was pre-onboarded by admin
        const agent = await ServiceAgent.findOne({ phone: phone.trim(), isActive: true });
        if (!agent) {
            return res.status(403).json({
                success: false,
                error: 'Access Denied',
                message: 'Your number is not registered as a Service Agent. Please contact administration.'
            });
        }

        // 2. Generate generic system OTP using your service helper
        const { code } = await createOtpForPhone(phone.trim());

        // 3. Fire message via gateway
        await sendSmsIndiaHub(phone.trim(), code);

        return res.json({
            success: true,
            message: 'Verification OTP sent to your registered mobile number'
        });
    } catch (error) {
        console.error('sendAgentOtp Error:', error);
        return res.status(500).json({ success: false, error: 'Failed to process OTP dispatch' });
    }
};

const verifyAgentOtp = async (req, res) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({ success: false, error: 'Phone and code are required' });
        }

        // 1. Verify OTP lifecycle through system service
        const verificationResult = await verifyOtpForPhone(phone.trim(), code.trim());
        if (!verificationResult.ok) {
            return res.status(400).json({ success: false, error: 'Invalid or expired authentication code' });
        }

        // 2. Extract profile details to issue contextual token scope
        const agent = await ServiceAgent.findOne({ phone: phone.trim() }).populate('allowedCategory');
        if (!agent || !agent.isActive) {
            return res.status(403).json({ success: false, error: 'Agent profile inactive or suspended' });
        }

        // 3. Inject role properties so your generateAccessToken service signs it correctly
        // Passing a clean schema representation to avoid token bloat
        const sessionPayload = {
            _id: agent._id,
            phone: agent.phone,
            role: 'SERVICE_AGENT',
            allowedCategory: agent.allowedCategory._id
        };

        const token = generateAccessToken(sessionPayload);

        return res.json({
            success: true,
            token,
            agent: {
                _id: agent._id,
                firstName: agent.firstName,
                lastName: agent.lastName,
                phone: agent.phone,
                allowedCategory: agent.allowedCategory
            }
        });
    } catch (error) {
        console.error('verifyAgentOtp Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// Add this method to serviceAgent.controller.js
const updateAgentLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const agentId = req.agent.sub; // Extracted safely from our Auth Middleware layer
        // console.log(`Received location update from Agent ${agentId}: lat=${latitude}, lng=${longitude}`);

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ success: false, error: 'Latitude and Longitude parameters are required.' });
        }

        // Parse coordinates to strict floating numbers
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        // Basic validation bounds check
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ success: false, error: 'Invalid coordinate values supplied.' });
        }

        const updatedAgent = await ServiceAgent.findByIdAndUpdate(
            agentId,
            {
                location: {
                    type: 'Point',
                    coordinates: [lng, lat] // Longitude always goes FIRST inside GeoJSON arrays
                }
            },
            { new: true }
        );

        if (!updatedAgent) {
            return res.status(404).json({ success: false, error: 'Service Agent profile not found.' });
        }

        // 2. STEP TWO: Call free OpenStreetMap background utility to identify regional pincode zone track
        let resolvedPincode;
        try {
            resolvedPincode = await fetchPincodeFromOpenStreetMap(lat, lng);
            console.log(`📍 OpenStreetMap mapped coordinates [${lat}, ${lng}] directly to Pincode: ${resolvedPincode}`);
        } catch (geoError) {
            // Graceful fallback: If OSM is busy or down, do not block the agent's application entirely.
            // Provide a sensible regional corporate default center point string code for Jaipur
            resolvedPincode = '302029';
            console.log('⚠️ OpenStreetMap lookup failed, falling back safely to default testing track: 302029');
        }

        // 3. STEP THREE: Keep DB clean with coords, but send clean pincode text directly back to frontend
        return res.status(200).json({
            success: true,
            message: 'Agent baseline work coordinate entries saved to database.',
            data: {
                pincode: resolvedPincode
            }
        });

    } catch (error) {
        console.error('updateAgentLocation Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error while saving spatial context.' });
    }
};

// ==========================================
// NEW: TOGGLE ONLINE / OFFLINE STATUS
// ==========================================
const toggleAgentOnlineStatus = async (req, res) => {
    try {
        const { isOnline } = req.body;
        const agentId = req.agent._id || req.agent.sub; // Handled dynamically based on token middleware extract

        if (isOnline === undefined || typeof isOnline !== 'boolean') {
            return res.status(400).json({ success: false, error: "The 'isOnline' parameter must be a boolean (true/false)." });
        }

        const updatedAgent = await ServiceAgent.findByIdAndUpdate(
            agentId,
            { isOnline },
            { new: true }
        );

        if (!updatedAgent) {
            return res.status(404).json({ success: false, error: 'Service Agent profile not found.' });
        }

        return res.status(200).json({
            success: true,
            message: `Agent is now ${updatedAgent.isOnline ? 'Online' : 'Offline'}.`,
            data: {
                isOnline: updatedAgent.isOnline
            }
        });
    } catch (error) {
        console.error('toggleAgentOnlineStatus Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error while updating status.' });
    }
};


module.exports = {
    onboardAgentByAdmin,
    sendAgentOtp,
    verifyAgentOtp,
    updateAgentLocation,
    toggleAgentOnlineStatus
};