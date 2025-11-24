const User = require("../models/User");
const Course = require("../models/Course");
const StudentCourses = require("../models/StudentCourses");
const Message = require("../models/Message");

// Simple in-memory cache for chat partners
const chatPartnersCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the last message between two users in a course context
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @param {string} courseId - Course ID (can be null for admin)
 * @returns {Promise<Object|null>} - Last message or null
 */
const getLastMessage = async (userId1, userId2, courseId) => {
  try {
    const query = {
      $or: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 },
      ],
    };

    if (courseId) {
      query.courseId = courseId;
    } else {
      query.courseId = null; // For admin conversations
    }

    const lastMessage = await Message.findOne(query)
      .sort({ createdAt: -1 })
      .populate("senderId", "userName firstName lastName")
      .populate("receiverId", "userName firstName lastName")
      .select("message createdAt isSeen senderId receiverId");

    return lastMessage;
  } catch (error) {
    console.error("Error getting last message:", error);
    return null;
  }
};

/**
 * Validate if a user can send a message to another user in the context of a course
 * @param {string} senderId - Sender user ID
 * @param {string} receiverId - Receiver user ID
 * @param {string} courseId - Course ID
 * @returns {Promise<boolean>} - True if allowed, false otherwise
 */
const canSendMessage = async (senderId, receiverId, courseId) => {
  try {
    // Get sender and receiver details
    const [sender, receiver] = await Promise.all([
      User.findById(senderId).select("role"),
      User.findById(receiverId).select("role"),
    ]);

    if (!sender || !receiver) {
      return false;
    }

    // Admin can message anyone
    if (sender.role === "admin") {
      return true;
    }

    // Get course details
    const course = await Course.findById(courseId);
    if (!course) {
      return false;
    }

    // Student can message instructor of enrolled course
    if (sender.role === "student") {
      if (receiver.role !== "instructor") {
        return false;
      }

      // Check if student is enrolled in the course
      const studentCourses = await StudentCourses.findOne({
        userId: senderId,
        "courses.courseId": courseId,
      });

      return !!studentCourses && course.instructorId === receiverId.toString();
    }

    // Instructor can message students enrolled in their course
    if (sender.role === "instructor") {
      if (receiver.role !== "student") {
        return false;
      }

      // Check if instructor owns the course and student is enrolled
      if (course.instructorId !== senderId.toString()) {
        return false;
      }

      const studentCourses = await StudentCourses.findOne({
        userId: receiverId,
        "courses.courseId": courseId,
      });

      return !!studentCourses;
    }

    return false;
  } catch (error) {
    console.error("Error validating message permission:", error);
    return false;
  }
};

/**
 * Get all chat partners for a user based on their role
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of chat partners with course context and last message
 */
const getChatPartners = async (userId) => {
  try {
    // Check cache first
    const cacheKey = `chatPartners_${userId}`;
    const cached = chatPartnersCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const user = await User.findById(userId).select("role");
    if (!user) {
      return [];
    }

    const partners = [];

    if (user.role === "admin") {
      // Admin can chat with all users
      const allUsers = await User.find({
        _id: { $ne: userId },
        status: "active",
      }).select("_id userName firstName lastName role userEmail");

      // For admin, we need to find courses they might be involved in
      // For simplicity, return all users (course context can be determined later)
      const partnersWithLastMessage = await Promise.all(
        allUsers.map(async (u) => {
          const lastMessage = await getLastMessage(userId, u._id, null);
          return {
            userId: u._id,
            userName: u.userName,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            userEmail: u.userEmail,
            courseId: null, // Admin can message without course context
            lastMessage,
          };
        })
      );
      return partnersWithLastMessage;
    }

    if (user.role === "student") {
      // Student can chat with instructors of enrolled courses
      const studentCourses = await StudentCourses.findOne({ userId });

      if (!studentCourses) {
        return [];
      }

      for (const course of studentCourses.courses) {
        const courseDetails = await Course.findById(course.courseId);
        if (courseDetails) {
          const instructor = await User.findById(
            courseDetails.instructorId
          ).select("_id userName firstName lastName role");

          if (instructor) {
            const lastMessage = await getLastMessage(
              userId,
              instructor._id,
              course.courseId
            );
            partners.push({
              userId: instructor._id,
              userName: instructor.userName,
              firstName: instructor.firstName,
              lastName: instructor.lastName,
              role: instructor.role,
              courseId: course.courseId,
              courseTitle: course.title,
              lastMessage,
            });
          }
        }
      }
    }

    if (user.role === "instructor") {
      // Instructor can chat with students enrolled in their courses
      const instructorCourses = await Course.find({
        instructorId: userId.toString(),
        status: "published",
      });

      for (const course of instructorCourses) {
        // Get students enrolled in this course
        const studentCourses = await StudentCourses.find({
          "courses.courseId": course._id.toString(),
        });

        for (const studentCourse of studentCourses) {
          const student = await User.findById(studentCourse.userId).select(
            "_id userName firstName lastName role"
          );

          if (student) {
            const lastMessage = await getLastMessage(
              userId,
              student._id,
              course._id
            );
            partners.push({
              userId: student._id,
              userName: student.userName,
              firstName: student.firstName,
              lastName: student.lastName,
              role: student.role,
              courseId: course._id,
              courseTitle: course.title,
              lastMessage,
            });
          }
        }
      }
    }

    // Remove duplicates
    const uniquePartners = partners.filter(
      (partner, index, self) =>
        index ===
        self.findIndex(
          (p) =>
            p.userId.toString() === partner.userId.toString() &&
            p.courseId?.toString() === partner.courseId?.toString()
        )
    );

    // Cache the result
    chatPartnersCache.set(cacheKey, {
      data: uniquePartners,
      timestamp: Date.now(),
    });

    return uniquePartners;
  } catch (error) {
    console.error("Error getting chat partners:", error);
    return [];
  }
};

/**
 * Invalidate chat partners cache for specific users
 * @param {string[]} userIds - Array of user IDs to invalidate cache for
 */
const invalidateChatPartnersCache = (userIds) => {
  userIds.forEach((userId) => {
    const cacheKey = `chatPartners_${userId}`;
    chatPartnersCache.delete(cacheKey);
  });
};

module.exports = {
  canSendMessage,
  getChatPartners,
  invalidateChatPartnersCache,
};
