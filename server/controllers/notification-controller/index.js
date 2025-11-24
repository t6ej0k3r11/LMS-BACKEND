const {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
} = require("../../services/notificationService");

/**
 * Get notifications for the authenticated user
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;

    const notifications = await getUserNotifications(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      unreadOnly: unreadOnly === "true",
    });

    const unreadCount = await getUnreadCount(userId);

    res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: {
        notifications,
        unreadCount,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
        },
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications",
    });
  }
};

/**
 * Get unread notification count for the authenticated user
 */
const getUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await getUnreadCount(userId);

    res.status(200).json({
      success: true,
      message: "Unread count retrieved successfully",
      data: { unreadCount: count },
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve unread count",
    });
  }
};

/**
 * Mark a notification as read
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await markAsRead(notificationId, userId);

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: { notification },
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    const statusCode = error.message.includes("not found") ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to mark notification as read",
    });
  }
};

/**
 * Mark all notifications as read for the authenticated user
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};

/**
 * Delete a notification
 */
const deleteUserNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    await deleteNotification(notificationId, userId);

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    const statusCode = error.message.includes("not found") ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete notification",
    });
  }
};

/**
 * Create a notification (internal/admin use)
 */
const createUserNotification = async (req, res) => {
  try {
    const { userId, title, message, type = "info" } = req.body;

    // Validate required fields
    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "userId, title, and message are required",
      });
    }

    // Validate type
    const validTypes = ["info", "success", "warning", "alert"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid notification type. Must be one of: info, success, warning, alert",
      });
    }

    const notification = await createNotification({
      userId,
      title,
      message,
      type,
    });

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: { notification },
    });
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create notification",
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteUserNotification,
  createUserNotification,
};
