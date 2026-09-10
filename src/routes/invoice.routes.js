const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {  getPlanInvoice } = require('../controllers/others/invoice.controller');

const invoiceRouter = express.Router();

// ==========================================
// TEST ROUTE (Using the dummy data)
// ==========================================
// You can leave requireAuth off this temporarily just so it's easy to test in browser
// invoiceRouter.get('/test-invoice', testDummyInvoice);
invoiceRouter.get('/plan/:purchaseId', getPlanInvoice);

// ==========================================
// FUTURE ACTUAL ROUTES (Protected by Auth)s
// ==========================================
// invoiceRouter.get('/plan/:purchaseId', requireAuth, getPlanInvoice);
// invoiceRouter.get('/online/:orderId', requireAuth, getOnlineInvoice);
// invoiceRouter.get('/offline/:orderId', requireAuth, getOfflineInvoice);
// invoiceRouter.get('/service/:bookingId', requireAuth, getServiceInvoice);

module.exports = invoiceRouter;