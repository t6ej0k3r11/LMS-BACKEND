const User = require("../../models/User");
const Course = require("../../models/Course");
const AuditLog = require("../../models/AuditLog");
const QuestionBank = require("../../models/QuestionBank");
const { sendInstructorDecisionEmail } = require("../../utils/emailService");

// Helper function to log admin actions
const logAdminAction = async (
  adminId,
  adminName,
  action,
  targetType,
  targetId,
  targetName,
  details,
  req
) => {
  try {
    await AuditLog.create({
      adminId,
      adminName,
      action,
      targetType,
      targetId,
      targetName,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
};

// Get all users with pagination and filtering
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, status = "all" } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (role && role !== "all") filter.role = role;
    if (status && status !== "all") filter.status = status;
    if (search) {
      filter.$or = [
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// Update user details
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userName, userEmail, role, status } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const oldData = {
      userName: user.userName,
      userEmail: user.userEmail,
      role: user.role,
      status: user.status,
    };

    user.userName = userName || user.userName;
    user.userEmail = userEmail || user.userEmail;
    user.role = role || user.role;
    user.status = status || user.status;

    await user.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "user_updated",
      "user",
      userId,
      user.userName,
      { oldData, newData: { userName, userEmail, role, status } },
      req
    );

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        _id: user._id,
        userName: user.userName,
        userEmail: user.userEmail,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting admin users
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete admin users",
      });
    }

    await User.findByIdAndDelete(userId);

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "user_deleted",
      "user",
      userId,
      user.userName,
      {
        deletedUser: {
          userName: user.userName,
          userEmail: user.userEmail,
          role: user.role,
        },
      },
      req
    );

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

// Bulk user operations
const bulkUserAction = async (req, res) => {
  try {
    const { userIds, action, newRole } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
    }

    let updateData = {};
    let logAction = "";

    switch (action) {
      case "change_role":
        if (!newRole || !["student", "instructor"].includes(newRole)) {
          return res.status(400).json({
            success: false,
            message: "Valid new role is required",
          });
        }
        updateData.role = newRole;
        logAction = "bulk_user_action";
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action",
        });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds }, role: { $ne: "admin" } }, // Prevent modifying admin users
      updateData
    );

    // Log the bulk action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      logAction,
      "user",
      "bulk",
      `${userIds.length} users`,
      { action, newRole, affectedCount: result.modifiedCount },
      req
    );

    res.status(200).json({
      success: true,
      message: `Bulk action completed. ${result.modifiedCount} users affected.`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Bulk user action error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk action",
    });
  }
};

// Get courses pending approval
const getPendingCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const courses = await Course.find({ approvalStatus: "pending" })
      .populate("instructorId", "userName userEmail")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Course.countDocuments({ approvalStatus: "pending" });

    res.status(200).json({
      success: true,
      data: {
        courses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCourses: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get pending courses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending courses",
    });
  }
};

// Approve or reject course
const reviewCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'approve' or 'reject'",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Course has already been reviewed",
      });
    }

    const oldStatus = course.approvalStatus;
    course.approvalStatus = action === "approve" ? "approved" : "rejected";
    course.approvalDate = new Date();
    course.approvedBy = req.user._id;

    if (action === "approve") {
      course.status = "published";
      course.publishedAt = new Date();
      course.rejectionReason = undefined; // Clear any previous rejection
    } else if (action === "reject") {
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
      }
      course.rejectionReason = rejectionReason;
      course.status = "draft"; // Reset to draft on rejection
    }

    await course.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      action === "approve" ? "course_approved" : "course_rejected",
      "course",
      courseId,
      course.title,
      {
        oldStatus,
        newStatus: course.approvalStatus,
        rejectionReason: action === "reject" ? rejectionReason : null,
      },
      req
    );

    res.status(200).json({
      success: true,
      message: `Course ${action}d successfully`,
      data: {
        courseId,
        approvalStatus: course.approvalStatus,
        status: course.status,
        approvalDate: course.approvalDate,
        publishedAt: course.publishedAt,
        rejectionReason: course.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Review course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review course",
    });
  }
};

