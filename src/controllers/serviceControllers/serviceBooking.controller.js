const ServiceAgent = require('../../models/ServiceModel/serviceAgent.model');
const ServiceCategory = require('../../models/ServiceModel/serviceCategory.model');
const ServiceSubService = require('../../models/ServiceModel/serviceSubService.model');
const ServicePriceBook = require('../../models/ServiceModel/servicePriceBook.model');
const ServiceBooking = require('../../models/ServiceModel/serviceBooking.model'); // Make sure you created this model!
const ServiceSubcategory = require('../../models/ServiceModel/serviceSubcategory.model');
const paymentModel = require('../../models/payment.model');
const Razorpay = require('razorpay');


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// =========================================================
// 1. GET AVAILABLE SERVICES BASED ON LIVE NEARBY AGENTS
// =========================================================
const getLiveAvailableServices = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        console.log(latitude, longitude)

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ success: false, error: 'User coordinates (latitude & longitude) are required.' });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        // Find all online and active agents within a 5km radius
        const nearbyAgents = await ServiceAgent.find({
            // uncomment these lines if you want to filter by online/active status as well
            // isOnline: true,
            // isActive: true,
            location: {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    $maxDistance: 50000 // 50 Kilometers 
                }
            }
        }).select('allowedCategory');

        if (!nearbyAgents || nearbyAgents.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No service providers are online in your area right now.",
                data: []
            });
        }

        // Extract unique category IDs from the nearby active agents
        const availableCategoryIds = [...new Set(nearbyAgents.map(agent => agent.allowedCategory.toString()))];

        // Fetch the full category details for these available IDs
        const liveCategories = await ServiceCategory.find({
            _id: { $in: availableCategoryIds },
            isActive: true
        });

        return res.status(200).json({
            success: true,
            message: `Found active providers nearby.`,
            data: liveCategories
        });

    } catch (error) {
        console.error('getLiveAvailableServices Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error resolving live area categories.' });
    }
};

// =========================================================
// 2. BOOK A SERVICE (AUTO-ASSIGN TO FAIREST PROVIDER)
// =========================================================
const bookServiceInstant = async (req, res) => {
    try {
        console.log("api called")
        const { subServiceId, pincode, latitude, longitude, houseNumber, streetAddress } = req.body;
        const userId = req.user._id; // Extracted from your requireAuth middleware layer
        console.log(subServiceId, pincode, latitude, longitude, houseNumber, streetAddress)

        if (!subServiceId || !pincode || latitude === undefined || longitude === undefined || houseNumber === undefined || streetAddress === undefined) {
            console.log("we are here")
            return res.status(400).json({ success: false, error: 'subServiceId, pincode, and coordinates are required.' });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const cleanPincode = pincode.trim();

        // 1. Verify the sub-service exists and get its details
        const subService = await ServiceSubcategory.findById(subServiceId);
        console.log("sub service", subService)
        if (!subService || !subService.isActive) {
            return res.status(404).json({ success: false, error: 'Requested service item is unavailable or inactive.' });
        }

        const parentCategoryId = subService.parentCategory;
        console.log(parentCategoryId, "is here")

        // 2. Fetch price from the price book for this specific pincode
        // const priceMatch = await ServicePriceBook.findOne({
        //     subService: subServiceId,
        //     pincode: cleanPincode,
        //     isActive: true
        // });

        // if (!priceMatch) {
        //     return res.status(404).json({
        //         success: false,
        //         error: 'PRICE_NOT_FOUND',
        //         message: 'Pricing has not been configured for this service item in your pincode.'
        //     });
        // }

        // 3. Find all online matching providers within 5km, sorted by workload
        const eligibleAgents = await ServiceAgent.find({
            allowedCategory: parentCategoryId,
            // isOnline: true,
            // isActive: true,
            location: {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    $maxDistance: 50000// here change to 5km 5000
                }
            }
        }).sort({ totalEnquiriesActive: 1 }); // Least busy agent comes first

        console.log("eligibleAgents", eligibleAgents)

        if (eligibleAgents.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'NO_AGENTS_AVAILABLE',
                message: 'All matching providers in your 5km area just went offline.'
            });
        }
        console.log("eligibleAgents", eligibleAgents)

        const selectedAgent = eligibleAgents[0];

        // 4. Generate a clean 4-digit verification OTP
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

        // 5. Create the secure transactional booking record
        // const newBooking = await ServiceBooking.create({
        //     user: userId,
        //     agent: selectedAgent._id,
        //     subService: subServiceId,
        //     pincode: cleanPincode,
        //     bookingLocation: {
        //         type: 'Point',
        //         coordinates: [lng, lat]
        //     },
        //     finalPrice: priceMatch.price,
        //     completionOtp: generatedOtp,
        //     status: 'PENDING'
        // });

        // // 6. Increment the agent's active workload counter atomically
        // await ServiceAgent.findByIdAndUpdate(selectedAgent._id, {
        //     $inc: { totalEnquiriesActive: 1 }
        // });

        // return res.status(201).json({
        //     success: true,
        //     message: 'Service booked and assigned successfully!',
        //     bookingId: newBooking._id,
        //     completionOtp: generatedOtp,
        //     assignedAgent: {
        //         firstName: selectedAgent.firstName,
        //         lastName: selectedAgent.lastName,
        //         phone: selectedAgent.phone
        //     }
        // });
        return res.status(201).json({
            success: true,
            message: "Success"
        })

    } catch (error) {
        console.error('bookServiceInstant Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error processing instant service booking.' });
    }
};

