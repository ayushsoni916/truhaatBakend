const express = require('express');
const cashBackRouter = express.Router();
const cashbackController = require('../controllers/cashback.controller');
const { requireAuth } = require('../middleware/auth.middleware'); // Adjust path to your auth interceptor

cashBackRouter.get('/cashback/summary', requireAuth, cashbackController.getCashbackSummary);
cashBackRouter.get('/cashback/history', requireAuth, cashbackController.getCashbackHistory);

module.exports = cashBackRouter;