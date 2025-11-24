const Message = require("../../models/Message");
const User = require("../../models/User");
const {
  sendMessage: sendMessageService,
  markMessagesAsSeen: markAsSeenService,
} = require("../../services/messageService");
const { getChatPartners } = require("../../services/messagingPermissions");

/**
 * Send a message
 */
const sendMessage = async (req, res) => {
  try {
    const { receiverId, courseId, message } = req.body;
    const senderId = req.user._id;

    // Validate required fields
    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: "receiverId and message are required",
      });
    }

    // courseId is required for non-admin users
    if (req.user.role !== "admin" && !courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required for non-admin users",
      });
    }

    // Send message using service (validates permissions and saves)
    const newMessage = await sendMessageService({
      senderId,
      receiverId,
      courseId,
      message: message.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: {
        _id: newMessage._id,
        senderId: newMessage.senderId,
        receiverId: newMessage.receiverId,
        senderRole: newMessage.senderRole,
        receiverRole: newMessage.receiverRole,
        courseId: newMessage.courseId,
        message: newMessage.message,
        isSeen: newMessage.isSeen,
        createdAt: newMessage.createdAt,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    const statusCode =
      error.message === "Unauthorized to send message" ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to send message",
    });
  }
};

/**
 * Get chat history between two users in a course context or admin context
 */
const getChatHistory = async (req, res) => {
  try {
    const { userId, receiverId } = req.params;
    const { courseId, limit = 50, skip = 0 } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role;

    // For non-admin users, courseId is required
    if (currentUserRole !== "admin" && !courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required",
      });
    }

    // Validate pagination parameters
    const limitNum = parseInt(limit, 10);
    const skipNum = parseInt(skip, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: "limit must be a number between 1 and 100",
      });
    }
    if (isNaN(skipNum) || skipNum < 0) {
      return res.status(400).json({
        success: false,
        message: "skip must be a non-negative number",
      });
    }

    // Ensure the current user is part of the conversation
    if (
      currentUserId.toString() !== userId &&
      currentUserId.toString() !== receiverId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // For admin, skip course-based permission check if courseId is null
    if (currentUserRole !== "admin" || courseId) {
      // Validate permissions for accessing this conversation
      const { canSendMessage } = require("../../services/messagingPermissions");
      const hasPermission =
        (await canSendMessage(userId, receiverId, courseId)) ||
        (await canSendMessage(receiverId, userId, courseId));

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to access this conversation",
        });
      }
    }

    // Build query based on whether courseId is provided
    const query = {
      $or: [
        { senderId: userId, receiverId: receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
    };

    // Add courseId to query if provided
    if (courseId) {
      query.courseId = courseId;
    } else {
      // For admin conversations without course context, find messages where courseId is null
      query.courseId = null;
    }

    // Get total count for pagination
    const totalMessages = await Message.countDocuments(query);

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .skip(skipNum)
      .limit(limitNum)
      .populate("senderId", "userName firstName lastName role")
      .populate("receiverId", "userName firstName lastName role");

    res.status(200).json({
      success: true,
      message: "Chat history retrieved successfully",
      data: {
        messages,
        pagination: {
          total: totalMessages,
          limit: limitNum,
          skip: skipNum,
          hasMore: skipNum + limitNum < totalMessages,
        },
      },
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat history",
    });
  }
};

/**
 * Mark messages as seen
 */
const markMessagesAsSeen = async (req, res) => {
  try {
    const { senderId, courseId } = req.body; // The sender's ID whose messages to mark as seen
    const currentUserId = req.user._id;

    // Validate required fields
    if (!senderId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "senderId and courseId are required",
      });
    }

    // Mark messages as seen using service
    const result = await markAsSeenService(senderId, currentUserId, courseId);

    res.status(200).json({
      success: true,
      message: "Messages marked as seen",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Mark messages as seen error:", error);
    const statusCode =
      error.message === "Unauthorized to mark messages as seen" ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to mark messages as seen",
    });
  }
};

/**
 * Get all chat partners for the current user based on their role
 */
const getChatPartnersList = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const partners = await getChatPartners(currentUserId);

    res.status(200).json({
      success: true,
      message: "Chat partners retrieved successfully",
      data: partners,
    });
  } catch (error) {
    console.error("Get chat partners error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat partners",
    });
  }
};

module.exports = {
  sendMessage,
  getChatHistory,
  markMessagesAsSeen,
  getChatPartnersList,
};