// =========================================================
// 3. GET AGENT'S ACTIVE PENDING ENQUIRIES
// =========================================================
const getAgentPendingEnquiries = async (req, res) => {
    try {
        const agentId = req.agent._id || req.agent.sub; // Extracted safely from your agentAuthGuard middleware

        const pendingJobs = await ServiceBooking.find({
            agent: agentId,
            status: 'PENDING'
        })
            .populate('user', 'firstName lastName phone')
            .populate('subService', 'name description')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            totalPending: pendingJobs.length,
            data: pendingJobs
        });
    } catch (error) {
        console.error('getAgentPendingEnquiries Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error pulling pending agent assignments.' });
    }
};

// =========================================================
// 4. VERIFY OTP AND CLOSE SERVICE JOB
// =========================================================
const completeServiceWithOtp = async (req, res) => {
    try {
        const { bookingId, otp } = req.body;
        const agentId = req.agent._id || req.agent.sub;

        if (!bookingId || !otp) {
            return res.status(400).json({ success: false, error: 'bookingId and verification OTP code are required.' });
        }

        const booking = await ServiceBooking.findOne({ _id: bookingId, agent: agentId });

        if (!booking) {
            return res.status(404).json({ success: false, error: 'No matching booking record found for your provider account.' });
        }

        if (booking.status !== 'PENDING') {
            return res.status(400).json({ success: false, error: `This service has already been marked as ${booking.status}.` });
        }

        if (booking.completionOtp !== otp.trim()) {
            return res.status(400).json({ success: false, error: 'Invalid verification OTP code.' });
        }

        booking.status = 'COMPLETED';
        await booking.save();

        // Atomically update agent load counters
        await ServiceAgent.findByIdAndUpdate(agentId, {
            $inc: {
                totalEnquiriesActive: -1,
                totalEnquiriesClosed: 1
            }
        });

        return res.status(200).json({
            success: true,
            message: 'OTP Verified successfully! Job marked as completed.'
        });

    } catch (error) {
        console.error('completeServiceWithOtp Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error executing job closure parameters.' });
    }
};