// Get audit logs
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      adminId,
      startDate,
      endDate,
    } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (action) filter.action = action;
    if (adminId) filter.adminId = adminId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalLogs: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
};

// Deactivate user
const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot deactivate admin users",
      });
    }

    if (user.status === "inactive") {
      return res.status(400).json({
        success: false,
        message: "User is already inactive",
      });
    }

    const oldStatus = user.status;
    user.status = "inactive";
    await user.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "user_deactivated",
      "user",
      userId,
      user.userName,
      { oldStatus, newStatus: "inactive" },
      req
    );

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: {
        _id: user._id,
        userName: user.userName,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Deactivate user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate user",
    });
  }
};

// Reactivate user
const reactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status === "active") {
      return res.status(400).json({
        success: false,
        message: "User is already active",
      });
    }

    const oldStatus = user.status;
    user.status = "active";
    await user.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "user_reactivated",
      "user",
      userId,
      user.userName,
      { oldStatus, newStatus: "active" },
      req
    );

    res.status(200).json({
      success: true,
      message: "User reactivated successfully",
      data: {
        _id: user._id,
        userName: user.userName,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Reactivate user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reactivate user",
    });
  }
};

// Get admin dashboard stats
const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCourses = await Course.countDocuments();
    const pendingCourses = await Course.countDocuments({
      approvalStatus: "pending",
    });
    const totalAdmins = await User.countDocuments({ role: "admin" });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCourses,
        pendingCourses,
        totalAdmins,
      },
    });
  } catch (error) {
    console.error("Get admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin stats",
    });
  }
};

// Get recent activities from audit logs
const getRecentActivities = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const activities = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate("adminId", "userName");

    res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Get recent activities error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activities",
    });
  }
};

// Get all courses with pagination and filtering
const getAllCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, instructorId } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (status && status !== "all") filter.approvalStatus = status;
    if (instructorId) filter.instructorId = instructorId;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { instructorName: { $regex: search, $options: "i" } },
      ];
    }

    const courses = await Course.find(filter)
      .populate("instructorId", "userName userEmail")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Course.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        courses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCourses: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all courses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
    });
  }
};

// Update course status
const updateCourseStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { approvalStatus, rejectionReason } = req.body;

    if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const oldStatus = course.approvalStatus;
    course.approvalStatus = approvalStatus;
    course.approvalDate = new Date();
    course.approvedBy = req.user._id;

    if (approvalStatus === "approved") {
      course.status = "published";
      course.publishedAt = new Date();
      course.rejectionReason = undefined;
    } else if (approvalStatus === "rejected") {
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
      }
      course.rejectionReason = rejectionReason;
      course.status = "draft"; // Reset to draft on rejection
    }

    await course.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      `course_${approvalStatus}`,
      "course",
      courseId,
      course.title,
      {
        oldStatus,
        newStatus: approvalStatus,
        rejectionReason: approvalStatus === "rejected" ? rejectionReason : null,
      },
      req
    );

    res.status(200).json({
      success: true,
      message: `Course status updated to ${approvalStatus}`,
      data: {
        courseId,
        approvalStatus: course.approvalStatus,
        approvalDate: course.approvalDate,
        rejectionReason: course.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Update course status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update course status",
    });
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    await Course.findByIdAndDelete(courseId);

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "course_deleted",
      "course",
      courseId,
      course.title,
      {
        deletedCourse: {
          title: course.title,
          instructorName: course.instructorName,
          approvalStatus: course.approvalStatus,
        },
      },
      req
    );

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete course",
    });
  }
};

