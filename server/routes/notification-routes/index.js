const express = require("express");
const {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteUserNotification,
  createUserNotification,
} = require("../../controllers/notification-controller/index");
const authenticateMiddleware = require("../../middleware/auth-middleware");
const router = express.Router();

// All notification routes require authentication
router.use(authenticateMiddleware.authenticate);

// Get user notifications
router.get("/", getNotifications);

// Get unread notification count
router.get("/unread-count", getUnreadNotificationCount);

// Mark notification as read
router.patch("/:notificationId/read", markNotificationAsRead);

// Mark all notifications as read
router.patch("/mark-all-read", markAllNotificationsAsRead);

// Delete notification
router.delete("/:notificationId", deleteUserNotification);

// Create notification (admin/internal use)
router.post("/create", createUserNotification);

module.exports = router;
