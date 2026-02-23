const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
    },
    firstName: {
        type: String,
        trim: true,
        default: ''
    },
    lastName: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        index: true,
        sparse: true      // makes index ignore null values
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        default: 'Male',
    },
    profilePic: {
        type: String,
        default: ''
    },
    profilePublicUrl: {
        type: String,
        default: ''
    },

    // === KYC STATUS FLAGS ===
    isAadhaarVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    isPanVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    isBankVerified: {
        type: Boolean,
        default: false,
        index: true
    },

    // === KYC DATA ===
    aadhaar: {
        number: { type: String },
        name: { type: String },
        dob: { type: String },
        gender: { type: String },
        address: { type: Object },
        verifiedAt: { type: Date },
    },

    pan: {
        number: { type: String },
        name: { type: String },
        verifiedAt: { type: Date }
    },

    bank: {
        accountNumber: { type: String },
        ifsc: { type: String },
        bankName: { type: String },
        verifiedAt: { type: Date }
    },


    //MLM
    role: {
        type: String,
        enum: ['USER', 'SUBADMIN'],
        default: 'USER',
        index: true
    },
    referralCode: {
        type: String,
        unique: true,
        index: true,
        immutable: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    directActiveRefCount: {
        type: Number,
        default: 0
    },
    mlmRoot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },

    // === Plan info ===
    currentPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        default: null
    },
    planActivatedAt: {
        type: Date,
        default: null
    },

    // null = no expiry (infinite); later we can set real date
    planExpiresAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true,   // createdAt + updatedAt 
    versionKey: false
})

// Simple referral code generator
function generateReferralCode() {
    // phone-based or pure random; for now random 8-char
    return 'TRU' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Auto-generate referralCode if missing
userSchema.pre('save', async function () {
    if (!this.isNew) return;

    let code;
    let exists = true;

    while (exists) {
        code = generateReferralCode();
        const count = await this.constructor.countDocuments({ referralCode: code });
        if (count === 0) {
            exists = false;
        }
    }

    this.referralCode = code;
});


const User = mongoose.model("User", userSchema)

module.exports = User