// Get pending instructor applications
const getPendingInstructors = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const instructors = await User.find({
      role: "instructor",
      instructorStatus: "pending",
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments({
      role: "instructor",
      instructorStatus: "pending",
    });

    res.status(200).json({
      success: true,
      data: {
        instructors,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalInstructors: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get pending instructors error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending instructors",
    });
  }
};

// Approve instructor application
const approveInstructor = async (req, res) => {
  try {
    const { id } = req.params;

    const instructor = await User.findById(id);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    if (
      instructor.role !== "instructor" ||
      instructor.instructorStatus !== "pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid instructor application",
      });
    }

    // Update instructorStatus to approved
    instructor.instructorStatus = "approved";
    instructor.approvedAt = new Date();
    instructor.rejectionReason = undefined; // Clear any previous rejection
    await instructor.save();

    // Send approval email
    try {
      await sendInstructorDecisionEmail(
        instructor.userEmail,
        instructor.userName,
        "approved"
      );
    } catch (emailError) {
      console.error("Failed to send approval email:", emailError);
      // Don't fail the request if email fails
    }

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "instructor_approved",
      "user",
      id,
      instructor.userName,
      { decision: "approved" },
      req
    );

    res.status(200).json({
      success: true,
      message: "Instructor approved successfully",
      data: {
        instructorId: id,
        status: "approved",
      },
    });
  } catch (error) {
    console.error("Approve instructor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve instructor",
    });
  }
};

// Reject instructor application
const rejectInstructor = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const instructor = await User.findById(id);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    if (
      instructor.role !== "instructor" ||
      instructor.instructorStatus !== "pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid instructor application",
      });
    }

    // Update instructorStatus to rejected
    instructor.instructorStatus = "rejected";
    instructor.rejectionReason = reason;
    await instructor.save();

    // Send rejection email
    try {
      await sendInstructorDecisionEmail(
        instructor.userEmail,
        instructor.userName,
        "rejected",
        reason
      );
    } catch (emailError) {
      console.error("Failed to send rejection email:", emailError);
      // Don't fail the request if email fails
    }

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "instructor_rejected",
      "user",
      id,
      instructor.userName,
      { decision: "rejected", reason },
      req
    );

    res.status(200).json({
      success: true,
      message: "Instructor rejected successfully",
      data: {
        instructorId: id,
        status: "rejected",
        reason,
      },
    });
  } catch (error) {
    console.error("Reject instructor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject instructor",
    });
  }
};

// Question Bank Management Functions

// Create a new question in the question bank
const createQuestion = async (req, res) => {
  try {
    const {
      questionText,
      options,
      correctAnswer,
      explanation,
      tags,
      subject,
      difficulty,
    } = req.body;

    // Validate required fields
    if (
      !questionText ||
      !options ||
      !Array.isArray(options) ||
      options.length === 0 ||
      !correctAnswer ||
      !subject ||
      !difficulty
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: questionText, options, correctAnswer, subject, difficulty",
      });
    }

    // Validate difficulty
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be 'easy', 'medium', or 'hard'",
      });
    }

    // Validate correct answer is in options
    if (!options.includes(correctAnswer)) {
      return res.status(400).json({
        success: false,
        message: "Correct answer must be one of the options",
      });
    }

    const newQuestion = new QuestionBank({
      questionText,
      options,
      correctAnswer,
      explanation,
      tags: tags || [],
      subject,
      difficulty,
      createdBy: req.user._id,
    });

    const savedQuestion = await newQuestion.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "question_created",
      "question",
      savedQuestion._id,
      questionText.substring(0, 50) + "...",
      { subject, difficulty },
      req
    );

    res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: savedQuestion,
    });
  } catch (error) {
    console.error("Create question error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create question",
    });
  }
};

// Get all questions with filtering and pagination
const getAllQuestions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subject,
      difficulty,
      tags,
      search,
    } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};

    if (subject && subject !== "all") filter.subject = subject;
    if (difficulty && difficulty !== "all") filter.difficulty = difficulty;
    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim());
      filter.tags = { $in: tagArray };
    }
    if (search) {
      filter.$or = [
        { questionText: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const questions = await QuestionBank.find(filter)
      .populate("createdBy", "userName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await QuestionBank.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalQuestions: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all questions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
    });
  }
};

