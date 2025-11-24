const Notification = require("../models/Notification");

let io = null;

/**
 * Set the Socket.io instance for emitting events
 * @param {Object} socketIoInstance - Socket.io instance
 */
const setSocketIoInstance = (socketIoInstance) => {
  io = socketIoInstance;
};

/**
 * Create a new notification
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.userId - User ID to receive the notification
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.message - Notification message
 * @param {string} notificationData.type - Notification type (info, success, warning, alert)
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();

    // Emit real-time notification to the user
    if (io) {
      io.to(notification.userId.toString()).emit("new_notification", {
        _id: notification._id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw new Error("Failed to create notification");
  }
};

/**
 * Get all notifications for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of notifications to return
 * @param {number} options.skip - Number of notifications to skip
 * @param {boolean} options.unreadOnly - Return only unread notifications
 * @returns {Promise<Array>} Array of notifications
 */
const getUserNotifications = async (userId, options = {}) => {
  try {
    const { limit = 50, skip = 0, unreadOnly = false } = options;

    const query = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return notifications;
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    throw new Error("Failed to fetch notifications");
  }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Object>} Updated notification
 */
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error("Notification not found or access denied");
    }

    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw new Error("Failed to mark notification as read");
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Update result
 */
const markAllAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    return result;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw new Error("Failed to mark all notifications as read");
  }
};

/**
 * Mark notifications as read by category for a user
 * @param {string} userId - User ID
 * @param {string} category - Notification category
 * @returns {Promise<Object>} Update result
 */
const markCategoryAsRead = async (userId, category) => {
  try {
    const result = await Notification.updateMany(
      { userId, category, isRead: false },
      { isRead: true }
    );

    // Emit real-time update for unread count
    if (io && result.modifiedCount > 0) {
      const newUnreadCount = await getUnreadCount(userId);
      io.to(userId.toString()).emit("notification_count_update", {
        unreadCount: newUnreadCount,
      });
    }

    return result;
  } catch (error) {
    console.error(`Error marking ${category} notifications as read:`, error);
    throw new Error(`Failed to mark ${category} notifications as read`);
  }
};

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
const getUnreadCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    return count;
  } catch (error) {
    console.error("Error getting unread notification count:", error);
    throw new Error("Failed to get unread notification count");
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Object>} Deletion result
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!result) {
      throw new Error("Notification not found or access denied");
    }

    return result;
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw new Error("Failed to delete notification");
  }
};

module.exports = {
  setSocketIoInstance,
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  markCategoryAsRead,
  getUnreadCount,
  deleteNotification,
};
