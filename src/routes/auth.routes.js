const express = require('express')
const { sendOtp, verifyOtp, signup } = require('../controllers/auth.controller')

const authRoute = express.Router()

authRoute.post('/send-otp', sendOtp)
authRoute.post('/verify-otp', verifyOtp)
authRoute.post('/signup', signup)

module.exports = authRoute