// Update a question
const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Validate difficulty if provided
    if (
      updateData.difficulty &&
      !["easy", "medium", "hard"].includes(updateData.difficulty)
    ) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be 'easy', 'medium', or 'hard'",
      });
    }

    // Validate correct answer if options are updated
    if (updateData.options && updateData.correctAnswer) {
      if (!updateData.options.includes(updateData.correctAnswer)) {
        return res.status(400).json({
          success: false,
          message: "Correct answer must be one of the options",
        });
      }
    } else if (
      updateData.correctAnswer &&
      !question.options.includes(updateData.correctAnswer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Correct answer must be one of the options",
      });
    }

    const oldData = {
      questionText: question.questionText,
      subject: question.subject,
      difficulty: question.difficulty,
    };

    Object.assign(question, updateData);
    await question.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "question_updated",
      "question",
      id,
      question.questionText.substring(0, 50) + "...",
      { oldData, newData: updateData },
      req
    );

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: question,
    });
  } catch (error) {
    console.error("Update question error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update question",
    });
  }
};

// Delete a question
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    await QuestionBank.findByIdAndDelete(id);

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "question_deleted",
      "question",
      id,
      question.questionText.substring(0, 50) + "...",
      {
        deletedQuestion: {
          questionText: question.questionText,
          subject: question.subject,
          difficulty: question.difficulty,
        },
      },
      req
    );

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("Delete question error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete question",
    });
  }
};

// Approve course
const approveCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Course is not pending approval",
      });
    }

    const oldStatus = course.approvalStatus;
    course.approvalStatus = "approved";
    course.status = "published";
    course.publishedAt = new Date();
    course.approvalDate = new Date();
    course.approvedBy = req.user._id;
    course.rejectionReason = undefined; // Clear any previous rejection

    await course.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "course_approved",
      "course",
      id,
      course.title,
      {
        oldStatus,
        newStatus: "approved",
        publishedAt: course.publishedAt,
      },
      req
    );

    res.status(200).json({
      success: true,
      message: "Course approved and published successfully",
      data: {
        courseId: id,
        approvalStatus: course.approvalStatus,
        status: course.status,
        publishedAt: course.publishedAt,
        approvalDate: course.approvalDate,
      },
    });
  } catch (error) {
    console.error("Approve course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve course",
    });
  }
};

// Reject course
const rejectCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Course is not pending approval",
      });
    }

    const oldStatus = course.approvalStatus;
    course.approvalStatus = "rejected";
    course.status = "draft";
    course.approvalDate = new Date();
    course.approvedBy = req.user._id;
    course.rejectionReason = rejectionReason || "No reason provided";

    await course.save();

    // Log the action
    await logAdminAction(
      req.user._id,
      req.user.userName,
      "course_rejected",
      "course",
      id,
      course.title,
      {
        oldStatus,
        newStatus: "rejected",
        rejectionReason: course.rejectionReason,
      },
      req
    );

    res.status(200).json({
      success: true,
      message: "Course rejected successfully",
      data: {
        courseId: id,
        approvalStatus: course.approvalStatus,
        status: course.status,
        approvalDate: course.approvalDate,
        rejectionReason: course.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Reject course error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject course",
    });
  }
};

module.exports = {
  getAllUsers,
  updateUser,
  deleteUser,
  deactivateUser,
  reactivateUser,
  bulkUserAction,
  getPendingCourses,
  reviewCourse,
  approveCourse,
  rejectCourse,
  getAuditLogs,
  getAdminStats,
  getRecentActivities,
  getAllCourses,
  updateCourseStatus,
  deleteCourse,
  getPendingInstructors,
  approveInstructor,
  rejectInstructor,
  createQuestion,
  getAllQuestions,
  updateQuestion,
  deleteQuestion,
};
