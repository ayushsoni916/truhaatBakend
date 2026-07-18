const express = require('express');
const adminAuth = require('../middlewares/adminAuth');
const { promoteToSubadmin } = require('../controllers/admin.controller');
const adminRouter = express.Router();

// adminRouter.post('/users/:userId/promote-subadmin', adminAuth, promoteToSubadmin)
adminRouter.post('/users/:userId/promote-subadmin', promoteToSubadmin)

module.exports = adminRouter