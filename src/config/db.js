const mongoose = require('mongoose');

async function connectDb() {
    const mongoUri = process.env.MONGO_URI

    if (!mongoUri) {
        console.error("❌ MONGO_URI is missing in .env");
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri)
        console.log("✅ MongoDB connected successfully");
    } catch (error) {
        console.error("❌ MongoDB connection failed");
        console.error(error.message);
        process.exit(1); // In real apps we exit to prevent running in broken state
    }
}

module.exports = connectDb;