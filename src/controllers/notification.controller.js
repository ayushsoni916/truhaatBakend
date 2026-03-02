const Notification = require("../models/notification.model");

// 1. ADD NOTIFICATION (Global)
exports.addNotification = async (req, res, next) => {
    try {
        const { title, message } = req.body;
        
        if (!title || !message) {
            return res.status(400).json({ error: "Title and message are required" });
        }

        const notification = await Notification.create({ title, message });
        res.status(201).json({ success: true, notification });
    } catch (err) {
        next(err);
    }
};

// 2. GET LATEST 10 (Global)
exports.getNotifications = async (req, res, next) => {
    try {
        // Fetch latest 10 global alerts for any visitor
        const notifications = await Notification.find()
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({ success: true, notifications });
    } catch (err) {
        next(err);
    }
};

// 3. DELETE NOTIFICATION
exports.deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findByIdAndDelete(id);
        
        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        res.status(200).json({ success: true, message: "Notification deleted" });
    } catch (err) {
        next(err);
    }
};