// 5 create service booking order 
const createServiceBookingOrder = async (req, res) => {
    try {
        const { subServiceId, pincode, latitude, longitude, houseNumber, streetAddress } = req.body;
        const userId = req.user._id || req.user.id;

        if (!subServiceId || !pincode || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ success: false, error: 'Required booking details missing.' });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const cleanPincode = pincode.trim();

        // 1. Verify sub-service
        const subService = await ServiceSubcategory.findById(subServiceId);
        if (!subService || !subService.isActive) {
            return res.status(404).json({ success: false, error: 'Requested service item is unavailable.' });
        }

        // 2. IMPORTANT: Check if agents are actually available BEFORE taking payment
        const eligibleAgents = await ServiceAgent.find({
            allowedCategory: subService.parentCategory,
            location: {
                $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [lng, lat] },
                    $maxDistance: 5000 // 5km
                }
            }
        });

        if (eligibleAgents.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'NO_AGENTS_AVAILABLE',
                message: 'All matching providers in your 5km area just went offline. Please try again later.'
            });
        }

        // 3. Define pricing (Hardcoded to 1 for testing, or fetch from ServicePriceBook)
        const calculatedAmount = 1;

        // 4. Create Razorpay Order
        const options = {
            amount: Math.round(calculatedAmount * 100), // Paise
            currency: "INR",
            receipt: `rcpt_srv_${Date.now()}`,
        };
        const razorOrder = await razorpay.orders.create(options);

        // 5. Store pending payment with all booking metadata
        const newPayment = await paymentModel.create({
            userId,
            razorpayOrderId: razorOrder.id,
            amount: calculatedAmount,
            currency: 'INR',
            status: 'Pending',
            paymentType: 'ServiceBooking',
            metadata: {
                subServiceId,
                pincode: cleanPincode,
                latitude: lat,
                longitude: lng,
                houseNumber,
                streetAddress
            }
        });

        return res.status(200).json({
            success: true,
            id: razorOrder.id,
            amount: razorOrder.amount,
            currency: razorOrder.currency,
            localPaymentId: newPayment._id
        });
    } catch (error) {
        console.error('createServiceBookingOrder Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error processing booking order.' });
    }
}

// =========================================================
// WEBHOOK WORKER: ACTUALLY ASSIGN AGENT & CREATE BOOKING
// =========================================================
const processServiceBooking = async (userId, metadata) => {
    try {
        const { subServiceId, pincode, latitude, longitude, houseNumber, streetAddress } = metadata;

        const subService = await ServiceSubcategory.findById(subServiceId);

        // Find best agent (Least busy)
        const eligibleAgents = await ServiceAgent.find({
            allowedCategory: subService.parentCategory,
            location: {
                $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                    $maxDistance: 5000
                }
            }
        }).sort({ totalEnquiriesActive: 1 });

        if (eligibleAgents.length === 0) {
            // EDGE CASE: Agents went offline during the 1-2 minutes the user was paying.
            // You should ideally implement a refund logic or queue system here.
            throw new Error("No agents available at the time of payment completion.");
        }

        const selectedAgent = eligibleAgents[0];
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

        // Create the transactional booking
        const newBooking = await ServiceBooking.create({
            user: userId,
            agent: selectedAgent._id,
            subService: subServiceId,
            pincode,
            addressDetails: { houseNumber, streetAddress }, // Ensure schema matches
            bookingLocation: {
                type: 'Point',
                coordinates: [longitude, latitude]
            },
            completionOtp: generatedOtp,
            status: 'PENDING'
        });

        // Increment the agent's workload
        await ServiceAgent.findByIdAndUpdate(selectedAgent._id, {
            $inc: { totalEnquiriesActive: 1 }
        });

        console.log(`✅ Service Booking ${newBooking._id} assigned to Agent ${selectedAgent._id}`);
        return newBooking;
    } catch (error) {
        console.error('Worker Error in processServiceBooking:', error);
        throw error; // Let the webhook controller handle the crash
    }
}

// =========================================================
// 6. GET USER'S SERVICE BOOKING HISTORY
// =========================================================
const getUserServiceHistory = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id; // From your auth middleware
        const { status } = req.query; // e.g., /api/bookings?status=PENDING

        // Build the query
        let query = { user: userId };

        // If frontend passes a status filter, apply it
        if (status) {
            query.status = status.toUpperCase();
        }

        // Fetch bookings, sorted by newest first
        const bookings = await ServiceBooking.find(query)
            .populate('agent', 'firstName lastName phone allowedCategory') // Bring in agent details
            .populate({
                path: 'subService',
                select: 'name description parentCategory',
                populate: { path: 'parentCategory', select: 'name' } // Nested populate if you want category name
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Service history fetched successfully.',
            totalBookings: bookings.length,
            data: bookings
        });

    } catch (error) {
        console.error('getUserServiceHistory Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while fetching service history.'
        });
    }
};

module.exports = {
    getLiveAvailableServices,
    bookServiceInstant,
    getAgentPendingEnquiries,
    completeServiceWithOtp,
    createServiceBookingOrder, // <-- Expose this to your Express Routes
    processServiceBooking,
    getUserServiceHistory
};