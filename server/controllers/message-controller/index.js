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
    let { courseId, limit = 50, page = 1 } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role;
    const mongoose = require("mongoose");

    // Debug logs
    console.log("🔍 [getChatHistory] Request params:", {
      userId,
      receiverId,
      rawCourseId: courseId,
      currentUserId: currentUserId.toString(),
      currentUserRole,
    });

    // Validate required params
    if (!userId || !receiverId) {
      console.error("❌ [getChatHistory] Missing required params:", {
        userId,
        receiverId,
      });
      return res.status(400).json({
        success: false,
        message: "userId and receiverId are required",
      });
    }

    // Safe ObjectId validation for userId and receiverId
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(receiverId)
    ) {
      console.error("❌ [getChatHistory] Invalid ObjectId format:", {
        userId,
        receiverId,
      });
      return res.status(400).json({
        success: false,
        message: "Invalid userId or receiverId format",
      });
    }

    // Normalize courseId: treat null, "null", undefined, or empty string as null
    const originalCourseId = courseId;
    if (
      courseId === "null" ||
      courseId === null ||
      courseId === undefined ||
      courseId === ""
    ) {
      courseId = null;
    } else if (
      typeof courseId === "string" &&
      !mongoose.Types.ObjectId.isValid(courseId)
    ) {
      // Treat invalid ObjectId strings as null to ignore filter
      console.warn(
        "⚠️ [getChatHistory] Invalid courseId format, treating as null:",
        courseId
      );
      courseId = null;
    }

    console.log("🔍 [getChatHistory] Parsed courseId:", {
      original: originalCourseId,
      parsed: courseId,
    });

    // For non-admin users, courseId must be provided and valid (not null)
    if (currentUserRole !== "admin" && courseId === null) {
      console.error("❌ [getChatHistory] courseId required for non-admin:", {
        currentUserRole,
        courseId,
      });
      return res.status(400).json({
        success: false,
        message: "courseId is required for non-admin users",
      });
    }

    // Validate pagination parameters
    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      console.error("❌ [getChatHistory] Invalid limit:", limit);
      return res.status(400).json({
        success: false,
        message: "limit must be a number between 1 and 100",
      });
    }
    if (isNaN(pageNum) || pageNum < 1) {
      console.error("❌ [getChatHistory] Invalid page:", page);
      return res.status(400).json({
        success: false,
        message: "page must be a positive number",
      });
    }
    const skipNum = (pageNum - 1) * limitNum;

    // Ensure the current user is part of the conversation
    if (
      currentUserId.toString() !== userId &&
      currentUserId.toString() !== receiverId
    ) {
      console.error("❌ [getChatHistory] Access denied:", {
        currentUserId: currentUserId.toString(),
        userId,
        receiverId,
      });
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Perform permission check only if courseId is provided (not null)
    if (courseId !== null) {
      try {
        const {
          canSendMessage,
        } = require("../../services/messagingPermissions");
        const hasPermission =
          (await canSendMessage(userId, receiverId, courseId)) ||
          (await canSendMessage(receiverId, userId, courseId));

        if (!hasPermission) {
          console.error("❌ [getChatHistory] Permission denied:", {
            userId,
            receiverId,
            courseId,
          });
          return res.status(403).json({
            success: false,
            message: "Unauthorized to access this conversation",
          });
        }
      } catch (permissionError) {
        console.error(
          "❌ [getChatHistory] Permission check error:",
          permissionError
        );
        return res.status(500).json({
          success: false,
          message: "Error validating permissions",
        });
      }
    }

    // Build query for messages between the two users
    const query = {
      $or: [
        { senderId: userId, receiverId: receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
    };

    // Separate filtering logic: course chat vs personal chat
    if (courseId !== null) {
      // Course-based chat: filter by specific courseId
      query.courseId = courseId;
      console.log("🔍 [getChatHistory] Course chat filter applied");
    } else {
      // Personal/admin chat: filter by courseId null
      query.courseId = null;
      console.log("🔍 [getChatHistory] Personal chat filter applied");
    }

    console.log(
      "🔍 [getChatHistory] Final MongoDB filter:",
      JSON.stringify(query, null, 2)
    );
    console.log("🔍 [getChatHistory] Query details:", {
      senderId: userId,
      receiverId: receiverId,
      courseId: courseId,
      filter: query,
    });

    // Get total count for pagination
    let totalMessages;
    try {
      totalMessages = await Message.countDocuments(query);
    } catch (countError) {
      console.error("❌ [getChatHistory] Count documents error:", countError);
      return res.status(500).json({
        success: false,
        message: "Error counting messages",
      });
    }

    let messages;
    try {
      messages = await Message.find(query)
        .sort({ createdAt: 1 })
        .skip(skipNum)
        .limit(limitNum)
        .populate("senderId", "userName firstName lastName role")
        .populate("receiverId", "userName firstName lastName role");
    } catch (findError) {
      console.error("❌ [getChatHistory] Find messages error:", findError);
      return res.status(500).json({
        success: false,
        message: "Error retrieving messages",
      });
    }

    console.log("✅ [getChatHistory] Success:", {
      messageCount: messages.length,
      totalMessages,
      limit: limitNum,
      page: pageNum,
    });

    res.status(200).json({
      success: true,
      message: "Chat history retrieved successfully",
      data: {
        messages,
        pagination: {
          total: totalMessages,
          limit: limitNum,
          page: pageNum,
          hasMore: messages.length === limitNum,
        },
      },
    });
  } catch (error) {
    console.error("❌ [getChatHistory] Unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
