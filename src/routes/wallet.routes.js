const express = require('express');
const walletRouter = express.Router();
const {
  getWalletSummary,
  getWalletHistory
} = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// All wallet routes require auth
walletRouter.get('/', requireAuth, getWalletSummary);
walletRouter.get('/history', requireAuth, getWalletHistory);

module.exports = walletRouter;
