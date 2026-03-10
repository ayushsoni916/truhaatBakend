const express = require('express');
const notificationRouter = express.Router();
const { addNotification, getNotifications, deleteNotification } = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// Public: Users can see the latest 10 updates
notificationRouter.get('/all', getNotifications);

// Protected: Only authorized admins can manage notifications
notificationRouter.post('/add', addNotification);
notificationRouter.delete('/:id', deleteNotification);

module.exports = notificationRouter;