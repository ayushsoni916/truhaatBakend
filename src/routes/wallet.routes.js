const express = require('express');
const walletRouter = express.Router();
const {
  getWalletSummary,
  getWalletHistory,
  getAdminWalletDashboard,
  getAdminUserLedger
} = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// All wallet routes require auth
walletRouter.get('/', requireAuth, getWalletSummary);
walletRouter.get('/history', requireAuth, getWalletHistory);

walletRouter.get('/admin/dashboard', getAdminWalletDashboard);
walletRouter.get('/admin/ledger/:userId', getAdminUserLedger);

module.exports = walletRouter;
