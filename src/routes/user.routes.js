const express = require('express')
const multer = require('multer');
const { createUser, updateProfileUnified, getKycData } = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const userRouter = express.Router()

// Multer Memory Storage Configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

userRouter.post('/', createUser)
userRouter.put('/update', requireAuth, upload.single('photo'), updateProfileUnified);
userRouter.get('/kyc-status', requireAuth, getKycData);

module.exports = userRouter