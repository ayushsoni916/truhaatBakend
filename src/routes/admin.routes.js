const express = require('express');
const adminAuth = require('../middlewares/adminAuth');
const { promoteToSubadmin } = require('../controllers/admin.controller');
const adminRouter = express.Router();

adminRouter.post('/users/:userId/promote-subadmin', adminAuth, promoteToSubadmin)

module.exports = adminRouter