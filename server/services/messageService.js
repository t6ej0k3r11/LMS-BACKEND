const Message = require("../models/Message");
const User = require("../models/User");
const {
  canSendMessage,
  invalidateChatPartnersCache,
} = require("./messagingPermissions");
const {
  createNotification,
  markCategoryAsRead,
} = require("./notificationService");

let io = null;

/**
 * Set the Socket.io instance for emitting events
 * @param {Object} socketIoInstance - Socket.io instance
 */
const setSocketIoInstance = (socketIoInstance) => {
  io = socketIoInstance;
};

/**
 * Send a message and emit socket events
 * @param {Object} messageData - Message data
 * @param {string} messageData.senderId - Sender ID
 * @param {string} messageData.receiverId - Receiver ID
 * @param {string} messageData.courseId - Course ID
 * @param {string} messageData.message - Message content
 * @returns {Promise<Object>} Created message
 */
const sendMessage = async (messageData) => {
  try {
    const {
      senderId,
      receiverId,
      courseId,
      message: messageContent,
    } = messageData;

    // Validate permissions
    const hasPermission = await canSendMessage(senderId, receiverId, courseId);
    if (!hasPermission) {
      throw new Error("Unauthorized to send message");
    }

    // Get sender and receiver roles
    const [sender, receiver] = await Promise.all([
      User.findById(senderId).select("role"),
      User.findById(receiverId).select("role"),
    ]);

    if (!sender || !receiver) {
      throw new Error("Invalid sender or receiver");
    }

    const message = new Message({
      senderId,
      receiverId,
      senderRole: sender.role,
      receiverRole: receiver.role,
      courseId,
      message: messageContent.trim(),
    });

    await message.save();

    // Invalidate cache for sender and receiver
    invalidateChatPartnersCache([senderId, receiverId]);

    // Create notification for the receiver
    try {
      await createNotification({
        userId: message.receiverId,
        title: "New Message",
        message: `You have a new message from ${sender.userName}`,
        type: "info",
        category: "message",
      });
    } catch (notificationError) {
      console.error("Error creating message notification:", notificationError);
      // Don't fail the message sending if notification creation fails
    }

    // Emit real-time message to receiver
    if (io) {
      io.to(message.receiverId.toString()).emit("receive_message", {
        _id: message._id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        senderRole: message.senderRole,
        receiverRole: message.receiverRole,
        courseId: message.courseId,
        message: message.message,
        createdAt: message.createdAt,
        isSeen: message.isSeen,
      });
    }

    return message;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

/**
 * Mark messages as seen
 * @param {string} senderId - Sender ID (the one who sent the messages)
 * @param {string} receiverId - Receiver ID (current user)
 * @param {string} courseId - Course ID (optional, for additional validation)
 * @returns {Promise<Object>} Update result
 */
const markMessagesAsSeen = async (senderId, receiverId, courseId = null) => {
  try {
    // Validate permissions if courseId is provided
    if (courseId) {
      const hasPermission = await canSendMessage(
        receiverId,
        senderId,
        courseId
      );
      if (!hasPermission) {
        throw new Error("Unauthorized to mark messages as seen");
      }
    }

    const filter = {
      senderId,
      receiverId,
      isSeen: false,
    };

    // Add courseId filter if provided
    if (courseId) {
      filter.courseId = courseId;
    }

    const result = await Message.updateMany(filter, {
      isSeen: true,
      seenAt: new Date(),
    });

    // Mark message notifications as read for the current user
    try {
      await markCategoryAsRead(receiverId, "message");
    } catch (notificationError) {
      console.error(
        "Error marking message notifications as read:",
        notificationError
      );
      // Don't fail the message marking if notification update fails
    }

    return result;
  } catch (error) {
    console.error("Error marking messages as seen:", error);
    throw error;
  }
};

module.exports = {
  setSocketIoInstance,
  sendMessage,
  markMessagesAsSeen,
};
